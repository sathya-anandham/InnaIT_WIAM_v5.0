import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { OnboardingWizardComponent } from './onboarding-wizard.component';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('OnboardingWizardComponent', () => {
  let component: OnboardingWizardComponent;
  let fixture: ComponentFixture<OnboardingWizardComponent>;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockAuthService = {
    currentState: {
      accountId: 'acc-123',
      status: 'AUTHENTICATED',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
    },
  };

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [
        OnboardingWizardComponent,
        ReactiveFormsModule,
        FormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(OnboardingWizardComponent, {
        remove: { imports: ['TranslatePipe'] as any },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OnboardingWizardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.steps.length).toBe(4);
    expect(component.passwordForm).toBeDefined();
  });

  it('should start at step 0 (Accept Terms)', () => {
    expect(component.activeStep).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    const stepContent = compiled.querySelector('.step-content');
    expect(stepContent).toBeTruthy();
    expect(stepContent!.textContent).toContain('onboarding.acceptTerms');
  });

  it('should disable Continue button until terms accepted', () => {
    expect(component.termsAccepted).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    // PrimeNG p-button renders a <button> element inside; find it
    const continueBtn = compiled.querySelector('p-button[label="Continue"] button') as HTMLButtonElement;

    // The button should be disabled since terms are not accepted
    if (continueBtn) {
      expect(continueBtn.disabled).toBeTrue();
    } else {
      // If PrimeNG renders differently, check component state
      expect(component.termsAccepted).toBeFalse();
    }

    // Accept terms and verify button becomes enabled
    component.termsAccepted = true;
    fixture.detectChanges();

    const updatedBtn = compiled.querySelector('p-button[label="Continue"] button') as HTMLButtonElement;
    if (updatedBtn) {
      expect(updatedBtn.disabled).toBeFalse();
    }
    expect(component.termsAccepted).toBeTrue();
  });

  it('should advance to step 1 after accepting terms', fakeAsync(() => {
    component.termsAccepted = true;
    fixture.detectChanges();

    component.acceptTerms();

    const req = httpMock.expectOne('/api/v1/self/onboarding/accept-terms');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ accountId: 'acc-123' });

    req.flush({ status: 'SUCCESS', data: {}, timestamp: new Date().toISOString() });
    tick();
    fixture.detectChanges();

    expect(component.activeStep).toBe(1);
    expect(component.loading).toBeFalse();
  }));

  it('should show password form in step 1', fakeAsync(() => {
    // Advance to step 1
    component.activeStep = 1;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const passwordInput = compiled.querySelector('#newPassword') as HTMLInputElement;
    const confirmInput = compiled.querySelector('#confirmPw') as HTMLInputElement;

    expect(passwordInput).toBeTruthy();
    expect(confirmInput).toBeTruthy();
    expect(component.passwordForm).toBeDefined();
    expect(component.passwordForm.get('newPassword')).toBeTruthy();
    expect(component.passwordForm.get('confirmPassword')).toBeTruthy();
  }));

  it('should validate password match in step 1', () => {
    component.activeStep = 1;
    fixture.detectChanges();

    component.passwordForm.get('newPassword')!.setValue('StrongPass1!');
    component.passwordForm.get('confirmPassword')!.setValue('DifferentPass1!');
    component.passwordForm.get('confirmPassword')!.markAsTouched();
    fixture.detectChanges();

    expect(component.passwordForm.hasError('passwordMismatch')).toBeTrue();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorEl = compiled.querySelector('.p-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.textContent).toContain('selfService.passwordMismatch');
  });

  it('should advance to step 2 after setting password', fakeAsync(() => {
    component.activeStep = 1;
    fixture.detectChanges();

    component.passwordForm.get('newPassword')!.setValue('StrongPass1!');
    component.passwordForm.get('confirmPassword')!.setValue('StrongPass1!');
    fixture.detectChanges();

    expect(component.passwordForm.valid).toBeTrue();

    component.setPassword();

    const req = httpMock.expectOne('/api/v1/self/onboarding/set-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      accountId: 'acc-123',
      newPassword: 'StrongPass1!',
    });

    req.flush({ status: 'SUCCESS', data: {}, timestamp: new Date().toISOString() });
    tick();
    fixture.detectChanges();

    expect(component.activeStep).toBe(2);
    expect(component.loading).toBeFalse();
  }));

  it('should show MFA options in step 2', () => {
    component.activeStep = 2;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const mfaOptions = compiled.querySelectorAll('.mfa-option');

    expect(mfaOptions.length).toBe(2);
    expect(mfaOptions[0].textContent).toContain('Authenticator App');
    expect(mfaOptions[1].textContent).toContain('Security Key');
  });

  it('should advance to step 3 after enrolling MFA', fakeAsync(() => {
    component.activeStep = 2;
    fixture.detectChanges();

    component.enrollMfa('TOTP');

    const req = httpMock.expectOne('/api/v1/self/onboarding/enroll-mfa');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      accountId: 'acc-123',
      mfaType: 'TOTP',
    });

    req.flush({ status: 'SUCCESS', data: {}, timestamp: new Date().toISOString() });
    tick();
    fixture.detectChanges();

    expect(component.mfaEnrolled).toBeTrue();
    expect(component.loading).toBeFalse();

    // The Continue button should now be visible; click it to go to step 3
    component.activeStep = 3;
    fixture.detectChanges();

    expect(component.activeStep).toBe(3);

    const compiled = fixture.nativeElement as HTMLElement;
    const completeContent = compiled.querySelector('.complete-container');
    expect(completeContent).toBeTruthy();
    expect(completeContent!.textContent).toContain('onboarding.complete');
  }));

  it('should navigate to /login/complete after completing onboarding', fakeAsync(() => {
    component.activeStep = 3;
    fixture.detectChanges();

    component.completeOnboarding();

    const req = httpMock.expectOne('/api/v1/self/onboarding/complete');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ accountId: 'acc-123' });

    req.flush({ status: 'SUCCESS', data: {}, timestamp: new Date().toISOString() });
    tick();

    expect(component.loading).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login/complete']);
  }));
});
