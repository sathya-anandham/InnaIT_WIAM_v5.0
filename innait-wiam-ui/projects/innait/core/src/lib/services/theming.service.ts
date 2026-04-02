import { Injectable, Renderer2, RendererFactory2, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { TenantService, TenantBranding } from './tenant.service';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  primaryColor: string;
  primaryLight: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  textSecondary: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  sidebarWidth: string;
  loginBackground?: string;
}

const LIGHT_DEFAULTS: ThemeConfig = {
  primaryColor: '#1976d2',
  primaryLight: '#42a5f5',
  accentColor: '#ff6f00',
  bgColor: '#f5f5f5',
  surfaceColor: '#ffffff',
  textColor: '#212121',
  textSecondary: '#757575',
  successColor: '#4caf50',
  warningColor: '#ff9800',
  dangerColor: '#f44336',
  sidebarWidth: '260px',
};

const DARK_DEFAULTS: ThemeConfig = {
  primaryColor: '#64b5f6',
  primaryLight: '#90caf9',
  accentColor: '#ffab40',
  bgColor: '#121212',
  surfaceColor: '#1e1e1e',
  textColor: '#e0e0e0',
  textSecondary: '#9e9e9e',
  successColor: '#66bb6a',
  warningColor: '#ffa726',
  dangerColor: '#ef5350',
  sidebarWidth: '260px',
};

const STORAGE_KEY = 'innait-theme-mode';

@Injectable({ providedIn: 'root' })
export class ThemingService implements OnDestroy {
  private readonly renderer: Renderer2;
  private readonly destroy$ = new Subject<void>();
  private mediaQuery: MediaQueryList;

  private readonly mode$ = new BehaviorSubject<ThemeMode>(this.loadStoredMode());
  private readonly isDark$ = new BehaviorSubject<boolean>(false);
  private tenantOverrides: Partial<ThemeConfig> = {};

  constructor(
    rendererFactory: RendererFactory2,
    private readonly tenantService: TenantService,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Listen for system color scheme changes
    this.mediaQuery.addEventListener('change', this.onSystemThemeChange);

    // Subscribe to tenant branding to apply overrides
    this.tenantService.branding.pipe(takeUntil(this.destroy$)).subscribe((branding) => {
      if (branding) {
        this.applyTenantBranding(branding);
      }
    });

    // Apply initial theme
    this.applyTheme();
  }

  get themeMode(): Observable<ThemeMode> {
    return this.mode$.asObservable();
  }

  get currentMode(): ThemeMode {
    return this.mode$.getValue();
  }

  get isDarkMode(): Observable<boolean> {
    return this.isDark$.asObservable();
  }

  get isDark(): boolean {
    return this.isDark$.getValue();
  }

  setMode(mode: ThemeMode): void {
    this.mode$.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.applyTheme();
  }

  toggleDarkMode(): void {
    const current = this.isDark$.getValue();
    this.setMode(current ? 'light' : 'dark');
  }

  applyTenantBranding(branding: TenantBranding): void {
    this.tenantOverrides = {};
    if (branding.primaryColor) {
      this.tenantOverrides.primaryColor = branding.primaryColor;
      this.tenantOverrides.primaryLight = this.lightenColor(branding.primaryColor, 30);
    }
    if (branding.accentColor) {
      this.tenantOverrides.accentColor = branding.accentColor;
    }
    this.applyTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.mediaQuery.removeEventListener('change', this.onSystemThemeChange);
  }

  private applyTheme(): void {
    const mode = this.mode$.getValue();
    const effectiveDark = mode === 'dark' || (mode === 'system' && this.mediaQuery.matches);
    this.isDark$.next(effectiveDark);

    const base = effectiveDark ? { ...DARK_DEFAULTS } : { ...LIGHT_DEFAULTS };
    const config: ThemeConfig = { ...base, ...this.tenantOverrides };

    const root = document.documentElement;
    root.style.setProperty('--innait-primary', config.primaryColor);
    root.style.setProperty('--innait-primary-light', config.primaryLight);
    root.style.setProperty('--innait-accent', config.accentColor);
    root.style.setProperty('--innait-bg', config.bgColor);
    root.style.setProperty('--innait-surface', config.surfaceColor);
    root.style.setProperty('--innait-text', config.textColor);
    root.style.setProperty('--innait-text-secondary', config.textSecondary);
    root.style.setProperty('--innait-success', config.successColor);
    root.style.setProperty('--innait-warning', config.warningColor);
    root.style.setProperty('--innait-danger', config.dangerColor);
    root.style.setProperty('--innait-sidebar-width', config.sidebarWidth);

    // PrimeNG theme variable overrides
    root.style.setProperty('--primary-color', config.primaryColor);
    root.style.setProperty('--primary-color-text', effectiveDark ? '#121212' : '#ffffff');
    root.style.setProperty('--surface-ground', config.bgColor);
    root.style.setProperty('--surface-card', config.surfaceColor);
    root.style.setProperty('--surface-border', effectiveDark ? '#333333' : '#dee2e6');
    root.style.setProperty('--text-color', config.textColor);
    root.style.setProperty('--text-color-secondary', config.textSecondary);

    if (config.loginBackground) {
      root.style.setProperty('--innait-login-bg', config.loginBackground);
    }

    // Toggle dark class on body for global CSS hooks
    if (effectiveDark) {
      this.renderer.addClass(document.body, 'innait-dark');
      this.renderer.removeClass(document.body, 'innait-light');
    } else {
      this.renderer.addClass(document.body, 'innait-light');
      this.renderer.removeClass(document.body, 'innait-dark');
    }
  }

  private loadStoredMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private readonly onSystemThemeChange = (): void => {
    if (this.mode$.getValue() === 'system') {
      this.applyTheme();
    }
  };

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
