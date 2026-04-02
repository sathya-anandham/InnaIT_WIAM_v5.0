import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to English locale', () => {
    expect(service.currentLocale).toBe('en');
  });

  it('should translate a known key in English', () => {
    expect(service.translate('common.save')).toBe('Save');
    expect(service.translate('common.cancel')).toBe('Cancel');
  });

  it('should switch to Hindi locale', () => {
    service.setLocale('hi');
    expect(service.currentLocale).toBe('hi');
    expect(service.translate('common.save')).not.toBe('common.save');
  });

  it('should switch to Tamil locale', () => {
    service.setLocale('ta');
    expect(service.currentLocale).toBe('ta');
    expect(service.translate('common.save')).not.toBe('common.save');
  });

  it('should return key when translation not found', () => {
    expect(service.translate('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should interpolate params', () => {
    const result = service.translate('idle.warningMsg', { seconds: '30' });
    expect(result).toContain('30');
  });

  it('should update document.documentElement.lang on locale change', () => {
    service.setLocale('hi');
    expect(document.documentElement.lang).toBe('hi');
  });

  it('should not change locale for unsupported locale', () => {
    service.setLocale('fr' as any);
    expect(service.currentLocale).toBe('en');
  });

  it('should emit locale changes via locale$ observable', (done) => {
    const locales: string[] = [];
    service.locale$.subscribe((l) => {
      locales.push(l);
      if (locales.length === 2) {
        expect(locales[1]).toBe('ta');
        done();
      }
    });
    service.setLocale('ta');
  });

  it('should provide t() as alias for translate()', () => {
    expect(service.t('common.save')).toBe(service.translate('common.save'));
  });

  it('should switch back to English after switching to another locale', () => {
    service.setLocale('hi');
    service.setLocale('en');
    expect(service.translate('common.save')).toBe('Save');
  });
});
