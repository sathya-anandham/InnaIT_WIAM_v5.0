import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { AuthTypeConfigComponent } from './auth-type-config.component';
import { TranslatePipe } from '@innait/i18n';
import { AuthService } from '@innait/core';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('AuthTypeConfigComponent', () => {
  let component: AuthTypeConfigComponent;
  let fixture: ComponentFixture<AuthTypeConfigComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthService = jasmine.createSpyObj('AuthService', ['getToken', 'isAuthenticated']);

  const mockAuthTypeResponse = {
    data: {
      tenant: {
        primaryFactors: ['PASSWORD'],
        secondaryFactors: ['TOTP'],
        mfaRequired: 'CONDITIONAL' as const,
        mfaGracePeriodDays: 7
      },
      groups: [
        {
          groupId: 'g1',
          groupName: 'Admins',
          config: null
        }
      ],
      roles: [],
      applications: []
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthTypeConfigComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .overrideComponent(AuthTypeConfigComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuthTypeConfigComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/auth-type');
    req.flush(mockAuthTypeResponse);
    expect(component).toBeTruthy();
  });

  it('should load auth type configuration', fakeAsync(() => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/v1/admin/policies/auth-type');
    req.flush(mockAuthTypeResponse);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.tenantForm).toBeTruthy();
    expect(component.tenantForm.get('mfaRequired')?.value).toBe('CONDITIONAL');
    expect(component.tenantForm.get('mfaGracePeriodDays')?.value).toBe(7);
    expect(component.tenantForm.get('primary_PASSWORD')?.value).toBeTrue();
    expect(component.tenantForm.get('primary_FIDO2')?.value).toBeFalse();
    expect(component.tenantForm.get('secondary_TOTP')?.value).toBeTrue();
    expect(component.groupOverrides.length).toBe(1);
    expect(component.groupOverrides[0].name).toBe('Admins');
    expect(component.groupOverrides[0].overrideEnabled).toBeFalse();
  }));

  it('should save tenant-level config changes', fakeAsync(() => {
    fixture.detectChanges();
    const loadReq = httpTesting.expectOne('/api/v1/admin/policies/auth-type');
    loadReq.flush(mockAuthTypeResponse);
    tick();

    // Mark form as dirty and change a value
    component.tenantForm.get('mfaRequired')?.setValue('ALWAYS');
    component.tenantForm.markAsDirty();
    component.saveTenantConfig();

    const saveReq = httpTesting.expectOne(req =>
      req.method === 'PUT' && req.url === '/api/v1/admin/policies/auth-type'
    );
    expect(saveReq.request.body.level).toBe('TENANT');
    expect(saveReq.request.body.targetId).toBeNull();
    expect(saveReq.request.body.config.mfaRequired).toBe('ALWAYS');
    expect(saveReq.request.body.config.primaryFactors).toContain('PASSWORD');

    saveReq.flush({ data: {} });
    tick();

    expect(component.saving).toBeFalse();
    expect(component.successMessage).toBe('Authentication type configuration saved successfully.');
  }));
});
