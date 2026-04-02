import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { Pipe, PipeTransform } from '@angular/core';
import { of } from 'rxjs';

import { FidoManagementComponent } from './fido-management.component';
import { AuthService } from '@innait/core';
import { TranslatePipe } from '@innait/i18n';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

describe('FidoManagementComponent', () => {
  let component: FidoManagementComponent;
  let fixture: ComponentFixture<FidoManagementComponent>;
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

  const mockKeys = [
    {
      credentialId: 'cred-abc-123',
      nickname: 'My YubiKey',
      registeredAt: '2025-03-10T09:15:00Z',
      lastUsedAt: '2025-06-20T14:00:00Z',
      aaguid: 'aaguid-001',
    },
    {
      credentialId: 'cred-def-456',
      nickname: 'Backup Key',
      registeredAt: '2025-04-22T11:30:00Z',
      lastUsedAt: '',
      aaguid: 'aaguid-002',
    },
  ];

  beforeEach(async () => {
    mockAuthService.getAuthState.calls.reset();
    mockAuthService.clearState.calls.reset();

    await TestBed.configureTestingModule({
      imports: [FidoManagementComponent, NoopAnimationsModule, FormsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(FidoManagementComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(FidoManagementComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    component.ngOnDestroy();
  });

  it('should create the component', () => {
    fixture.detectChanges();

    // Flush the initial GET request triggered by ngOnInit -> loadKeys
    const req = httpTesting.expectOne('/api/v1/self/mfa/fido/keys');
    req.flush(mockKeys);

    expect(component).toBeTruthy();
    expect(component.removeForm).toBeTruthy();
  });

  it('should load and display registered FIDO keys in table', fakeAsync(() => {
    fixture.detectChanges();
    expect(component.loading).toBeTrue();

    // Flush the GET request
    const req = httpTesting.expectOne('/api/v1/self/mfa/fido/keys');
    expect(req.request.method).toBe('GET');
    req.flush(mockKeys);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.keys.length).toBe(2);
    expect(component.errorMessage).toBe('');

    // Verify row data is correctly mapped with transient UI state
    expect(component.keys[0].credentialId).toBe('cred-abc-123');
    expect(component.keys[0].nickname).toBe('My YubiKey');
    expect(component.keys[0].editing).toBeFalse();
    expect(component.keys[0].saving).toBeFalse();
    expect(component.keys[1].credentialId).toBe('cred-def-456');
    expect(component.keys[1].nickname).toBe('Backup Key');

    fixture.detectChanges();

    // Table should be visible
    const tableContainer = (fixture.nativeElement as HTMLElement).querySelector('.keys-table-container');
    expect(tableContainer).toBeTruthy();

    // Empty state should NOT be visible
    const emptyState = (fixture.nativeElement as HTMLElement).querySelector('.empty-state');
    expect(emptyState).toBeFalsy();
  }));

  it('should show empty state when no keys registered', fakeAsync(() => {
    fixture.detectChanges();

    // Flush with empty array
    const req = httpTesting.expectOne('/api/v1/self/mfa/fido/keys');
    req.flush([]);
    tick();

    expect(component.loading).toBeFalse();
    expect(component.keys.length).toBe(0);

    fixture.detectChanges();

    // Empty state should be visible
    const emptyState = (fixture.nativeElement as HTMLElement).querySelector('.empty-state');
    expect(emptyState).toBeTruthy();

    // Table container should NOT be visible
    const tableContainer = (fixture.nativeElement as HTMLElement).querySelector('.keys-table-container');
    expect(tableContainer).toBeFalsy();

    // Register link should be visible in empty state
    const registerLink = emptyState?.querySelector('a[routerLink="/mfa/fido"]');
    expect(registerLink).toBeTruthy();
  }));

  it('should enable inline rename and save via PUT', fakeAsync(() => {
    fixture.detectChanges();

    // Flush initial load
    const loadReq = httpTesting.expectOne('/api/v1/self/mfa/fido/keys');
    loadReq.flush(mockKeys);
    tick();
    fixture.detectChanges();

    // Start editing the first key
    component.startEdit(component.keys[0]);
    expect(component.keys[0].editing).toBeTrue();
    expect(component.keys[0].editNickname).toBe('My YubiKey');

    // Change the nickname
    component.keys[0].editNickname = 'Renamed YubiKey';

    // Save the nickname
    component.saveNickname(component.keys[0]);
    expect(component.keys[0].saving).toBeTrue();

    // Flush the PUT request
    const putReq = httpTesting.expectOne('/api/v1/self/mfa/fido/keys/cred-abc-123');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ nickname: 'Renamed YubiKey' });
    putReq.flush({ success: true });
    tick();

    // After success
    expect(component.keys[0].saving).toBeFalse();
    expect(component.keys[0].editing).toBeFalse();
    expect(component.keys[0].nickname).toBe('Renamed YubiKey');
    expect(component.successMessage).toContain('Renamed YubiKey');
  }));

  it('should open remove dialog and call DELETE on confirm', fakeAsync(() => {
    fixture.detectChanges();

    // Flush initial load
    const loadReq = httpTesting.expectOne('/api/v1/self/mfa/fido/keys');
    loadReq.flush(mockKeys);
    tick();
    fixture.detectChanges();

    expect(component.keys.length).toBe(2);

    // Open remove dialog for the second key
    component.showRemoveDialog(component.keys[1]);
    expect(component.removeDialogVisible).toBeTrue();
    expect(component.keyToRemove).toBeTruthy();
    expect(component.keyToRemove!.credentialId).toBe('cred-def-456');
    expect(component.keyToRemove!.nickname).toBe('Backup Key');
    expect(component.removeErrorMessage).toBe('');

    // Fill in confirmation password
    component.removeForm.get('password')?.setValue('ConfirmP@ss');
    expect(component.removeForm.valid).toBeTrue();

    // Confirm removal
    component.confirmRemove();
    expect(component.removing).toBeTrue();

    // Flush the DELETE request
    const deleteReq = httpTesting.expectOne('/api/v1/self/mfa/fido/keys/cred-def-456');
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.body).toEqual({ password: 'ConfirmP@ss' });
    deleteReq.flush({});
    tick();

    // After success
    expect(component.removing).toBeFalse();
    expect(component.removeDialogVisible).toBeFalse();
    expect(component.successMessage).toContain('Backup Key');
    expect(component.successMessage).toContain('removed successfully');

    // Key should be removed from the local array (no re-fetch, component filters inline)
    expect(component.keys.length).toBe(1);
    expect(component.keys[0].credentialId).toBe('cred-abc-123');
  }));
});
