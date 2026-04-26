export type LanguageCode =
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'ar'
  | 'it'
  | 'pt'
  | 'hi'
  | 'nl'
  | 'pl'
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
  'it',
  'pt',
  'hi',
  'nl',
  'pl',
  'tr',
  'ru',
  'ja',
  'ko',
  'zh',
];

export const languageMetadata: Record<
  LanguageCode,
  { label: string; flag: string }
> = {
  en: { label: 'English', flag: '🇺🇸' },
  fr: { label: 'French', flag: '🇫🇷' },
  es: { label: 'Spanish', flag: '🇪🇸' },
  de: { label: 'German', flag: '🇩🇪' },
  ar: { label: 'Arabic', flag: '🇸🇦' },
  it: { label: 'Italian', flag: '🇮🇹' },
  pt: { label: 'Portuguese', flag: '🇧🇷' },
  hi: { label: 'Hindi', flag: '🇮🇳' },
  nl: { label: 'Dutch', flag: '🇳🇱' },
  pl: { label: 'Polish', flag: '🇵🇱' },
  tr: { label: 'Turkish', flag: '🇹🇷' },
  ru: { label: 'Russian', flag: '🇷🇺' },
  ja: { label: 'Japanese', flag: '🇯🇵' },
  ko: { label: 'Korean', flag: '🇰🇷' },
  zh: { label: 'Chinese', flag: '🇨🇳' },
};

export const languageLabels: Record<LanguageCode, string> = {
  en: languageMetadata.en.label,
  fr: languageMetadata.fr.label,
  es: languageMetadata.es.label,
  de: languageMetadata.de.label,
  ar: languageMetadata.ar.label,
  it: languageMetadata.it.label,
  pt: languageMetadata.pt.label,
  hi: languageMetadata.hi.label,
  nl: languageMetadata.nl.label,
  pl: languageMetadata.pl.label,
  tr: languageMetadata.tr.label,
  ru: languageMetadata.ru.label,
  ja: languageMetadata.ja.label,
  ko: languageMetadata.ko.label,
  zh: languageMetadata.zh.label,
};
