export type LanguageCode =
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'ar'
  | 'tr'
  | 'ru'
  | 'ja'
  | 'ko'
  | 'zh';

export const supportedLanguageCodes: LanguageCode[] = [
  'en',
  'fr',
  'es',
  'de',
  'ar',
  'tr',
  'ru',
  'ja',
  'ko',
  'zh',
];

export const languageLabels: Record<LanguageCode, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
  tr: 'Turkish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};
