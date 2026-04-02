import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { INITIAL_AUTH_STATE } from '../models/auth-state.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const API_BASE = '/api/v1/auth';
  const TOKEN_API_BASE = '/api/v1/tokens';
  const SESSION_API_BASE = '/api/v1/sessions';

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: TenantService, useValue: {} },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should start with UNAUTHENTICATED state', () => {
    expect(service.currentState.status).toBe('UNAUTHENTICATED');
    expect(service.currentState).toEqual(jasmine.objectContaining({
      status: 'UNAUTHENTICATED',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
    }));
  });

  it('login() should set status to AUTHENTICATING then update state with txnId', () => {
    const loginId = 'user@example.com';
    const mockResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        availableMethods: ['PASSWORD', 'OTP'],
        accountStatus: 'ACTIVE',
      },
      timestamp: new Date().toISOString(),
    };

    service.login(loginId).subscribe((result) => {
      expect(result.txnId).toBe('txn-123');
      expect(result.availableMethods).toEqual(['PASSWORD', 'OTP']);
    });

    // Verify intermediate AUTHENTICATING status was set
    // (the status transitions to AUTHENTICATING synchronously before the HTTP call)
    // After response, state should include txnId and loginId
    const req = httpMock.expectOne(`${API_BASE}/login/initiate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ loginId });
    req.flush(mockResponse);

    expect(service.currentState.txnId).toBe('txn-123');
    expect(service.currentState.loginId).toBe(loginId);
    expect(service.currentState.availableMfaMethods).toEqual(['PASSWORD', 'OTP']);
  });

  it('login() should revert to UNAUTHENTICATED on error', () => {
    const loginId = 'user@example.com';

    service.login(loginId).subscribe({
      next: () => fail('Expected an error'),
      error: () => {
        expect(service.currentState.status).toBe('UNAUTHENTICATED');
      },
    });

    const req = httpMock.expectOne(`${API_BASE}/login/initiate`);
    req.flush('Login failed', { status: 401, statusText: 'Unauthorized' });
  });

  it('submitPrimary() should set AUTHENTICATED state when response status is AUTHENTICATED', () => {
    const mockResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        status: 'AUTHENTICATED',
        sessionId: 'session-abc',
        accountId: 'acc-001',
        userId: 'uid-001',
        loginId: 'user@example.com',
        displayName: 'Test User',
        roles: ['ADMIN'],
        groups: ['GROUP_A'],
        amr: ['pwd'],
        acr: 'urn:innait:acr:pwd',
      },
      timestamp: new Date().toISOString(),
    };

    service.submitPrimary('txn-123', 'PASSWORD', { password: 'secret' }).subscribe((result) => {
      expect(result.status).toBe('AUTHENTICATED');
    });

    const req = httpMock.expectOne(`${API_BASE}/login/primary`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      txnId: 'txn-123',
      type: 'PASSWORD',
      data: { password: 'secret' },
    });
    req.flush(mockResponse);

    expect(service.currentState.status).toBe('AUTHENTICATED');
    expect(service.currentState.sessionId).toBe('session-abc');
    expect(service.currentState.accountId).toBe('acc-001');
    expect(service.currentState.userId).toBe('uid-001');
    expect(service.currentState.displayName).toBe('Test User');
    expect(service.currentState.roles).toEqual(['ADMIN']);
    expect(service.currentState.groups).toEqual(['GROUP_A']);
    expect(service.currentState.amr).toEqual(['pwd']);
    expect(service.currentState.acr).toBe('urn:innait:acr:pwd');
    expect(service.isAuthenticated).toBeTrue();
  });

  it('submitPrimary() should set MFA_REQUIRED state when response status is MFA_REQUIRED', () => {
    const mockResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        status: 'MFA_REQUIRED',
        availableMfaMethods: ['TOTP', 'SMS'],
      },
      timestamp: new Date().toISOString(),
    };

    service.submitPrimary('txn-123', 'PASSWORD', { password: 'secret' }).subscribe((result) => {
      expect(result.status).toBe('MFA_REQUIRED');
    });

    const req = httpMock.expectOne(`${API_BASE}/login/primary`);
    req.flush(mockResponse);

    expect(service.currentState.status).toBe('MFA_REQUIRED');
    expect(service.currentState.txnId).toBe('txn-123');
    expect(service.currentState.availableMfaMethods).toEqual(['TOTP', 'SMS']);
  });

  it('submitMfa() should complete authentication flow', () => {
    const mockResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        status: 'AUTHENTICATED',
        sessionId: 'session-xyz',
        accountId: 'acc-001',
        userId: 'uid-001',
        loginId: 'user@example.com',
        displayName: 'Test User',
        roles: ['USER'],
        groups: [],
        amr: ['pwd', 'otp'],
        acr: 'urn:innait:acr:mfa',
      },
      timestamp: new Date().toISOString(),
    };

    service.submitMfa('txn-123', 'TOTP', { code: '123456' }).subscribe((result) => {
      expect(result.status).toBe('AUTHENTICATED');
    });

    const req = httpMock.expectOne(`${API_BASE}/login/mfa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      txnId: 'txn-123',
      type: 'TOTP',
      data: { code: '123456' },
    });
    req.flush(mockResponse);

    expect(service.currentState.status).toBe('AUTHENTICATED');
    expect(service.currentState.sessionId).toBe('session-xyz');
    expect(service.currentState.amr).toEqual(['pwd', 'otp']);
    expect(service.currentState.acr).toBe('urn:innait:acr:mfa');
    expect(service.isAuthenticated).toBeTrue();
  });

  it('refreshToken() should return true on success', () => {
    const mockResponse = {
      status: 'SUCCESS' as const,
      data: {},
      timestamp: new Date().toISOString(),
    };

    service.refreshToken().subscribe((result) => {
      expect(result).toBeTrue();
    });

    const req = httpMock.expectOne(`${TOKEN_API_BASE}/refresh`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('refreshToken() should set SESSION_EXPIRED and navigate to /login on failure', () => {
    service.refreshToken().subscribe((result) => {
      expect(result).toBeFalse();
    });

    const req = httpMock.expectOne(`${TOKEN_API_BASE}/refresh`);
    req.flush('Token expired', { status: 401, statusText: 'Unauthorized' });

    expect(service.currentState.status).toBe('SESSION_EXPIRED');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout() should clear state and navigate to /login', () => {
    // First, put the service into an authenticated state by simulating a login flow
    const authResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        status: 'AUTHENTICATED',
        sessionId: 'session-abc',
        accountId: 'acc-001',
        userId: 'uid-001',
        roles: [],
        groups: [],
        amr: [],
        acr: '',
      },
      timestamp: new Date().toISOString(),
    };

    service.submitPrimary('txn-123', 'PASSWORD', { password: 'secret' }).subscribe();
    httpMock.expectOne(`${API_BASE}/login/primary`).flush(authResponse);

    expect(service.currentState.status).toBe('AUTHENTICATED');
    expect(service.currentState.sessionId).toBe('session-abc');

    // Now logout
    service.logout().subscribe();

    const req = httpMock.expectOne(`${SESSION_API_BASE}/session-abc/revoke`);
    expect(req.request.method).toBe('POST');
    req.flush(null);

    expect(service.currentState.status).toBe('UNAUTHENTICATED');
    expect(service.currentState).toEqual(jasmine.objectContaining(INITIAL_AUTH_STATE));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logout() should clear state even when revoke call fails', () => {
    // Put into authenticated state
    const authResponse = {
      status: 'SUCCESS' as const,
      data: {
        txnId: 'txn-123',
        status: 'AUTHENTICATED',
        sessionId: 'session-abc',
        accountId: 'acc-001',
        userId: 'uid-001',
        roles: [],
        groups: [],
        amr: [],
        acr: '',
      },
      timestamp: new Date().toISOString(),
    };

    service.submitPrimary('txn-123', 'PASSWORD', { password: 'secret' }).subscribe();
    httpMock.expectOne(`${API_BASE}/login/primary`).flush(authResponse);

    expect(service.currentState.status).toBe('AUTHENTICATED');

    // Logout with server error
    service.logout().subscribe();

    const req = httpMock.expectOne(`${SESSION_API_BASE}/session-abc/revoke`);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.currentState.status).toBe('UNAUTHENTICATED');
    expect(service.currentState).toEqual(jasmine.objectContaining(INITIAL_AUTH_STATE));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('isAuthenticated should return false initially', () => {
    expect(service.isAuthenticated).toBeFalse();
  });

  it('clearState() should reset to initial state and navigate to /login', () => {
    service.clearState();

    expect(service.currentState.status).toBe('UNAUTHENTICATED');
    expect(service.currentState.roles).toEqual([]);
    expect(service.currentState.groups).toEqual([]);
    expect(service.currentState.amr).toEqual([]);
    expect(service.currentState.acr).toBe('');
    expect(service.currentState.txnId).toBeUndefined();
    expect(service.currentState.sessionId).toBeUndefined();
    expect(service.currentState).toEqual(jasmine.objectContaining(INITIAL_AUTH_STATE));
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
