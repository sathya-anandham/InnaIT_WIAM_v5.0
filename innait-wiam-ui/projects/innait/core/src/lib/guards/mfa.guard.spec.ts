import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of, firstValueFrom } from 'rxjs';
import { mfaGuard } from './mfa.guard';
import { AuthService } from '../services/auth.service';
import { AuthState } from '../models/auth-state.model';

describe('mfaGuard', () => {
  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState'),
  };

  const loginUrlTree = { toString: () => '/login' } as UrlTree;
  const mfaSelectUrlTree = {
    toString: () => '/login/mfa-select',
  } as UrlTree;

  const mockRouter = {
    createUrlTree: jasmine
      .createSpy('createUrlTree')
      .and.callFake((commands: string[], extras?: any) => {
        if (commands[0] === '/login' && commands.length === 1) {
          return loginUrlTree;
        }
        if (commands[0] === '/login/mfa-select') {
          return mfaSelectUrlTree;
        }
        return { toString: () => commands.join('/') } as UrlTree;
      }),
    navigate: jasmine.createSpy('navigate'),
  };

  beforeEach(() => {
    mockAuthService.getAuthState.calls.reset();
    mockRouter.createUrlTree.calls.reset();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow access when ACR meets requirement', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['USER'],
      groups: [],
      amr: ['pwd', 'otp'],
      acr: '3',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: { minAcrLevel: 2 },
      url: [{ path: 'secure-page' }],
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return mfaGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBeTrue();
  });

  it('should redirect to /login/mfa-select when ACR is insufficient', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['USER'],
      groups: [],
      amr: ['pwd'],
      acr: '1',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: { minAcrLevel: 3 },
      url: [{ path: 'high-security' }],
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return mfaGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(mfaSelectUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(
      ['/login/mfa-select'],
      { queryParams: { returnUrl: mockRoute.url.toString() } }
    );
  });

  it('should redirect to /login when not authenticated', async () => {
    const authState: AuthState = {
      status: 'UNAUTHENTICATED',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: { minAcrLevel: 2 },
      url: [{ path: 'secure-page' }],
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return mfaGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(loginUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should default to minAcrLevel 2 when not specified in route data', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['USER'],
      groups: [],
      amr: ['pwd'],
      acr: '1',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: {},
      url: [{ path: 'secure-page' }],
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return mfaGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    // ACR is 1 which is less than default minAcrLevel of 2, so should redirect
    expect(value).toBe(mfaSelectUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(
      ['/login/mfa-select'],
      { queryParams: { returnUrl: mockRoute.url.toString() } }
    );
  });
});
