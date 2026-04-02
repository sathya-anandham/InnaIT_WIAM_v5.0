import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { BulkOperationsComponent } from './bulk-operations.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string, ...args: any[]): string {
    return value;
  }
}

const mockAuthState = {
  token: 'mock-token',
  user: { id: 'admin-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
};

const mockSearchResults = {
  data: {
    content: [
      {
        id: 'acc-1',
        loginId: 'john.doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        department: 'Engineering',
        userType: 'EMPLOYEE',
      },
      {
        id: 'acc-2',
        loginId: 'jane.smith',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'ACTIVE',
        department: 'Marketing',
        userType: 'EMPLOYEE',
      },
    ],
    meta: {
      totalElements: 2,
      totalPages: 1,
      page: 0,
      size: 10,
    },
  },
};

describe('BulkOperationsComponent', () => {
  let component: BulkOperationsComponent;
  let fixture: ComponentFixture<BulkOperationsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    const mockAuthService = {
      getAuthState: () => of(mockAuthState),
      get currentState() { return mockAuthState; },
      get isAuthenticated() { return true; },
    };

    await TestBed.configureTestingModule({
      imports: [
        BulkOperationsComponent,
        NoopAnimationsModule,
        ReactiveFormsModule,
        FormsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: 'AuthService', useValue: mockAuthService },
      ],
    })
      .overrideComponent(BulkOperationsComponent, {
        remove: { imports: [MockTranslatePipe as any] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BulkOperationsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    // Flush initial departments load
    const deptReq = httpMock.match('/api/v1/admin/departments');
    deptReq.forEach((req) => req.flush({ data: [] }));
  });

  afterEach(() => {
    httpMock.verify();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
    expect(component.activeStep).toBe(0);
    expect(component.steps.length).toBe(4);
    expect(component.selectionMode).toBe('search');
  });

  it('should load users for search-and-select mode', fakeAsync(() => {
    // Verify the component starts in search mode
    expect(component.selectionMode).toBe('search');
    expect(component.searchResults.length).toBe(0);

    // Trigger search
    component.searchAccounts();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/v1/admin/users' && r.params.get('page') === '0',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('size')).toBe('10');

    req.flush(mockSearchResults);
    tick();

    expect(component.isSearching).toBeFalse();
    expect(component.searchResults.length).toBe(2);
    expect(component.searchTotalRecords).toBe(2);
    expect(component.searchResults[0].loginId).toBe('john.doe');
    expect(component.searchResults[1].loginId).toBe('jane.smith');

    // Verify search with filters
    component.searchFilters.status = 'ACTIVE';
    component.searchFilters.department = 'Engineering';
    component.searchAccounts();

    const filteredReq = httpMock.expectOne(
      (r) =>
        r.url === '/api/v1/admin/users' &&
        r.params.get('status') === 'ACTIVE' &&
        r.params.get('department') === 'Engineering',
    );
    filteredReq.flush(mockSearchResults);
    tick();

    expect(component.isSearching).toBeFalse();
  }));

  it('should require action selection and justification', () => {
    // Action form should exist and be invalid initially
    expect(component.actionForm).toBeDefined();
    expect(component.actionForm.get('action')!.value).toBeNull();
    expect(component.actionForm.get('reason')!.value).toBe('');

    // canProceedFromAction should be false when no action is selected
    expect(component.canProceedFromAction).toBeFalse();

    // Set action but no reason
    component.actionForm.get('action')!.setValue('SUSPEND');
    expect(component.canProceedFromAction).toBeFalse();

    // Set reason but too short (min 10 chars)
    component.actionForm.get('reason')!.setValue('short');
    component.actionForm.get('reason')!.markAsTouched();
    expect(component.actionForm.get('reason')!.hasError('minlength')).toBeTrue();
    expect(component.canProceedFromAction).toBeFalse();

    // Set valid reason
    component.actionForm.get('reason')!.setValue('This is a valid justification for the action');
    expect(component.actionForm.get('reason')!.valid).toBeTrue();
    expect(component.canProceedFromAction).toBeTrue();
  });

  it('should show warning for destructive actions', () => {
    // Non-destructive action
    component.actionForm.get('action')!.setValue('SUSPEND');
    expect(component.isDestructiveAction).toBeFalse();

    // Destructive action: DISABLE
    component.actionForm.get('action')!.setValue('DISABLE');
    expect(component.isDestructiveAction).toBeTrue();

    // Destructive action: TERMINATE
    component.actionForm.get('action')!.setValue('TERMINATE');
    expect(component.isDestructiveAction).toBeTrue();

    // Non-destructive action: ACTIVATE
    component.actionForm.get('action')!.setValue('ACTIVATE');
    expect(component.isDestructiveAction).toBeFalse();

    // Non-destructive action: FORCE_PASSWORD_CHANGE
    component.actionForm.get('action')!.setValue('FORCE_PASSWORD_CHANGE');
    expect(component.isDestructiveAction).toBeFalse();

    // Non-destructive action requiring input: ASSIGN_ROLE
    component.actionForm.get('action')!.setValue('ASSIGN_ROLE');
    expect(component.isDestructiveAction).toBeFalse();
    expect(component.selectedActionRequiresInput).toBe('ROLE');
  });

  it('should execute bulk operation and show results', fakeAsync(() => {
    // Set up selected accounts
    component.selectionMode = 'search';
    component.selectedAccounts = [
      {
        id: 'acc-1',
        loginId: 'john.doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        department: 'Engineering',
        userType: 'EMPLOYEE',
      },
      {
        id: 'acc-2',
        loginId: 'jane.smith',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'ACTIVE',
        department: 'Marketing',
        userType: 'EMPLOYEE',
      },
    ];

    // Set up action form
    component.actionForm.patchValue({
      action: 'SUSPEND',
      reason: 'Quarterly compliance review requires suspension of these accounts',
    });

    // Execute the operation
    component.executeOperation();
    expect(component.isExecuting).toBeTrue();

    const execReq = httpMock.expectOne('/api/v1/admin/users/bulk/operations');
    expect(execReq.request.method).toBe('POST');
    expect(execReq.request.body.action).toBe('SUSPEND');
    expect(execReq.request.body.accountIds).toEqual(['acc-1', 'acc-2']);
    expect(execReq.request.body.reason).toContain('Quarterly compliance review');

    execReq.flush({
      data: { jobId: 'job-789' },
    });
    tick();

    expect(component.isExecuting).toBeFalse();
    expect(component.operationJobId).toBe('job-789');
    expect(component.activeStep).toBe(3);

    // The component starts polling for job status
    expect(component.isPolling).toBeTrue();

    // Flush the polling request (first poll - timer fires at 0ms)
    const pollReq1 = httpMock.expectOne('/api/v1/admin/users/bulk/operations/job-789/status');
    pollReq1.flush({
      data: {
        status: 'COMPLETED',
        processed: 2,
        total: 2,
        succeeded: 2,
        failed: 0,
      },
    });
    tick();

    // Flush the results request
    const resultsReq = httpMock.expectOne('/api/v1/admin/users/bulk/operations/job-789/results');
    resultsReq.flush({
      data: [
        { accountId: 'acc-1', loginId: 'john.doe', outcome: 'SUCCESS', errorMessage: null },
        { accountId: 'acc-2', loginId: 'jane.smith', outcome: 'SUCCESS', errorMessage: null },
      ],
    });
    tick();

    expect(component.isPolling).toBeFalse();
    expect(component.operationResults.length).toBe(2);
    expect(component.operationSucceededCount).toBe(2);
    expect(component.operationFailedCount).toBe(0);
  }));
});
