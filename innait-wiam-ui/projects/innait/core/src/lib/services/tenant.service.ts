import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface TenantBranding {
  tenantId: string;
  tenantName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  defaultLocale: string;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly tenantId$ = new BehaviorSubject<string>('');
  private readonly branding$ = new BehaviorSubject<TenantBranding | null>(null);

  constructor(private readonly http: HttpClient) {}

  get currentTenantId(): string {
    return this.tenantId$.getValue();
  }

  get tenantId(): Observable<string> {
    return this.tenantId$.asObservable();
  }

  get branding(): Observable<TenantBranding | null> {
    return this.branding$.asObservable();
  }

  resolveFromUrl(): void {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    // Pattern: {tenant}.auth.innait.io or {tenant}.admin.innait.io
    if (parts.length >= 3 && (parts[1] === 'auth' || parts[1] === 'admin')) {
      this.setTenantId(parts[0]!);
    }
  }

  setTenantId(tenantId: string): void {
    if (tenantId && tenantId !== this.tenantId$.getValue()) {
      this.tenantId$.next(tenantId);
      this.loadBranding(tenantId);
    }
  }

  loadBranding(tenantId: string): Observable<TenantBranding | null> {
    return this.http.get<TenantBranding>(`/api/v1/tenants/${tenantId}/branding`).pipe(
      tap((branding) => {
        this.branding$.next(branding);
        this.applyBranding(branding);
      }),
      catchError(() => {
        this.branding$.next(null);
        return of(null);
      })
    );
  }

  private applyBranding(branding: TenantBranding): void {
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--innait-primary', branding.primaryColor);
    }
    if (branding.accentColor) {
      root.style.setProperty('--innait-accent', branding.accentColor);
    }
  }
}
