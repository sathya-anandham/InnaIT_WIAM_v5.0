import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { TenantSettingsComponent } from './tenant-settings.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('TenantSettingsComponent', () => {
  let component: TenantSettingsComponent;
  let fixture: ComponentFixture<TenantSettingsComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'getCurrentUser']);

  const mockTenantSettings = {
    tenantName: 'Acme Corp',
    contactEmail: 'admin@acme.com',
    contactPhone: '+1234567890',
    timezone: 'UTC',
    defaultLocale: 'en',
    address: '123 Main St',
    industry: 'Technology',
    lastModifiedAt: '2026-01-15T10:30:00Z',
    lastModifiedBy: 'admin@acme.com'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TenantSettingsComponent,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(TenantSettingsComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TenantSettingsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/tenant');
    req.flush({ data: mockTenantSettings });

    expect(component).toBeTruthy();
  });

  it('should load tenant settings on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/tenant');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockTenantSettings });

    expect(component.loading).toBeFalse();
    expect(component.settingsForm.get('tenantName')?.value).toBe('Acme Corp');
    expect(component.settingsForm.get('contactEmail')?.value).toBe('admin@acme.com');
    expect(component.settingsForm.get('timezone')?.value).toBe('UTC');
    expect(component.settingsForm.get('industry')?.value).toBe('Technology');
    expect(component.lastModifiedLabel).toContain('admin@acme.com');
  });

  it('should validate required fields (tenantName, contactEmail)', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/tenant');
    req.flush({ data: mockTenantSettings });

    // Clear required fields
    component.settingsForm.patchValue({ tenantName: '', contactEmail: '' });
    component.settingsForm.markAllAsTouched();
    fixture.detectChanges();

    expect(component.settingsForm.get('tenantName')?.hasError('required')).toBeTrue();
    expect(component.settingsForm.get('contactEmail')?.hasError('required')).toBeTrue();
    expect(component.settingsForm.invalid).toBeTrue();

    // Test email format validation
    component.settingsForm.patchValue({ tenantName: 'Test', contactEmail: 'not-an-email' });
    fixture.detectChanges();

    expect(component.settingsForm.get('contactEmail')?.hasError('email')).toBeTrue();
    expect(component.settingsForm.invalid).toBeTrue();

    // Provide valid values
    component.settingsForm.patchValue({ tenantName: 'Test Tenant', contactEmail: 'valid@test.com' });
    fixture.detectChanges();

    expect(component.settingsForm.get('tenantName')?.valid).toBeTrue();
    expect(component.settingsForm.get('contactEmail')?.valid).toBeTrue();
  });

  it('should save settings via PUT', fakeAsync(() => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/tenant');
    loadReq.flush({ data: mockTenantSettings });

    // Modify a field to make the form dirty
    component.settingsForm.patchValue({ tenantName: 'Updated Corp' });
    component.settingsForm.markAsDirty();
    fixture.detectChanges();

    // Trigger save
    component.onSave();
    expect(component.saving).toBeTrue();

    const saveReq = httpTesting.expectOne('/api/v1/admin/settings/tenant');
    expect(saveReq.request.method).toBe('PUT');
    expect(saveReq.request.body.tenantName).toBe('Updated Corp');

    const updatedSettings = {
      ...mockTenantSettings,
      tenantName: 'Updated Corp',
      lastModifiedAt: '2026-04-03T12:00:00Z',
      lastModifiedBy: 'admin@acme.com'
    };
    saveReq.flush({ data: updatedSettings });

    expect(component.saving).toBeFalse();
    expect(component.successMessage).toBe('Tenant settings saved successfully.');
    expect(component.settingsForm.pristine).toBeTrue();

    // Clear success message after timeout
    tick(5000);
    expect(component.successMessage).toBe('');
  }));
});
