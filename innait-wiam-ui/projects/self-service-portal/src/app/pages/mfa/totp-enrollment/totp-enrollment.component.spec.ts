import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { TotpEnrollmentComponent } from './totp-enrollment.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('TotpEnrollmentComponent', () => {
  let component: TotpEnrollmentComponent;
  let fixture: ComponentFixture<TotpEnrollmentComponent>;
  let router: Router;
  let httpTesting: HttpTestingController;

  const mockAuthState = {
    status: 'AUTHENTICATED',
    txnId: 'txn-001',
    loginId: 'testuser',
    roles: [],
    groups: [],
    amr: [],
    acr: '',
    sessionId: 'sess-001',
  };

  const mockAuthService = {
    currentState: mockAuthState,
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    isAuthenticated: true,
    clearState: jasmine.createSpy('clearState'),
  };

  beforeEach(async () => {
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [TotpEnrollmentComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(TotpEnrollmentComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(TotpEnrollmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.steps.length).toBe(3);
    expect(component.verifyForm).toBeTruthy();
  });

  it('should start at step 1 (info screen)', () => {
    expect(component.activeStep).toBe(0);

    const infoSection = (fixture.nativeElement as HTMLElement).querySelector('.step-info');
    expect(infoSection).toBeTruthy();

    // Steps should show Info, Scan QR, Verify
    expect(component.steps[0].label).toBe('Info');
    expect(component.steps[1].label).toBe('Scan QR');
    expect(component.steps[2].label).toBe('Verify');

    // Enrollment data should be null initially
    expect(component.enrollmentData).toBeNull();
    expect(component.enrolling).toBeFalse();
    expect(component.verifying).toBeFalse();
    expect(component.errorMessage).toBe('');
  });

  it('should call enroll API and display QR code on step 2', fakeAsync(() => {
    const mockEnrollResponse = {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
      issuer: 'InnaIT WIAM',
      accountName: 'testuser@innait.com',
    };

    // Trigger enrollment
    component.beginEnrollment();
    expect(component.enrolling).toBeTrue();
    expect(component.errorMessage).toBe('');

    // Flush the HTTP request
    const req = httpTesting.expectOne('/api/v1/self/mfa/totp/enroll');
    expect(req.request.method).toBe('POST');
    req.flush(mockEnrollResponse);
    tick();

    // After response, should move to step 2 and store enrollment data
    expect(component.enrolling).toBeFalse();
    expect(component.activeStep).toBe(1);
    expect(component.enrollmentData).toEqual(mockEnrollResponse);
    expect(component.enrollmentData!.qrCodeDataUrl).toBe(mockEnrollResponse.qrCodeDataUrl);
    expect(component.enrollmentData!.secret).toBe('JBSWY3DPEHPK3PXP');

    fixture.detectChanges();

    // QR code image should be rendered
    const qrImg = (fixture.nativeElement as HTMLElement).querySelector('.qr-image') as HTMLImageElement;
    expect(qrImg).toBeTruthy();
    expect(qrImg.src).toContain('data:image/png');

    // Secret should be displayed
    const secretText = (fixture.nativeElement as HTMLElement).querySelector('.secret-text');
    expect(secretText?.textContent).toContain('JBSWY3DPEHPK3PXP');
  }));

  it('should verify TOTP code and show success on step 3', fakeAsync(() => {
    // First, set up enrollment data to simulate being on step 2
    component.enrollmentData = {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeDataUrl: 'data:image/png;base64,abc',
      issuer: 'InnaIT WIAM',
      accountName: 'testuser@innait.com',
    };
    component.activeStep = 1;
    fixture.detectChanges();

    // Fill in the verification code
    component.verifyForm.get('code')?.setValue('123456');
    expect(component.verifyForm.valid).toBeTrue();

    // Submit verification
    component.verifyCode();
    expect(component.verifying).toBeTrue();
    expect(component.errorMessage).toBe('');

    // Flush the verify HTTP request
    const req = httpTesting.expectOne('/api/v1/self/mfa/totp/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ success: true });
    tick();

    // Should advance to step 3 (success)
    expect(component.verifying).toBeFalse();
    expect(component.activeStep).toBe(2);

    fixture.detectChanges();

    // Success section should be visible
    const successSection = (fixture.nativeElement as HTMLElement).querySelector('.step-success');
    expect(successSection).toBeTruthy();

    const successIcon = (fixture.nativeElement as HTMLElement).querySelector('.success-icon');
    expect(successIcon).toBeTruthy();
  }));

  it('should handle verification failure with error message', fakeAsync(() => {
    // Set up enrollment data to simulate being on step 2
    component.enrollmentData = {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeDataUrl: 'data:image/png;base64,abc',
      issuer: 'InnaIT WIAM',
      accountName: 'testuser@innait.com',
    };
    component.activeStep = 1;
    fixture.detectChanges();

    // Fill in an incorrect code
    component.verifyForm.get('code')?.setValue('000000');
    component.verifyCode();
    expect(component.verifying).toBeTrue();

    // Simulate API error
    const req = httpTesting.expectOne('/api/v1/self/mfa/totp/verify');
    expect(req.request.method).toBe('POST');
    req.flush(
      { message: 'Invalid TOTP code' },
      { status: 400, statusText: 'Bad Request' }
    );
    tick();

    // Should remain on step 2 with error
    expect(component.verifying).toBeFalse();
    expect(component.activeStep).toBe(1);
    expect(component.errorMessage).toBe('Invalid TOTP code');

    // Code field should be reset
    expect(component.verifyForm.get('code')?.value).toBeNull();

    fixture.detectChanges();

    // Error message should be displayed in the template
    const errorMsg = (fixture.nativeElement as HTMLElement).querySelector('p-message[severity="error"]');
    expect(errorMsg).toBeTruthy();
  }));
});
