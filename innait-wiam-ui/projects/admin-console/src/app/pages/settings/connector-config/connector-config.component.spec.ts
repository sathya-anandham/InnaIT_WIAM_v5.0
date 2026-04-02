import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { ConnectorConfigComponent } from './connector-config.component';
import { TranslatePipe } from '@innait/i18n';
import { ConfirmationService, MessageService } from 'primeng/api';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('ConnectorConfigComponent', () => {
  let component: ConnectorConfigComponent;
  let fixture: ComponentFixture<ConnectorConfigComponent>;
  let httpTesting: HttpTestingController;

  const mockConnectors = [
    {
      id: 'conn-1',
      name: 'Corporate LDAP',
      type: 'LDAP' as const,
      status: 'ACTIVE' as const,
      lastSyncAt: '2026-03-20T10:00:00Z',
      config: {
        host: 'ldap.example.com',
        port: 389,
        baseDN: 'dc=example,dc=com',
        bindDN: 'cn=admin,dc=example,dc=com',
        bindPassword: 'secret',
        useSsl: false,
        connectionTimeout: 5000
      }
    },
    {
      id: 'conn-2',
      name: 'Email SMTP',
      type: 'EMAIL' as const,
      status: 'ACTIVE' as const,
      lastSyncAt: null,
      config: {
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        fromAddress: 'noreply@example.com',
        useTls: true,
        useStartTls: false
      }
    },
    {
      id: 'conn-3',
      name: 'Broken SCIM',
      type: 'SCIM' as const,
      status: 'ERROR' as const,
      lastSyncAt: '2026-02-01T00:00:00Z',
      config: {
        endpointUrl: 'https://api.broken.com/scim/v2',
        authType: 'BEARER',
        token: 'tok_abc123'
      }
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ConnectorConfigComponent,
        ReactiveFormsModule,
        FormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService
      ]
    })
    .overrideComponent(ConnectorConfigComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConnectorConfigComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/connectors');
    req.flush({ data: mockConnectors });

    expect(component).toBeTruthy();
  });

  it('should load existing connectors', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/connectors');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockConnectors });

    expect(component.loading).toBeFalse();
    expect(component.connectors.length).toBe(3);
    expect(component.connectors[0].name).toBe('Corporate LDAP');
    expect(component.connectors[0].type).toBe('LDAP');
    expect(component.connectors[0].status).toBe('ACTIVE');
    expect(component.connectors[1].name).toBe('Email SMTP');
    expect(component.connectors[1].type).toBe('EMAIL');
    expect(component.connectors[2].status).toBe('ERROR');
  });

  it('should show dynamic form based on connector type', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/connectors');
    loadReq.flush({ data: mockConnectors });

    // Open wizard and select LDAP type
    component.openWizard();
    expect(component.showWizard).toBeTrue();
    expect(component.activeStep).toBe(0);

    component.onSelectType('LDAP');
    expect(component.selectedType).toBe('LDAP');

    // Move to config step -- this builds the form for LDAP type
    component.nextStep();
    expect(component.activeStep).toBe(1);

    // Verify LDAP-specific form fields exist
    expect(component.configForm.get('name')).toBeTruthy();
    expect(component.configForm.get('host')).toBeTruthy();
    expect(component.configForm.get('port')).toBeTruthy();
    expect(component.configForm.get('baseDN')).toBeTruthy();
    expect(component.configForm.get('bindDN')).toBeTruthy();
    expect(component.configForm.get('bindPassword')).toBeTruthy();
    expect(component.configForm.get('useSsl')).toBeTruthy();
    expect(component.configForm.get('connectionTimeout')).toBeTruthy();

    // SCIM-specific fields should NOT exist on LDAP form
    expect(component.configForm.get('endpointUrl')).toBeNull();
    expect(component.configForm.get('token')).toBeNull();

    // Now test with EMAIL type - close and re-open
    component.onWizardClose();
    component.openWizard();
    component.onSelectType('EMAIL');
    component.nextStep();

    // Verify EMAIL-specific form fields
    expect(component.configForm.get('name')).toBeTruthy();
    expect(component.configForm.get('smtpHost')).toBeTruthy();
    expect(component.configForm.get('smtpPort')).toBeTruthy();
    expect(component.configForm.get('fromAddress')).toBeTruthy();
    expect(component.configForm.get('useTls')).toBeTruthy();
    expect(component.configForm.get('useStartTls')).toBeTruthy();

    // LDAP-specific fields should NOT exist on EMAIL form
    expect(component.configForm.get('baseDN')).toBeNull();
    expect(component.configForm.get('bindDN')).toBeNull();

    // EMAIL connector should have maxStep of 2 (no schedule step)
    expect(component.maxStep).toBe(2);
  });

  it('should test connection', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/connectors');
    loadReq.flush({ data: mockConnectors });

    // Open wizard, select type, fill form, advance to test step
    component.openWizard();
    component.onSelectType('LDAP');
    component.nextStep(); // to config step

    // Fill in required config fields
    component.configForm.patchValue({
      name: 'Test LDAP',
      host: 'ldap.test.com',
      port: 389,
      baseDN: 'dc=test,dc=com',
      bindDN: 'cn=admin,dc=test,dc=com',
      bindPassword: 'password123'
    });

    component.nextStep(); // to test step
    expect(component.activeStep).toBe(2);

    // Trigger test connection
    component.onTestConnection();
    expect(component.testing).toBeTrue();
    expect(component.testResult).toBeNull();

    const testReq = httpTesting.expectOne('/api/v1/admin/settings/connectors/test');
    expect(testReq.request.method).toBe('POST');
    expect(testReq.request.body.type).toBe('LDAP');
    expect(testReq.request.body.config).toBeTruthy();
    expect(testReq.request.body.config.host).toBe('ldap.test.com');

    // Respond with success
    testReq.flush({
      data: {
        success: true,
        message: 'Connection successful. Found 150 users and 12 groups.',
        details: { usersFound: 150, groupsFound: 12 }
      }
    });

    expect(component.testing).toBeFalse();
    expect(component.testResult).toBeTruthy();
    expect(component.testResult!.success).toBeTrue();
    expect(component.testResult!.message).toContain('Connection successful');
    expect(component.testResult!.details?.usersFound).toBe(150);
    expect(component.testResult!.details?.groupsFound).toBe(12);
  });
});
