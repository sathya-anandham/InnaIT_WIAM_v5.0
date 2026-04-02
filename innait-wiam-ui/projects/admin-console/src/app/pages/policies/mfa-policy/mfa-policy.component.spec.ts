import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { MfaPolicyComponent } from './mfa-policy.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('MfaPolicyComponent', () => {
  let component: MfaPolicyComponent;
  let fixture: ComponentFixture<MfaPolicyComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockMfaPolicy = {
    data: {
      allowedMethods: ['TOTP', 'FIDO2'],
      stepUpConditions: [
        { trigger: 'IP_CHANGE', action: 'REQUIRE_MFA' }
      ],
      deviceRememberEnabled: true,
      deviceRememberDays: 14,
      enrollmentGracePeriodDays: 7,
      backupCodesCount: 10
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MfaPolicyComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(MfaPolicyComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MfaPolicyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/mfa');
    req.flush(mockMfaPolicy);
    expect(component).toBeTruthy();
  });

  it('should load MFA policy', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/mfa');
    req.flush(mockMfaPolicy);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.mfaForm.get('method_TOTP')?.value).toBeTrue();
    expect(component.mfaForm.get('method_FIDO2')?.value).toBeTrue();
    expect(component.mfaForm.get('method_SOFT_TOKEN')?.value).toBeFalse();
    expect(component.mfaForm.get('method_BACKUP_CODE')?.value).toBeFalse();
    expect(component.mfaForm.get('deviceRememberEnabled')?.value).toBeTrue();
    expect(component.mfaForm.get('deviceRememberDays')?.value).toBe(14);
    expect(component.mfaForm.get('enrollmentGracePeriodDays')?.value).toBe(7);
    expect(component.conditionsArray.length).toBe(1);
    expect(component.conditionsArray.at(0).get('trigger')?.value).toBe('IP_CHANGE');
    expect(component.noMethodSelected).toBeFalse();
  }));

  it('should validate at least one MFA method selected', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/mfa');
    req.flush(mockMfaPolicy);
    tick();

    // Deselect all methods
    component.mfaForm.get('method_TOTP')?.setValue(false);
    component.mfaForm.get('method_FIDO2')?.setValue(false);
    component.mfaForm.get('method_SOFT_TOKEN')?.setValue(false);
    component.mfaForm.get('method_BACKUP_CODE')?.setValue(false);

    expect(component.noMethodSelected).toBeTrue();

    // Re-select one method
    component.mfaForm.get('method_TOTP')?.setValue(true);
    expect(component.noMethodSelected).toBeFalse();
  }));
});
