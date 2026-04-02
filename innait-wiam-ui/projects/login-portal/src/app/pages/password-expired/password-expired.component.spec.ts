import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { PasswordExpiredComponent } from './password-expired.component';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string { return key; }
}

describe('PasswordExpiredComponent', () => {
  let component: PasswordExpiredComponent;
  let fixture: ComponentFixture<PasswordExpiredComponent>;
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
        PasswordExpiredComponent,
        ReactiveFormsModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: routerSpy },
      ],
    })
      .overrideComponent(PasswordExpiredComponent, {
        remove: { imports: ['TranslatePipe'] as any },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PasswordExpiredComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.form).toBeDefined();
    expect(component.form.get('currentPassword')).toBeTruthy();
    expect(component.form.get('newPassword')).toBeTruthy();
    expect(component.form.get('confirmPassword')).toBeTruthy();
  });

  it('should show validation errors for empty required fields', () => {
    // Mark all fields as touched to trigger validation display
    component.form.markAllAsTouched();
    fixture.detectChanges();

    expect(component.form.get('currentPassword')!.hasError('required')).toBeTrue();
    expect(component.form.get('newPassword')!.hasError('required')).toBeTrue();
    expect(component.form.get('confirmPassword')!.hasError('required')).toBeTrue();
    expect(component.form.invalid).toBeTrue();
  });

  it('should detect password mismatch', () => {
    component.form.get('newPassword')!.setValue('Password1!');
    component.form.get('confirmPassword')!.setValue('DifferentPassword1!');
    component.form.get('confirmPassword')!.markAsTouched();
    fixture.detectChanges();

    expect(component.form.hasError('passwordMismatch')).toBeTrue();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorEl = compiled.querySelector('.p-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl!.textContent).toContain('selfService.passwordMismatch');
  });

  it('should update strength meter as password changes', () => {
    // 'aA1!abcd' has: uppercase(A), lowercase(a,b,c,d), digit(1), special(!), length >= 8
    component.form.get('newPassword')!.setValue('aA1!abcd');
    component.updateStrength();
    fixture.detectChanges();

    // All 5 criteria met -> strength should be 100
    expect(component.strength).toBe(100);
    expect(component.strengthLabel).toBe('Strong');
    expect(component.strengthClass).toBe('strength-strong');

    // Partial password: only lowercase, not enough length
    component.form.get('newPassword')!.setValue('ab');
    component.updateStrength();
    fixture.detectChanges();

    expect(component.hasLowercase).toBeTrue();
    expect(component.hasUppercase).toBeFalse();
    expect(component.hasDigit).toBeFalse();
    expect(component.hasSpecial).toBeFalse();
    expect(component.hasMinLength).toBeFalse();
    expect(component.strength).toBe(20); // 1 out of 5
    expect(component.strengthLabel).toBe('Weak');
    expect(component.strengthClass).toBe('strength-weak');
  });

  it('should show policy rule checkmarks for met criteria', () => {
    component.form.get('newPassword')!.setValue('Test1234!');
    component.updateStrength();
    fixture.detectChanges();

    expect(component.hasUppercase).toBeTrue();
    expect(component.hasLowercase).toBeTrue();
    expect(component.hasDigit).toBeTrue();
    expect(component.hasSpecial).toBeTrue();
    expect(component.hasMinLength).toBeTrue();

    const compiled = fixture.nativeElement as HTMLElement;
    const metRules = compiled.querySelectorAll('.rule.met');
    expect(metRules.length).toBe(5);

    // Verify all checkmarks are pi-check icons
    metRules.forEach((rule) => {
      const icon = rule.querySelector('i');
      expect(icon!.classList.contains('pi-check')).toBeTrue();
    });
  });

  it('should call password change API on submit', fakeAsync(() => {
    // Fill out the form with valid data
    component.form.get('currentPassword')!.setValue('OldPassword1!');
    component.form.get('newPassword')!.setValue('NewPassword1!');
    component.form.get('confirmPassword')!.setValue('NewPassword1!');
    component.updateStrength();
    fixture.detectChanges();

    expect(component.form.valid).toBeTrue();

    component.onSubmit();

    const req = httpMock.expectOne('/api/v1/credentials/password/change');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      accountId: 'acc-123',
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword1!',
    });

    req.flush({ status: 'SUCCESS', data: {}, timestamp: new Date().toISOString() });
    tick();

    expect(component.loading).toBeFalse();
    expect(component.successMessage).toContain('Password changed successfully');

    // After 2-second delay, should navigate to /login/complete
    tick(2000);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login/complete']);
  }));

  it('should show error on API failure', () => {
    component.form.get('currentPassword')!.setValue('OldPassword1!');
    component.form.get('newPassword')!.setValue('NewPassword1!');
    component.form.get('confirmPassword')!.setValue('NewPassword1!');
    component.updateStrength();
    fixture.detectChanges();

    component.onSubmit();

    const req = httpMock.expectOne('/api/v1/credentials/password/change');
    req.flush(
      { error: { message: 'Current password is incorrect' } },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Current password is incorrect');
  });

  it('should toggle password visibility', () => {
    expect(component.showNew).toBeFalse();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggleBtn = compiled.querySelector('.p-inputgroup button[type="button"]') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();

    // Verify the new password input starts as type="password"
    const newPasswordInput = compiled.querySelector('#newPassword') as HTMLInputElement;
    expect(newPasswordInput.type).toBe('password');

    // Toggle visibility
    component.showNew = true;
    fixture.detectChanges();

    expect(newPasswordInput.type).toBe('text');

    // Toggle back
    component.showNew = false;
    fixture.detectChanges();

    expect(newPasswordInput.type).toBe('password');
  });
});
