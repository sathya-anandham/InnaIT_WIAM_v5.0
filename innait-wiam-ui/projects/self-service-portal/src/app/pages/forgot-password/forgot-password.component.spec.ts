import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Pipe, PipeTransform } from '@angular/core';

import { ForgotPasswordComponent } from './forgot-password.component';

// ---------- Mock TranslatePipe ----------
@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

// ---------- Mock auth state ----------
const mockAuthState = {
  status: 'AUTHENTICATED',
  roles: [],
  groups: [],
  amr: ['PASSWORD'],
  acr: 'urn:innait:acr:basic',
  userId: 'user-1',
  accountId: 'acc-1',
  displayName: 'Test User',
  sessionId: 'sess-1',
};

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent,
        MockTranslatePipe,
        ReactiveFormsModule,
        NoopAnimationsModule,
        RouterTestingModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(ForgotPasswordComponent, {
        set: {
          imports: [
            ReactiveFormsModule,
            MockTranslatePipe,
            NoopAnimationsModule,
            RouterTestingModule,
          ],
        },
      })
      .compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
    component.ngOnDestroy(); // clean up timers
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.emailForm).toBeTruthy();
    expect(component.resetForm).toBeTruthy();
  });

  it('should start at step 1 (email input)', () => {
    expect(component.currentStep).toBe(0);
    expect(component.emailSent).toBeFalse();
    expect(component.resetSuccess).toBeFalse();
  });

  it('should advance to step 2 after submitting email', fakeAsync(() => {
    // Fill in email
    component.emailForm.get('email')!.setValue('test@example.com');
    fixture.detectChanges();

    // Submit email
    component.submitEmail();

    const req = httpTestingController.expectOne('/api/v1/self/credentials/password/forgot');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'test@example.com' });

    req.flush({ data: null });
    fixture.detectChanges();

    expect(component.emailSent).toBeTrue();

    // The component uses setTimeout(1500) to advance to step 2
    tick(1500);
    fixture.detectChanges();

    expect(component.currentStep).toBe(1);
  }));

  it('should submit OTP and advance to step 3 on success', () => {
    // Manually move to step 2
    component.currentStep = 1;
    component.emailForm.get('email')!.setValue('test@example.com');

    // Fill in OTP digits
    component.digits = ['1', '2', '3', '4', '5', '6'];
    fixture.detectChanges();

    // Submit OTP
    component.submitOtp();

    const req = httpTestingController.expectOne('/api/v1/self/credentials/password/verify-otp');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'test@example.com',
      otp: '123456',
    });

    req.flush({ data: { resetToken: 'mock-reset-token-xyz' } });
    fixture.detectChanges();

    expect(component.currentStep).toBe(2);
    expect(component.errorMessage).toBe('');
  });

  it('should submit new password with reset token on step 3', () => {
    // Manually set up state as if steps 1 & 2 completed
    component.currentStep = 2;
    (component as any).resetToken = 'mock-reset-token-xyz';

    // Fill in reset form
    component.resetForm.get('newPassword')!.setValue('MyN3wP@ssword');
    component.resetForm.get('confirmPassword')!.setValue('MyN3wP@ssword');
    fixture.detectChanges();

    // Submit reset
    component.submitReset();

    const req = httpTestingController.expectOne('/api/v1/self/credentials/password/reset');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      resetToken: 'mock-reset-token-xyz',
      newPassword: 'MyN3wP@ssword',
    });

    req.flush({ data: null });
    fixture.detectChanges();

    expect(component.submitting).toBeFalse();
    expect(component.resetSuccess).toBeTrue();
  });

  it('should show timing-safe message regardless of email existence', fakeAsync(() => {
    component.emailForm.get('email')!.setValue('nonexistent@example.com');
    fixture.detectChanges();

    component.submitEmail();

    // Simulate a server error (e.g., email not found)
    const req = httpTestingController.expectOne('/api/v1/self/credentials/password/forgot');
    req.flush(
      { error: { message: 'Not found' } },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    // Even on error, the timing-safe message should be shown
    expect(component.emailSent).toBeTrue();

    // And it should still advance to step 2 after timeout
    tick(1500);
    fixture.detectChanges();

    expect(component.currentStep).toBe(1);
  }));
});
