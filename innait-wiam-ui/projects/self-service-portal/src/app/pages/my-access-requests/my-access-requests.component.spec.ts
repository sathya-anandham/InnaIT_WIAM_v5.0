import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

import { MyAccessRequestsComponent } from './my-access-requests.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('MyAccessRequestsComponent', () => {
  let component: MyAccessRequestsComponent;
  let fixture: ComponentFixture<MyAccessRequestsComponent>;
  let httpMock: HttpTestingController;

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

  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    get currentState() {
      return mockAuthState;
    },
  };

  const mockRouter = {
    navigate: jasmine.createSpy('navigate'),
  };

  const mockAccessRequests = {
    content: [
      {
        id: 'req-1',
        requestType: 'ROLE',
        resourceName: 'Admin Role',
        status: 'PENDING',
        justification: 'Need admin access for deployments',
        submittedAt: '2025-04-03T08:00:00Z',
        reviewedAt: null,
        reviewerNotes: null,
        startDate: null,
        endDate: null,
      },
      {
        id: 'req-2',
        requestType: 'GROUP',
        resourceName: 'Engineering Team',
        status: 'APPROVED',
        justification: 'Joining the engineering department',
        submittedAt: '2025-03-28T10:00:00Z',
        reviewedAt: '2025-03-29T09:00:00Z',
        reviewerNotes: 'Approved by manager',
        startDate: '2025-04-01',
        endDate: null,
      },
      {
        id: 'req-3',
        requestType: 'ENTITLEMENT',
        resourceName: 'Database Read Access',
        status: 'REJECTED',
        justification: 'Need to view reporting data',
        submittedAt: '2025-03-20T14:00:00Z',
        reviewedAt: '2025-03-21T11:00:00Z',
        reviewerNotes: 'Access not justified for this role.',
        startDate: null,
        endDate: null,
      },
    ],
    meta: {
      page: 0,
      size: 20,
      totalElements: 3,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MyAccessRequestsComponent,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    })
      .overrideComponent(MyAccessRequestsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MyAccessRequestsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/access-requests');
    req.flush(mockAccessRequests);

    expect(component).toBeTruthy();
  });

  it('should load and display access requests in table', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/access-requests');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(mockAccessRequests);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.requests.length).toBe(3);
    expect(component.totalRecords).toBe(3);
    expect(component.requests[0].resourceName).toBe('Admin Role');
    expect(component.requests[1].status).toBe('APPROVED');
    expect(component.requests[2].requestType).toBe('ENTITLEMENT');
  }));

  it('should show cancel button only for PENDING requests', fakeAsync(() => {
    fixture.detectChanges();

    const req = httpMock.expectOne(r => r.url === '/api/v1/self/access-requests');
    req.flush(mockAccessRequests);
    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Only the PENDING request (req-1) should have a cancel button
    const cancelButtons = compiled.querySelectorAll('button[icon="pi pi-times"]');
    expect(cancelButtons.length).toBe(1);

    // Verify it corresponds to the PENDING request
    const pendingRequest = component.requests.find(r => r.status === 'PENDING');
    expect(pendingRequest).toBeTruthy();
    expect(pendingRequest!.id).toBe('req-1');

    // Non-pending requests should not have cancel buttons
    const approvedRequest = component.requests.find(r => r.status === 'APPROVED');
    expect(approvedRequest!.status).not.toBe('PENDING');
    const rejectedRequest = component.requests.find(r => r.status === 'REJECTED');
    expect(rejectedRequest!.status).not.toBe('PENDING');
  }));

  it('should filter by status', fakeAsync(() => {
    fixture.detectChanges();

    const initialReq = httpMock.expectOne(r => r.url === '/api/v1/self/access-requests');
    initialReq.flush(mockAccessRequests);
    tick();

    // Change status filter to PENDING
    component.selectedStatus = 'PENDING';
    component.onStatusFilterChange();

    const filteredReq = httpMock.expectOne(r =>
      r.url === '/api/v1/self/access-requests' && r.params.get('status') === 'PENDING'
    );
    expect(filteredReq.request.method).toBe('GET');
    expect(filteredReq.request.params.get('status')).toBe('PENDING');
    expect(filteredReq.request.params.get('page')).toBe('0');

    filteredReq.flush({
      content: [mockAccessRequests.content[0]],
      meta: { page: 0, size: 20, totalElements: 1, totalPages: 1 },
    });
    tick();

    expect(component.requests.length).toBe(1);
    expect(component.requests[0].status).toBe('PENDING');
    expect(component.totalRecords).toBe(1);
  }));
});
