import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { PasswordPolicyComponent } from './password-policy.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('PasswordPolicyComponent', () => {
  let component: PasswordPolicyComponent;
  let fixture: ComponentFixture<PasswordPolicyComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockPasswordPolicy = {
    data: {
      minLength: 14,
      maxLength: 64,
      requireUppercase: true,
      requireLowercase: true,
      requireDigit: true,
      requireSpecialChar: false,
      specialCharsAllowed: '!@#$%^&*',
      maxAge: 60,
      historyCount: 3,
      maxFailedAttempts: 5,
      lockoutDuration: 15
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordPolicyComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(PasswordPolicyComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PasswordPolicyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/password');
    req.flush(mockPasswordPolicy);
    expect(component).toBeTruthy();
  });

  it('should load password policy', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/password');
    req.flush(mockPasswordPolicy);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.policyForm.get('minLength')?.value).toBe(14);
    expect(component.policyForm.get('maxLength')?.value).toBe(64);
    expect(component.policyForm.get('requireUppercase')?.value).toBeTrue();
    expect(component.policyForm.get('requireSpecialChar')?.value).toBeFalse();
    expect(component.policyForm.get('maxAge')?.value).toBe(60);
    expect(component.policyForm.get('maxFailedAttempts')?.value).toBe(5);
    expect(component.policyForm.pristine).toBeTrue();
  }));

  it('should update live preview when form changes', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/password');
    req.flush(mockPasswordPolicy);
    tick();

    // Set a test password and trigger change
    component.testPassword = 'MyStrongPass123';
    component.onTestPasswordChange();

    expect(component.passwordRules.length).toBeGreaterThan(0);

    // Check that rules reflect policy values
    const minLengthRule = component.passwordRules.find(r => r.label.includes('14'));
    expect(minLengthRule).toBeTruthy();
    expect(minLengthRule!.passed).toBeTrue(); // 'MyStrongPass123' is 15 chars >= 14

    const uppercaseRule = component.passwordRules.find(r => r.label.includes('uppercase'));
    expect(uppercaseRule).toBeTruthy();
    expect(uppercaseRule!.active).toBeTrue();
    expect(uppercaseRule!.passed).toBeTrue();

    const digitRule = component.passwordRules.find(r => r.label.includes('digit'));
    expect(digitRule).toBeTruthy();
    expect(digitRule!.passed).toBeTrue();

    // Strength should be calculated
    expect(component.strengthScore).toBeGreaterThan(0);
    expect(component.strengthLabel).toBeTruthy();
  }));

  it('should save password policy', fakeAsync(() => {
    fixture.detectChanges();
    const loadReq = httpTesting.expectOne('/api/v1/admin/policies/password');
    loadReq.flush(mockPasswordPolicy);
    tick();

    // Modify form
    component.policyForm.get('minLength')?.setValue(16);
    component.policyForm.markAsDirty();
    component.onSave();

    const saveReq = httpTesting.expectOne(req =>
      req.method === 'PUT' && req.url === '/api/v1/admin/policies/password'
    );
    expect(saveReq.request.body.minLength).toBe(16);

    saveReq.flush({ data: {} });
    tick();

    expect(component.saving).toBeFalse();
    expect(component.successMessage).toBe('Password policy saved successfully.');
    expect(component.policyForm.pristine).toBeTrue();
  }));
});
