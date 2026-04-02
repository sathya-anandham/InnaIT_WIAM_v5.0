import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { TotpManagementComponent } from './totp-management.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('TotpManagementComponent', () => {
  let component: TotpManagementComponent;
  let fixture: ComponentFixture<TotpManagementComponent>;
  let httpTesting: HttpTestingController;

  const mockAuthState = {
    status: 'AUTHENTICATED',
    txnId: 'txn-001',
    loginId: 'testuser',
    roles: [],
    groups: [],
    amr: [],
    acr: '',
    sessionId: 'sess-001',
  };

  const mockAuthService = {
    currentState: mockAuthState,
    getAuthState: jasmine.createSpy('getAuthState').and.returnValue(of(mockAuthState)),
    isAuthenticated: true,
    clearState: jasmine.createSpy('clearState'),
  };

  beforeEach(async () => {
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [TotpManagementComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(TotpManagementComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(TotpManagementComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    // ngOnInit triggers loadTotpStatus which fires an HTTP GET
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/self/mfa/totp');
    req.flush({ enrolled: true, enrolledAt: '2025-06-15T10:30:00Z', lastUsedAt: '2025-06-20T14:00:00Z' });

    expect(component).toBeTruthy();
    expect(component.removeForm).toBeTruthy();
  });

  it('should load and display TOTP enrollment status', fakeAsync(() => {
    const mockStatus = {
      enrolled: true,
      enrolledAt: '2025-06-15T10:30:00Z',
      lastUsedAt: '2025-06-20T14:00:00Z',
    };

    fixture.detectChanges();
    expect(component.loading).toBeTrue();

    // Flush the GET request triggered by ngOnInit -> loadTotpStatus
    const req = httpTesting.expectOne('/api/v1/self/mfa/totp');
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.totpStatus).toEqual(mockStatus);
    expect(component.totpStatus!.enrolled).toBeTrue();
    expect(component.errorMessage).toBe('');

    fixture.detectChanges();

    // Enrolled section should be visible
    const enrolledSection = (fixture.nativeElement as HTMLElement).querySelector('.enrolled-section');
    expect(enrolledSection).toBeTruthy();

    // Status badge should show enrolled
    const statusBadge = (fixture.nativeElement as HTMLElement).querySelector('.status-badge.enrolled');
    expect(statusBadge).toBeTruthy();

    // Detail grid should show enrollment date and last used date
    const detailItems = (fixture.nativeElement as HTMLElement).querySelectorAll('.detail-item');
    expect(detailItems.length).toBe(2);
  }));

  it('should show "not enrolled" state when not enrolled', fakeAsync(() => {
    const mockNotEnrolled = {
      enrolled: false,
      enrolledAt: '',
      lastUsedAt: '',
    };

    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/v1/self/mfa/totp');
    req.flush(mockNotEnrolled);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.totpStatus).toEqual(mockNotEnrolled);
    expect(component.totpStatus!.enrolled).toBeFalse();

    fixture.detectChanges();

    // Not enrolled section should be visible
    const notEnrolledSection = (fixture.nativeElement as HTMLElement).querySelector('.not-enrolled-section');
    expect(notEnrolledSection).toBeTruthy();

    // Empty state should be shown
    const emptyState = (fixture.nativeElement as HTMLElement).querySelector('.empty-state');
    expect(emptyState).toBeTruthy();

    // Enrolled section should NOT be visible
    const enrolledSection = (fixture.nativeElement as HTMLElement).querySelector('.enrolled-section');
    expect(enrolledSection).toBeFalsy();
  }));

  it('should open remove dialog and submit with password', fakeAsync(() => {
    fixture.detectChanges();

    // Flush initial status load
    const statusReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    statusReq.flush({ enrolled: true, enrolledAt: '2025-06-15T10:30:00Z', lastUsedAt: '2025-06-20T14:00:00Z' });
    tick();
    fixture.detectChanges();

    // Initially dialog should be hidden
    expect(component.removeDialogVisible).toBeFalse();

    // Open the remove dialog
    component.showRemoveDialog();
    expect(component.removeDialogVisible).toBeTrue();
    expect(component.removeErrorMessage).toBe('');

    // Fill in the password
    component.removeForm.get('password')?.setValue('MyS3cureP@ss');
    expect(component.removeForm.valid).toBeTrue();

    // Confirm removal
    component.confirmRemove();
    expect(component.removing).toBeTrue();

    // Flush the DELETE request
    const deleteReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.body).toEqual({ password: 'MyS3cureP@ss' });
    deleteReq.flush({});

    // After DELETE success, loadTotpStatus is called again
    const refreshReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    expect(refreshReq.request.method).toBe('GET');
    refreshReq.flush({ enrolled: false, enrolledAt: '', lastUsedAt: '' });
    tick();

    expect(component.removing).toBeFalse();
    expect(component.removeDialogVisible).toBeFalse();
    expect(component.successMessage).toContain('removed successfully');
  }));

  it('should handle removal API success and refresh status', fakeAsync(() => {
    fixture.detectChanges();

    // Flush initial status load (enrolled)
    const statusReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    statusReq.flush({ enrolled: true, enrolledAt: '2025-06-15T10:30:00Z', lastUsedAt: '' });
    tick();
    fixture.detectChanges();

    // Open dialog and submit
    component.showRemoveDialog();
    component.removeForm.get('password')?.setValue('password123');
    component.confirmRemove();

    // Flush the DELETE
    const deleteReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({});

    // After deletion, component reloads status
    const refreshReq = httpTesting.expectOne('/api/v1/self/mfa/totp');
    expect(refreshReq.request.method).toBe('GET');
    refreshReq.flush({ enrolled: false, enrolledAt: '', lastUsedAt: '' });
    tick();

    expect(component.removing).toBeFalse();
    expect(component.removeDialogVisible).toBeFalse();
    expect(component.successMessage).toBeTruthy();

    // Status should now reflect not-enrolled
    expect(component.totpStatus!.enrolled).toBeFalse();

    fixture.detectChanges();

    // UI should now show the not-enrolled section
    const notEnrolledSection = (fixture.nativeElement as HTMLElement).querySelector('.not-enrolled-section');
    expect(notEnrolledSection).toBeTruthy();

    const enrolledSection = (fixture.nativeElement as HTMLElement).querySelector('.enrolled-section');
    expect(enrolledSection).toBeFalsy();
  }));
});
