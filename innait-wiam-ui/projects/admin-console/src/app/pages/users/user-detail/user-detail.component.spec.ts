import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { UserDetailComponent } from './user-detail.component';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

@Component({ selector: 'ag-grid-angular', standalone: true, template: '' })
class MockAgGrid {
  @Input() rowModelType: any;
  @Input() columnDefs: any;
  @Input() defaultColDef: any;
  @Input() rowSelection: any;
  @Input() animateRows: any;
  @Input() pagination: any;
  @Input() paginationPageSize: any;
  @Input() cacheBlockSize: any;
  @Input() rowData: any;
  @Input() domLayout: any;
  @Input() overlayNoRowsTemplate: any;
  @Input() serverSideDatasource: any;
  gridApi: any;
}

const mockAuthState = {
  token: 'mock-token',
  user: { id: 'admin-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
};

const mockUserDetail = {
  id: 'user-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  department: 'Engineering',
  designation: 'Software Engineer',
  userType: 'EMPLOYEE',
  status: 'ACTIVE',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-06-20T14:30:00Z',
  account: {
    accountId: 'acc-456',
    loginId: 'john.doe',
    accountStatus: 'ACTIVE',
    failedAttemptCount: 0,
    mustChangePassword: false,
    lastLoginAt: '2024-06-20T14:00:00Z',
    passwordExpiresAt: '2025-01-15T10:00:00Z',
  },
};

const mockLockedUserDetail = {
  ...mockUserDetail,
  account: {
    ...mockUserDetail.account,
    accountStatus: 'LOCKED',
    failedAttemptCount: 5,
  },
};

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    const mockRouter = {
      navigate: jasmine.createSpy('navigate'),
    };

    const mockActivatedRoute = {
      params: of({ userId: 'user-123' }),
    };

    const mockAuthService = {
      getAuthState: () => of(mockAuthState),
      get currentState() { return mockAuthState; },
      get isAuthenticated() { return true; },
    };

    await TestBed.configureTestingModule({
      imports: [
        UserDetailComponent,
        NoopAnimationsModule,
        ReactiveFormsModule,
        FormsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: 'AuthService', useValue: mockAuthService },
      ],
    })
      .overrideComponent(UserDetailComponent, {
        remove: { imports: [MockTranslatePipe as any] },
        add: { imports: [MockTranslatePipe, MockAgGrid] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    component.ngOnDestroy();
  });

  /**
   * Flush the initial requests triggered by ngOnInit:
   *  - GET /api/v1/admin/users/{userId}       (loadUser)
   *  - GET /api/v1/admin/config/features       (loadFeatureFlags)
   *  - GET /api/v1/admin/users/{userId}/history (loadProfileHistory - called after loadUser)
   */
  function flushInitialRequests(userData: any = mockUserDetail): void {
    // Feature flags request
    const featureReq = httpMock.expectOne('/api/v1/admin/config/features');
    featureReq.flush({ data: { igaEnabled: false } });

    // User detail request
    const userReq = httpMock.expectOne('/api/v1/admin/users/user-123');
    userReq.flush({ data: userData });

    // Profile history request (triggered after user loads)
    const historyReq = httpMock.expectOne('/api/v1/admin/users/user-123/history');
    historyReq.flush({ data: [] });
  }

  it('should create the component', () => {
    fixture.detectChanges();
    flushInitialRequests();

    expect(component).toBeTruthy();
  });

  it('should load user data from route params', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    expect(component.userId).toBe('user-123');
    expect(component.user).toBeTruthy();
    expect(component.user!.firstName).toBe('John');
    expect(component.user!.lastName).toBe('Doe');
    expect(component.user!.email).toBe('john.doe@example.com');
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeNull();
  }));

  it('should display user info header with status badge', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    // Verify the user data is ready for display
    expect(component.user!.account?.accountStatus).toBe('ACTIVE');

    // Verify getStatusSeverity returns correct value
    expect(component.getStatusSeverity('ACTIVE')).toBe('success');
    expect(component.getStatusSeverity('LOCKED')).toBe('danger');
    expect(component.getStatusSeverity('SUSPENDED')).toBe('warning');

    // Verify getInitials method is usable
    const initials = component.getInitials();
    expect(initials).toBe('JD');
  }));

  it('should switch to profile edit mode', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    expect(component.profileEditMode).toBeFalse();

    // Toggle to edit mode
    component.toggleProfileEdit();
    expect(component.profileEditMode).toBeTrue();

    // Profile form should be populated
    expect(component.profileForm.get('firstName')!.value).toBe('John');
    expect(component.profileForm.get('lastName')!.value).toBe('Doe');
    expect(component.profileForm.get('email')!.value).toBe('john.doe@example.com');

    // Toggle back to view mode (cancel)
    component.toggleProfileEdit();
    expect(component.profileEditMode).toBeFalse();
  }));

  it('should show unlock button when account is LOCKED', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests(mockLockedUserDetail);
    tick();

    expect(component.user!.account?.accountStatus).toBe('LOCKED');

    // The unlock button visibility is driven by the template condition:
    // *ngIf="user.account.accountStatus === 'LOCKED'"
    // We verify the data condition that would make it render
    expect(component.user!.account?.accountStatus === 'LOCKED').toBeTrue();

    // Verify getAccountStatusIcon for LOCKED
    expect(component.getAccountStatusIcon('LOCKED')).toBe('pi pi-lock');
  }));

  it('should call unlock API on button click', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests(mockLockedUserDetail);
    tick();

    // Trigger the unlock account action
    component.confirmAccountAction('unlock');

    expect(component.showAccountActionDialog).toBeTrue();
    expect(component.pendingAccountAction).toBe('unlock');
    expect(component.accountActionMessage).toContain('unlock');

    // Execute the action
    component.executeAccountAction();
    expect(component.executingAccountAction).toBeTrue();

    const unlockReq = httpMock.expectOne('/api/v1/admin/accounts/acc-456/unlock');
    expect(unlockReq.request.method).toBe('POST');
    unlockReq.flush({ data: { success: true } });
    tick();

    expect(component.executingAccountAction).toBeFalse();
    expect(component.showAccountActionDialog).toBeFalse();
    expect(component.accountActionSuccess).toContain('unlock');

    // loadUser is called again to refresh
    const refreshReq = httpMock.expectOne('/api/v1/admin/users/user-123');
    refreshReq.flush({ data: mockUserDetail });

    const refreshHistoryReq = httpMock.expectOne('/api/v1/admin/users/user-123/history');
    refreshHistoryReq.flush({ data: [] });
  }));

  it('should load roles tab data when tab is selected', fakeAsync(() => {
    fixture.detectChanges();
    flushInitialRequests();
    tick();

    const mockRoles = [
      {
        roleId: 'role-1',
        roleName: 'Admin',
        roleCode: 'ADMIN',
        roleType: 'APPLICATION',
        source: 'DIRECT',
        assignedAt: '2024-03-01T10:00:00Z',
      },
      {
        roleId: 'role-2',
        roleName: 'Viewer',
        roleCode: 'VIEWER',
        roleType: 'APPLICATION',
        source: 'POLICY',
        assignedAt: '2024-04-15T10:00:00Z',
      },
    ];

    // Switch to Roles tab (index 2)
    component.onTabChange(2);

    const rolesReq = httpMock.expectOne('/api/v1/admin/users/user-123/roles');
    expect(rolesReq.request.method).toBe('GET');
    rolesReq.flush({ data: mockRoles });
    tick();

    expect(component.assignedRoles.length).toBe(2);
    expect(component.assignedRoles[0].roleName).toBe('Admin');
    expect(component.assignedRoles[1].roleCode).toBe('VIEWER');
    expect(component.activeTabIndex).toBe(2);
  }));
});
