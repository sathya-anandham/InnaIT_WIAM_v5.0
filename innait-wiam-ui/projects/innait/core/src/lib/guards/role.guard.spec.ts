import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of, firstValueFrom } from 'rxjs';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { AuthState } from '../models/auth-state.model';

describe('roleGuard', () => {
  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState'),
  };

  const loginUrlTree = { toString: () => '/login' } as UrlTree;
  const forbiddenUrlTree = { toString: () => '/forbidden' } as UrlTree;

  const mockRouter = {
    createUrlTree: jasmine
      .createSpy('createUrlTree')
      .and.callFake((commands: string[]) => {
        if (commands[0] === '/login') {
          return loginUrlTree;
        }
        if (commands[0] === '/forbidden') {
          return forbiddenUrlTree;
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

  it('should allow access when user has required role', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['ADMIN'],
      groups: [],
      amr: ['pwd'],
      acr: '1',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: { roles: ['ADMIN'] },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return roleGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBeTrue();
  });

  it('should redirect to /forbidden when user lacks required role', async () => {
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
      data: { roles: ['ADMIN'] },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return roleGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(forbiddenUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/forbidden']);
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
      data: { roles: ['ADMIN'] },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return roleGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(loginUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should allow if user has any of the required roles', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['MANAGER'],
      groups: [],
      amr: ['pwd'],
      acr: '1',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const mockRoute = {
      data: { roles: ['ADMIN', 'MANAGER', 'SUPERUSER'] },
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => {
      return roleGuard(mockRoute, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBeTrue();
  });
});
