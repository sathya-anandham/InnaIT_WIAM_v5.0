import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';

import { SecurityIncidentsComponent } from './security-incidents.component';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('SecurityIncidentsComponent', () => {
  let component: SecurityIncidentsComponent;
  let fixture: ComponentFixture<SecurityIncidentsComponent>;
  let httpTesting: HttpTestingController;

  const mockIncidents = {
    data: {
      content: [
        {
          id: 'inc-1',
          title: 'Brute Force Attack Detected',
          description: 'Multiple failed login attempts from IP 10.0.1.50',
          severity: 'CRITICAL' as const,
          status: 'OPEN' as const,
          reportedAt: '2025-05-01T08:00:00Z',
          resolvedAt: null,
          assignee: null,
          relatedEvents: ['evt-1', 'evt-2', 'evt-3']
        },
        {
          id: 'inc-2',
          title: 'Unusual Login Location',
          description: 'Login from unexpected region',
          severity: 'HIGH' as const,
          status: 'INVESTIGATING' as const,
          reportedAt: '2025-04-30T14:20:00Z',
          resolvedAt: null,
          assignee: 'admin@example.com',
          relatedEvents: ['evt-4']
        },
        {
          id: 'inc-3',
          title: 'Expired Certificate Access',
          description: 'Attempt to use expired certificate for service auth',
          severity: 'MEDIUM' as const,
          status: 'RESOLVED' as const,
          reportedAt: '2025-04-29T10:00:00Z',
          resolvedAt: '2025-04-29T12:30:00Z',
          assignee: 'secops@example.com',
          relatedEvents: []
        }
      ],
      meta: {
        totalElements: 3,
        totalPages: 1
      }
    }
  };

  const mockSummary = {
    data: {
      openBySeverity: {
        CRITICAL: 1,
        HIGH: 2,
        MEDIUM: 0,
        LOW: 0
      },
      avgResolutionTimeHours: 4.5
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityIncidentsComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
    .overrideComponent(SecurityIncidentsComponent, {
      remove: { imports: [TranslatePipe] },
      add: { imports: [MockTranslatePipe] }
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SecurityIncidentsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();
    const incReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents' && !req.url.includes('/summary'));
    incReq.flush(mockIncidents);
    const sumReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents/summary');
    sumReq.flush(mockSummary);
    expect(component).toBeTruthy();
  });

  it('should load and display incidents', fakeAsync(() => {
    fixture.detectChanges();
    const incReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents' && !req.url.includes('/summary'));
    incReq.flush(mockIncidents);
    const sumReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents/summary');
    sumReq.flush(mockSummary);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.incidents.length).toBe(3);
    expect(component.incidents[0].title).toBe('Brute Force Attack Detected');
    expect(component.incidents[0].severity).toBe('CRITICAL');
    expect(component.incidents[0].status).toBe('OPEN');
    expect(component.incidents[1].status).toBe('INVESTIGATING');
    expect(component.incidents[2].status).toBe('RESOLVED');
    expect(component.totalRecords).toBe(3);

    expect(component.summary).toBeTruthy();
    expect(component.summary!.openBySeverity['CRITICAL']).toBe(1);
    expect(component.summary!.avgResolutionTimeHours).toBe(4.5);
  }));

  it('should filter by severity', fakeAsync(() => {
    fixture.detectChanges();
    const incReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents' && !req.url.includes('/summary'));
    incReq.flush(mockIncidents);
    const sumReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents/summary');
    sumReq.flush(mockSummary);
    tick();

    // Apply severity filter
    component.filters.severity = 'CRITICAL';
    component.onFilterChange();

    // Expect new request with severity param
    const filteredReq = httpTesting.expectOne(req =>
      req.url === '/api/v1/admin/audit/incidents' &&
      !req.url.includes('/summary') &&
      req.params.get('severity') === 'CRITICAL'
    );
    filteredReq.flush({
      data: {
        content: [mockIncidents.data.content[0]],
        meta: { totalElements: 1, totalPages: 1 }
      }
    });
    tick();

    expect(component.incidents.length).toBe(1);
    expect(component.incidents[0].severity).toBe('CRITICAL');
    expect(component.currentPage).toBe(1);
  }));

  it('should update incident status', fakeAsync(() => {
    fixture.detectChanges();
    const incReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents' && !req.url.includes('/summary'));
    incReq.flush(mockIncidents);
    const sumReq = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents/summary');
    sumReq.flush(mockSummary);
    tick();

    // Open action dialog to resolve an incident
    const incident = component.incidents[1]; // INVESTIGATING incident
    component.openActionDialog('resolve', incident);

    expect(component.dialog.visible).toBeTrue();
    expect(component.dialog.type).toBe('resolve');
    expect(component.dialog.incident!.id).toBe('inc-2');

    // Set notes and submit
    component.dialog.notes = 'Issue verified and resolved';
    component.submitAction();

    expect(component.dialog.submitting).toBeTrue();

    const updateReq = httpTesting.expectOne(req =>
      req.method === 'PUT' && req.url === '/api/v1/admin/audit/incidents/inc-2'
    );
    expect(updateReq.request.body.status).toBe('RESOLVED');
    expect(updateReq.request.body.notes).toBe('Issue verified and resolved');
    expect(updateReq.request.body.resolvedAt).toBeTruthy();

    updateReq.flush({
      data: {
        ...incident,
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString()
      }
    });

    // After successful update, summary should be reloaded
    const sumReload = httpTesting.expectOne(req => req.url === '/api/v1/admin/audit/incidents/summary');
    sumReload.flush(mockSummary);
    tick();

    expect(component.dialog.visible).toBeFalse();
  }));
});
