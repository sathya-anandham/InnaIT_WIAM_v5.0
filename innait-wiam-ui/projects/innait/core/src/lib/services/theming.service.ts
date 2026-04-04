import { Injectable, Renderer2, RendererFactory2, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { TenantService, TenantBranding } from './tenant.service';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  primaryColor: string;
  primaryLight: string;
  primaryDark: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  textSecondary: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  infoColor: string;
  sidebarWidth: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarHover: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  sidebarSection: string;
  topbarBg: string;
  topbarBorder: string;
  topbarHeight: string;
  cardShadow: string;
  cardRadius: string;
  loginBackground?: string;
}

const LIGHT_DEFAULTS: ThemeConfig = {
  primaryColor: '#3751FF',
  primaryLight: '#5B73FF',
  primaryDark: '#2A3FC7',
  accentColor: '#00B884',
  bgColor: '#F0F1F7',
  surfaceColor: '#ffffff',
  textColor: '#252733',
  textSecondary: '#9FA2B4',
  borderColor: '#DFE0EB',
  successColor: '#29CC97',
  warningColor: '#FEC400',
  dangerColor: '#F12B2C',
  infoColor: '#3751FF',
  sidebarWidth: '270px',
  sidebarBg: '#262731',
  sidebarText: '#A4A6B3',
  sidebarHover: '#2C2D3A',
  sidebarActiveBg: 'rgba(55, 81, 255, 0.12)',
  sidebarActiveText: '#DDE2FF',
  sidebarSection: '#6B6D7B',
  topbarBg: '#ffffff',
  topbarBorder: '#DFE0EB',
  topbarHeight: '64px',
  cardShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
  cardRadius: '12px',
};

const DARK_DEFAULTS: ThemeConfig = {
  primaryColor: '#5B73FF',
  primaryLight: '#7B8FFF',
  primaryDark: '#3751FF',
  accentColor: '#34D9A3',
  bgColor: '#1A1B25',
  surfaceColor: '#21222D',
  textColor: '#E0E0E6',
  textSecondary: '#9FA2B4',
  borderColor: '#33343F',
  successColor: '#34D9A3',
  warningColor: '#FFD43B',
  dangerColor: '#FF6B6B',
  infoColor: '#5B73FF',
  sidebarWidth: '270px',
  sidebarBg: '#16171F',
  sidebarText: '#A4A6B3',
  sidebarHover: '#1E1F2A',
  sidebarActiveBg: 'rgba(91, 115, 255, 0.15)',
  sidebarActiveText: '#B3C0FF',
  sidebarSection: '#6B6D7B',
  topbarBg: '#21222D',
  topbarBorder: '#33343F',
  topbarHeight: '64px',
  cardShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  cardRadius: '12px',
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
      this.tenantOverrides.primaryLight = this.lightenColor(branding.primaryColor, 20);
      this.tenantOverrides.primaryDark = this.darkenColor(branding.primaryColor, 15);
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

    // Core colors
    root.style.setProperty('--innait-primary', config.primaryColor);
    root.style.setProperty('--innait-primary-light', config.primaryLight);
    root.style.setProperty('--innait-primary-dark', config.primaryDark);
    root.style.setProperty('--innait-accent', config.accentColor);
    root.style.setProperty('--innait-bg', config.bgColor);
    root.style.setProperty('--innait-surface', config.surfaceColor);
    root.style.setProperty('--innait-text', config.textColor);
    root.style.setProperty('--innait-text-secondary', config.textSecondary);
    root.style.setProperty('--innait-border', config.borderColor);
    root.style.setProperty('--innait-success', config.successColor);
    root.style.setProperty('--innait-warning', config.warningColor);
    root.style.setProperty('--innait-danger', config.dangerColor);
    root.style.setProperty('--innait-info', config.infoColor);

    // Sidebar
    root.style.setProperty('--innait-sidebar-width', config.sidebarWidth);
    root.style.setProperty('--innait-sidebar-bg', config.sidebarBg);
    root.style.setProperty('--innait-sidebar-text', config.sidebarText);
    root.style.setProperty('--innait-sidebar-hover', config.sidebarHover);
    root.style.setProperty('--innait-sidebar-active-bg', config.sidebarActiveBg);
    root.style.setProperty('--innait-sidebar-active-text', config.sidebarActiveText);
    root.style.setProperty('--innait-sidebar-section', config.sidebarSection);

    // Topbar
    root.style.setProperty('--innait-topbar-bg', config.topbarBg);
    root.style.setProperty('--innait-topbar-border', config.topbarBorder);
    root.style.setProperty('--innait-topbar-height', config.topbarHeight);

    // Card
    root.style.setProperty('--innait-card-shadow', config.cardShadow);
    root.style.setProperty('--innait-card-radius', config.cardRadius);

    // PrimeNG theme variable overrides
    root.style.setProperty('--primary-color', config.primaryColor);
    root.style.setProperty('--primary-color-text', '#ffffff');
    root.style.setProperty('--surface-ground', config.bgColor);
    root.style.setProperty('--surface-card', config.surfaceColor);
    root.style.setProperty('--surface-border', config.borderColor);
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

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * percent / 100));
    const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100));
    const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
