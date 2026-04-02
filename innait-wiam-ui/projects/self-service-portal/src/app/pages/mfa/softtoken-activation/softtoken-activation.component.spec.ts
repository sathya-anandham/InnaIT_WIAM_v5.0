import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { SoftTokenActivationComponent } from './softtoken-activation.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('SoftTokenActivationComponent', () => {
  let component: SoftTokenActivationComponent;
  let fixture: ComponentFixture<SoftTokenActivationComponent>;
  let httpMock: HttpTestingController;

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

  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    get currentState() {
      return mockAuthState;
    },
  };

  const mockRouter = {
    navigate: jasmine.createSpy('navigate'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SoftTokenActivationComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(SoftTokenActivationComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SoftTokenActivationComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should start at step 1 info screen', () => {
    fixture.detectChanges();
    expect(component.activeStep).toBe(0);
    expect(component.steps.length).toBe(3);
    expect(component.steps[0].label).toBe('Info');
    expect(component.steps[1].label).toBe('Activate');
    expect(component.steps[2].label).toBe('Done');
  });

  it('should call activate API and show QR code on step 2', fakeAsync(() => {
    fixture.detectChanges();

    const mockActivateResponse = {
      activationCode: 'ABCD-1234-EFGH-5678',
      qrCodeDataUrl: 'data:image/png;base64,fakequrcode',
      expiresIn: 300,
    };

    component.beginActivation();
    expect(component.activating).toBeTrue();

    const req = httpMock.expectOne('/api/v1/self/mfa/softtoken/activate');
    expect(req.request.method).toBe('POST');
    req.flush(mockActivateResponse);
    tick();

    expect(component.activating).toBeFalse();
    expect(component.activeStep).toBe(1);
    expect(component.activationData).toEqual(mockActivateResponse);
    expect(component.remainingSeconds).toBe(300);
    expect(component.countdownPercent).toBe(100);

    // Clean up: stop polling and countdown timers
    component.ngOnDestroy();
  }));

  it('should poll status API after activation', fakeAsync(() => {
    fixture.detectChanges();

    const mockActivateResponse = {
      activationCode: 'ABCD-1234-EFGH-5678',
      qrCodeDataUrl: 'data:image/png;base64,fakequrcode',
      expiresIn: 300,
    };

    component.beginActivation();

    const activateReq = httpMock.expectOne('/api/v1/self/mfa/softtoken/activate');
    activateReq.flush(mockActivateResponse);
    tick();

    // After activation, polling starts with 3-second interval
    // Advance by 3 seconds to trigger first poll
    tick(3000);

    const statusReq = httpMock.expectOne('/api/v1/self/mfa/softtoken/status');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({ activated: false });
    tick();

    // Component should still be on step 1 (scan & wait)
    expect(component.activeStep).toBe(1);

    // Clean up timers
    component.ngOnDestroy();
    // Flush any remaining requests that might have been initiated
    httpMock.match('/api/v1/self/mfa/softtoken/status');
  }));

  it('should show success when status returns activated', fakeAsync(() => {
    fixture.detectChanges();

    const mockActivateResponse = {
      activationCode: 'ABCD-1234-EFGH-5678',
      qrCodeDataUrl: 'data:image/png;base64,fakequrcode',
      expiresIn: 300,
    };

    component.beginActivation();

    const activateReq = httpMock.expectOne('/api/v1/self/mfa/softtoken/activate');
    activateReq.flush(mockActivateResponse);
    tick();

    // Advance by 3 seconds to trigger first poll
    tick(3000);

    const statusReq = httpMock.expectOne('/api/v1/self/mfa/softtoken/status');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({ activated: true });
    tick();

    // Component should advance to step 3 (success)
    expect(component.activeStep).toBe(2);

    // Clean up timers
    component.ngOnDestroy();
    httpMock.match('/api/v1/self/mfa/softtoken/status');
  }));
});
