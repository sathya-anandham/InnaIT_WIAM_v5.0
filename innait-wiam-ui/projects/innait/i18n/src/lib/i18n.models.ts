export type TranslationKey = string;
export type TranslationMap = Record<string, string | Record<string, string>>;

export type SupportedLocale = 'en' | 'hi' | 'ta';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'hi', 'ta'] as const;

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
};
