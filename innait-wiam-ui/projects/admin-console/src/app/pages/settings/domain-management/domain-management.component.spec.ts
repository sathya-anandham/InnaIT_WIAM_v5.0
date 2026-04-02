import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { DomainManagementComponent } from './domain-management.component';
import { TranslatePipe } from '@innait/i18n';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Clipboard } from '@angular/cdk/clipboard';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('DomainManagementComponent', () => {
  let component: DomainManagementComponent;
  let fixture: ComponentFixture<DomainManagementComponent>;
  let httpTesting: HttpTestingController;

  const mockDomains = [
    {
      id: 'dom-1',
      domain: 'example.com',
      status: 'VERIFIED' as const,
      verifiedAt: '2026-01-10T08:00:00Z',
      dnsRecordType: 'TXT',
      dnsRecordValue: 'innait-verify=abc123',
      createdAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'dom-2',
      domain: 'pending.com',
      status: 'PENDING' as const,
      verifiedAt: null,
      dnsRecordType: 'TXT',
      dnsRecordValue: 'innait-verify=def456',
      createdAt: '2026-03-15T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DomainManagementComponent,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        MessageService,
        Clipboard
      ]
    })
    .overrideComponent(DomainManagementComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DomainManagementComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/domains');
    req.flush({ data: mockDomains });

    expect(component).toBeTruthy();
  });

  it('should load domains on init', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/admin/settings/domains');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockDomains });

    expect(component.loading).toBeFalse();
    expect(component.domains.length).toBe(2);
    expect(component.domains[0].domain).toBe('example.com');
    expect(component.domains[0].status).toBe('VERIFIED');
    expect(component.domains[1].domain).toBe('pending.com');
    expect(component.domains[1].status).toBe('PENDING');
  });

  it('should add new domain and show DNS instructions', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/domains');
    loadReq.flush({ data: mockDomains });

    // Fill in the add domain form
    component.addDomainForm.patchValue({ domain: 'newdomain.com' });
    component.addDomainForm.markAllAsTouched();
    expect(component.addDomainForm.valid).toBeTrue();

    // Trigger add domain
    component.onAddDomain();
    expect(component.addingDomain).toBeTrue();

    const addReq = httpTesting.expectOne('/api/v1/admin/settings/domains');
    expect(addReq.request.method).toBe('POST');
    expect(addReq.request.body.domain).toBe('newdomain.com');

    const newDomain = {
      id: 'dom-3',
      domain: 'newdomain.com',
      status: 'PENDING' as const,
      verifiedAt: null,
      dnsRecordType: 'TXT',
      dnsRecordValue: 'innait-verify=xyz789',
      createdAt: '2026-04-03T00:00:00Z'
    };
    addReq.flush({ data: newDomain });

    expect(component.addingDomain).toBeFalse();
    expect(component.domains.length).toBe(3);
    expect(component.showAddDialog).toBeFalse();

    // DNS instructions should be shown
    expect(component.showDnsDialog).toBeTrue();
    expect(component.dnsRecord).toBeTruthy();
    expect(component.dnsRecord!.recordType).toBe('TXT');
    expect(component.dnsRecord!.recordName).toBe('_innait-verify.newdomain.com');
    expect(component.dnsRecord!.recordValue).toBe('innait-verify=xyz789');
  });

  it('should verify a pending domain', () => {
    fixture.detectChanges();

    const loadReq = httpTesting.expectOne('/api/v1/admin/settings/domains');
    loadReq.flush({ data: mockDomains });

    const pendingDomain = component.domains[1]; // pending.com
    expect(pendingDomain.status).toBe('PENDING');

    // Trigger verification
    component.onVerify(pendingDomain);
    expect(component.verifyingDomainId).toBe('dom-2');

    const verifyReq = httpTesting.expectOne('/api/v1/admin/settings/domains/dom-2/verify');
    expect(verifyReq.request.method).toBe('POST');

    const verifiedDomain = {
      ...pendingDomain,
      status: 'VERIFIED' as const,
      verifiedAt: '2026-04-03T12:00:00Z'
    };
    verifyReq.flush({ data: verifiedDomain });

    expect(component.verifyingDomainId).toBeNull();
    expect(component.domains[1].status).toBe('VERIFIED');
    expect(component.domains[1].verifiedAt).toBe('2026-04-03T12:00:00Z');
  });
});
