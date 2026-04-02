import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupportedLocale, TranslationMap, SUPPORTED_LOCALES } from './i18n.models';
import { EN_TRANSLATIONS } from './translations/en';
import { HI_TRANSLATIONS } from './translations/hi';
import { TA_TRANSLATIONS } from './translations/ta';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translations: Record<SupportedLocale, TranslationMap> = {
    en: EN_TRANSLATIONS,
    hi: HI_TRANSLATIONS,
    ta: TA_TRANSLATIONS,
  };

  private readonly currentLocale$ = new BehaviorSubject<SupportedLocale>('en');

  get locale$(): Observable<SupportedLocale> {
    return this.currentLocale$.asObservable();
  }

  get currentLocale(): SupportedLocale {
    return this.currentLocale$.getValue();
  }

  setLocale(locale: SupportedLocale): void {
    if (SUPPORTED_LOCALES.includes(locale)) {
      this.currentLocale$.next(locale);
      document.documentElement.lang = locale;
    }
  }

  translate(key: string, params?: Record<string, string>): string {
    const map = this.translations[this.currentLocale];
    const value = this.resolveKey(map, key);

    if (!value) {
      return key;
    }

    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  t(key: string, params?: Record<string, string>): string {
    return this.translate(key, params);
  }

  private resolveKey(map: TranslationMap, key: string): string | undefined {
    const parts = key.split('.');
    let current: unknown = map;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return typeof current === 'string' ? current : undefined;
  }

  private interpolate(template: string, params: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
  }
}
