import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { AuthState, AuthStatus, INITIAL_AUTH_STATE } from '../models/auth-state.model';
import { TenantService } from './tenant.service';

interface LoginInitiateResponse {
  txnId: string;
  availableMethods: string[];
  accountStatus: string;
}

interface StepUpResponse {
  txnId: string;
  status: string;
  nextStep?: string;
  availableMfaMethods?: string[];
  tokens?: { accessToken?: string; refreshToken?: string; expiresIn?: number };
  sessionId?: string;
  accountId?: string;
  userId?: string;
  loginId?: string;
  displayName?: string;
  roles?: string[];
  groups?: string[];
  amr?: string[];
  acr?: string;
}

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = '/api/v1/auth';
  private readonly tokenApiBase = '/api/v1/tokens';
  private readonly sessionApiBase = '/api/v1/sessions';

  private static readonly AUTH_COOKIE = 'innait_auth';

  private readonly authState$ = new BehaviorSubject<AuthState>(
    AuthService.loadFromCookie() ?? { ...INITIAL_AUTH_STATE }
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly tenantService: TenantService
  ) {}

  getAuthState(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  get currentState(): AuthState {
    return this.authState$.getValue();
  }

  get isAuthenticated(): boolean {
    return this.authState$.getValue().status === 'AUTHENTICATED';
  }

  login(loginId: string): Observable<LoginInitiateResponse> {
    this.updateStatus('AUTHENTICATING');
    return this.http
      .post<ApiResponse<LoginInitiateResponse>>(`${this.apiBase}/login/initiate`, { loginId })
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.authState$.next({
            ...this.currentState,
            txnId: data.txnId,
            loginId,
            availableMfaMethods: data.availableMethods,
          });
        }),
        catchError((err) => {
          this.updateStatus('UNAUTHENTICATED');
          throw err;
        })
      );
  }

  submitPrimary(txnId: string, type: string, data: Record<string, unknown>): Observable<StepUpResponse> {
    return this.http
      .post<ApiResponse<StepUpResponse>>(`${this.apiBase}/login/primary`, { txnId, type, data })
      .pipe(
        map((res) => res.data),
        tap((response) => this.handleStepResponse(response))
      );
  }

  submitMfa(txnId: string, type: string, data: Record<string, unknown>): Observable<StepUpResponse> {
    return this.http
      .post<ApiResponse<StepUpResponse>>(`${this.apiBase}/login/mfa`, { txnId, type, data })
      .pipe(
        map((res) => res.data),
        tap((response) => this.handleStepResponse(response))
      );
  }

  refreshToken(): Observable<boolean> {
    return this.http.post<ApiResponse<unknown>>(`${this.tokenApiBase}/refresh`, {}).pipe(
      map(() => true),
      catchError(() => {
        this.handleSessionExpired();
        return of(false);
      })
    );
  }

  logout(): Observable<void> {
    const sessionId = this.currentState.sessionId;
    return this.http.post<void>(`${this.sessionApiBase}/${sessionId}/revoke`, {}).pipe(
      tap(() => this.clearState()),
      catchError(() => {
        this.clearState();
        return of(undefined);
      })
    );
  }

  clearState(): void {
    AuthService.deleteCookie(AuthService.AUTH_COOKIE);
    AuthService.deleteCookie('INNAIT_TOKEN');
    this.authState$.next({ ...INITIAL_AUTH_STATE });
    this.router.navigate(['/login']);
  }

  private handleStepResponse(response: StepUpResponse): void {
    if (response.status === 'AUTHENTICATED') {
      const newState: AuthState = {
        status: 'AUTHENTICATED',
        txnId: response.txnId,
        accountId: response.accountId,
        userId: response.userId,
        loginId: response.loginId ?? this.currentState.loginId,
        displayName: response.displayName,
        roles: response.roles ?? [],
        groups: response.groups ?? [],
        amr: response.amr ?? [],
        acr: response.acr ?? '',
        sessionId: response.sessionId,
      };
      this.authState$.next(newState);
      AuthService.saveToCookie(newState);
      if (response.tokens?.accessToken) {
        AuthService.saveTokenCookie(response.tokens.accessToken, response.tokens.expiresIn ?? 3600);
      }
    } else if (response.status === 'MFA_REQUIRED') {
      this.authState$.next({
        ...this.currentState,
        status: 'MFA_REQUIRED',
        txnId: response.txnId,
        availableMfaMethods: response.availableMfaMethods,
      });
    }
  }

  private handleSessionExpired(): void {
    this.authState$.next({
      ...INITIAL_AUTH_STATE,
      status: 'SESSION_EXPIRED',
    });
    this.router.navigate(['/login']);
  }

  private updateStatus(status: AuthStatus): void {
    this.authState$.next({ ...this.currentState, status });
  }

  private static loadFromCookie(): AuthState | null {
    try {
      const raw = getCookieValue(AuthService.AUTH_COOKIE);
      if (!raw) return null;
      const state = JSON.parse(decodeURIComponent(raw)) as AuthState;
      return state.status === 'AUTHENTICATED' ? state : null;
    } catch {
      return null;
    }
  }

  private static saveToCookie(state: AuthState): void {
    const value = encodeURIComponent(JSON.stringify(state));
    const expires = new Date(Date.now() + 8 * 3600 * 1000).toUTCString();
    document.cookie = `${AuthService.AUTH_COOKIE}=${value};expires=${expires};path=/;SameSite=Lax`;
  }

  private static saveTokenCookie(accessToken: string, expiresInSeconds: number): void {
    const expires = new Date(Date.now() + expiresInSeconds * 1000).toUTCString();
    document.cookie = `INNAIT_TOKEN=${accessToken};expires=${expires};path=/;SameSite=Lax`;
  }

  private static deleteCookie(name: string): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
  }
}
