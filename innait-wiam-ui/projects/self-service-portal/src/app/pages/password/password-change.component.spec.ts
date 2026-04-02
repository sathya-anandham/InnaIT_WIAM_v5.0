import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { PasswordChangeComponent } from './password-change.component';

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

describe('PasswordChangeComponent', () => {
  let component: PasswordChangeComponent;
  let fixture: ComponentFixture<PasswordChangeComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PasswordChangeComponent,
        MockTranslatePipe,
        ReactiveFormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(PasswordChangeComponent, {
        set: {
          imports: [
            ReactiveFormsModule,
            MockTranslatePipe,
            NoopAnimationsModule,
          ],
        },
      })
      .compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PasswordChangeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.passwordForm).toBeTruthy();
  });

  it('should require all three password fields', () => {
    const form = component.passwordForm;

    // All fields should be invalid when empty
    expect(form.get('currentPassword')!.hasError('required')).toBeTrue();
    expect(form.get('newPassword')!.hasError('required')).toBeTrue();
    expect(form.get('confirmPassword')!.hasError('required')).toBeTrue();

    // Fill all fields with valid values
    form.get('currentPassword')!.setValue('OldP@ssword123');
    form.get('newPassword')!.setValue('NewP@ssword123');
    form.get('confirmPassword')!.setValue('NewP@ssword123');

    expect(form.get('currentPassword')!.valid).toBeTrue();
    expect(form.get('newPassword')!.valid).toBeTrue();
    expect(form.get('confirmPassword')!.valid).toBeTrue();
  });

  it('should validate minimum length of 12 for new password', () => {
    const newPasswordCtrl = component.passwordForm.get('newPassword')!;

    // Set a short password (less than 12 chars)
    newPasswordCtrl.setValue('Short1!');
    newPasswordCtrl.markAsTouched();

    expect(newPasswordCtrl.hasError('minlength')).toBeTrue();

    // Set a password with exactly 12 chars meeting policy
    newPasswordCtrl.setValue('Abcdefgh1!23');
    // Should not have minlength error (has 12 chars)
    expect(newPasswordCtrl.hasError('minlength')).toBeFalse();
  });

  it('should show password strength meter based on policy rules', () => {
    const newPasswordCtrl = component.passwordForm.get('newPassword')!;

    // Initially no strength
    expect(component.strengthPercent).toBe(0);
    expect(component.strengthLevel).toBe(0);

    // Only lowercase = score 1
    newPasswordCtrl.setValue('abcdefghijklm');
    fixture.detectChanges();
    // length >= 12 (+1) + lowercase (+1) = 2
    expect(component.strengthLevel).toBe(2);
    expect(component.strengthLabel).toBe('Weak');

    // Meets all criteria: length >= 12, uppercase, lowercase, digit, special
    newPasswordCtrl.setValue('MyStr0ng!Pass');
    fixture.detectChanges();
    expect(component.strengthLevel).toBe(5);
    expect(component.strengthPercent).toBe(100);
    expect(component.strengthLabel).toBe('Very Strong');

    // Verify policy rules are updated
    const metRules = component.policyRules.filter((r) => r.met);
    expect(metRules.length).toBeGreaterThanOrEqual(5);
  });

  it('should validate password match between newPassword and confirmPassword', () => {
    const form = component.passwordForm;

    form.get('currentPassword')!.setValue('OldP@ssword123');
    form.get('newPassword')!.setValue('NewP@ssword123');
    form.get('confirmPassword')!.setValue('DifferentP@ss1');
    form.get('confirmPassword')!.markAsTouched();

    expect(form.hasError('passwordMismatch')).toBeTrue();

    // Now make them match
    form.get('confirmPassword')!.setValue('NewP@ssword123');

    expect(form.hasError('passwordMismatch')).toBeFalse();
  });

  it('should submit password change and reset form on success', () => {
    const form = component.passwordForm;

    form.get('currentPassword')!.setValue('OldP@ssword123');
    form.get('newPassword')!.setValue('NewP@ssword123');
    form.get('confirmPassword')!.setValue('NewP@ssword123');

    component.onSubmit();

    const req = httpTestingController.expectOne('/api/v1/self/credentials/password/change');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      currentPassword: 'OldP@ssword123',
      newPassword: 'NewP@ssword123',
    });

    req.flush({ data: null });
    fixture.detectChanges();

    expect(component.submitting).toBeFalse();
    expect(component.successMessage).toBeTruthy();
    // Form should be reset
    expect(form.get('currentPassword')!.value).toBeFalsy();
    expect(form.get('newPassword')!.value).toBeFalsy();
    expect(form.get('confirmPassword')!.value).toBeFalsy();
  });
});
