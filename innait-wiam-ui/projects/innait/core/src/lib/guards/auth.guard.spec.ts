import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of, firstValueFrom } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { AuthState } from '../models/auth-state.model';

describe('authGuard', () => {
  const mockAuthService = {
    getAuthState: jasmine.createSpy('getAuthState'),
  };

  const loginUrlTree = { toString: () => '/login' } as UrlTree;

  const mockRouter = {
    createUrlTree: jasmine
      .createSpy('createUrlTree')
      .and.callFake((commands: string[]) => {
        if (commands[0] === '/login') {
          return loginUrlTree;
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

  it('should allow access when authenticated', async () => {
    const authState: AuthState = {
      status: 'AUTHENTICATED',
      roles: ['USER'],
      groups: [],
      amr: ['pwd'],
      acr: '1',
      sessionId: 'session-123',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const result = TestBed.runInInjectionContext(() => {
      return authGuard({} as any, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBeTrue();
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

    const result = TestBed.runInInjectionContext(() => {
      return authGuard({} as any, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(loginUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect to /login when session expired', async () => {
    const authState: AuthState = {
      status: 'SESSION_EXPIRED',
      roles: [],
      groups: [],
      amr: [],
      acr: '',
    };
    mockAuthService.getAuthState.and.returnValue(of(authState));

    const result = TestBed.runInInjectionContext(() => {
      return authGuard({} as any, {} as any);
    });

    const value = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(value).toBe(loginUrlTree);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
