import { TestBed } from '@angular/core/testing';
import { RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemingService, ThemeMode } from './theming.service';
import { TenantService, TenantBranding } from './tenant.service';

describe('ThemingService', () => {
  let service: ThemingService;
  let brandingSubject: BehaviorSubject<TenantBranding | null>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockMatchMedia: jasmine.SpyObj<MediaQueryList>;

  beforeEach(() => {
    localStorage.clear();
    brandingSubject = new BehaviorSubject<TenantBranding | null>(null);
    mockTenantService = jasmine.createSpyObj('TenantService', ['resolveFromUrl'], {
      branding: brandingSubject.asObservable(),
    });

    mockMatchMedia = {
      matches: false,
      addEventListener: jasmine.createSpy(),
      removeEventListener: jasmine.createSpy(),
    } as unknown as jasmine.SpyObj<MediaQueryList>;
    spyOn(window, 'matchMedia').and.returnValue(mockMatchMedia);

    TestBed.configureTestingModule({
      providers: [
        ThemingService,
        { provide: TenantService, useValue: mockTenantService },
      ],
    });

    service = TestBed.inject(ThemingService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    localStorage.clear();
    // Clean up documentElement style
    document.documentElement.removeAttribute('style');
    document.body.classList.remove('innait-dark', 'innait-light');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to system mode when no stored preference', () => {
    expect(service.currentMode).toBe('system');
  });

  it('should apply light theme CSS variables in light mode', () => {
    service.setMode('light');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--innait-primary')).toBe('#1976d2');
    expect(root.style.getPropertyValue('--innait-bg')).toBe('#f5f5f5');
    expect(root.style.getPropertyValue('--innait-surface')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--innait-text')).toBe('#212121');
  });

  it('should apply dark theme CSS variables in dark mode', () => {
    service.setMode('dark');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--innait-primary')).toBe('#64b5f6');
    expect(root.style.getPropertyValue('--innait-bg')).toBe('#121212');
    expect(root.style.getPropertyValue('--innait-surface')).toBe('#1e1e1e');
    expect(root.style.getPropertyValue('--innait-text')).toBe('#e0e0e0');
  });

  it('should apply PrimeNG variable overrides', () => {
    service.setMode('light');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--primary-color')).toBe('#1976d2');
    expect(root.style.getPropertyValue('--surface-ground')).toBe('#f5f5f5');
    expect(root.style.getPropertyValue('--text-color')).toBe('#212121');
  });

  it('should toggle dark mode', () => {
    service.setMode('light');
    expect(service.isDark).toBe(false);

    service.toggleDarkMode();
    expect(service.isDark).toBe(true);
    expect(service.currentMode).toBe('dark');

    service.toggleDarkMode();
    expect(service.isDark).toBe(false);
    expect(service.currentMode).toBe('light');
  });

  it('should persist theme mode to localStorage', () => {
    service.setMode('dark');
    expect(localStorage.getItem('innait-theme-mode')).toBe('dark');

    service.setMode('light');
    expect(localStorage.getItem('innait-theme-mode')).toBe('light');
  });

  it('should restore theme mode from localStorage', () => {
    localStorage.setItem('innait-theme-mode', 'dark');
    // Re-create the service to test restore
    const freshService = new ThemingService(
      TestBed.inject(RendererFactory2),
      mockTenantService,
    );
    expect(freshService.currentMode).toBe('dark');
    freshService.ngOnDestroy();
  });

  it('should add innait-dark class to body in dark mode', () => {
    service.setMode('dark');
    expect(document.body.classList.contains('innait-dark')).toBe(true);
    expect(document.body.classList.contains('innait-light')).toBe(false);
  });

  it('should add innait-light class to body in light mode', () => {
    service.setMode('light');
    expect(document.body.classList.contains('innait-light')).toBe(true);
    expect(document.body.classList.contains('innait-dark')).toBe(false);
  });

  it('should apply tenant branding overrides', () => {
    service.setMode('light');
    brandingSubject.next({
      tenantId: 't1',
      tenantName: 'Acme',
      logoUrl: '',
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      defaultLocale: 'en',
    });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--innait-primary')).toBe('#ff0000');
    expect(root.style.getPropertyValue('--innait-accent')).toBe('#00ff00');
  });

  it('should use system preference when mode is system', () => {
    (mockMatchMedia as any).matches = true;
    service.setMode('system');
    expect(service.isDark).toBe(true);
  });

  it('should listen for system color scheme changes', () => {
    expect(mockMatchMedia.addEventListener).toHaveBeenCalledWith('change', jasmine.any(Function));
  });

  it('should clean up on destroy', () => {
    service.ngOnDestroy();
    expect(mockMatchMedia.removeEventListener).toHaveBeenCalledWith('change', jasmine.any(Function));
  });

  it('should emit isDarkMode observable changes', (done) => {
    const values: boolean[] = [];
    service.isDarkMode.subscribe((v) => {
      values.push(v);
      if (values.length === 2) {
        expect(values).toContain(true);
        done();
      }
    });
    service.setMode('dark');
  });
});
