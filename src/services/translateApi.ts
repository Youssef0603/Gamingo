import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

const FREE_TRANSLATE_API_BASE_URL = 'https://ftapi.pythonanywhere.com';
const TRANSLATE_API_LANGUAGE_CODE_MAP: Record<LanguageCode, string> = {
  en: 'en',
  fr: 'fr',
  es: 'es',
  de: 'de',
  ar: 'ar',
  it: 'it',
  pt: 'pt',
  hi: 'hi',
  nl: 'nl',
  pl: 'pl',
  tr: 'tr',
  ru: 'ru',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh-cn',
};

const TRANSLATE_API_TO_APP_LANGUAGE_CODE: Partial<
  Record<string, LanguageCode>
> = {
  ar: 'ar',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  he: 'en',
  hi: 'hi',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  nl: 'nl',
  pl: 'pl',
  pt: 'pt',
  ru: 'ru',
  tr: 'tr',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
};

type FreeTranslateResponse = {
  'destination-language'?: string;
  'destination-text'?: string;
  'source-language'?: string;
  'source-text'?: string;
};

function toPhraseTranslation(text: string): PhraseTranslation {
  return {
    text,
    meaning: 'Added from translation API.',
  };
}

function toApiLanguageCode(language: LanguageCode) {
  return TRANSLATE_API_LANGUAGE_CODE_MAP[language];
}

function toAppLanguageCode(language: string | undefined) {
  if (!language) {
    return null;
  }

  return (
    TRANSLATE_API_TO_APP_LANGUAGE_CODE[language.toLocaleLowerCase()] ?? null
  );
}

function slugifyPhraseIdPart(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function requestTranslation({
  destinationLanguage,
  sourceLanguage,
  text,
}: {
  destinationLanguage: LanguageCode;
  sourceLanguage?: string;
  text: string;
}) {
  const params = new URLSearchParams({
    dl: toApiLanguageCode(destinationLanguage),
    text,
  });

  if (sourceLanguage) {
    params.set('sl', sourceLanguage);
  }

  const response = await fetch(
    `${FREE_TRANSLATE_API_BASE_URL}/translate?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Translation service is unavailable right now.');
  }

  const payload = (await response.json()) as FreeTranslateResponse;

  if (!payload['destination-text'] || !payload['source-text']) {
    throw new Error('Translation service returned an incomplete response.');
  }

  return payload;
}

export async function buildTranslatedCustomPhrase({
  destinationLanguage,
  text,
}: {
  destinationLanguage: LanguageCode;
  text: string;
}): Promise<Phrase> {
  const initialTranslation = await requestTranslation({
    destinationLanguage,
    text,
  });
  const sourceText = initialTranslation['source-text']!.trim();
  const destinationText = initialTranslation['destination-text']!.trim();
  const sourceLanguageCode = initialTranslation['source-language'];
  const sourceAppLanguage = toAppLanguageCode(sourceLanguageCode);

  const englishText =
    destinationLanguage === 'en'
      ? destinationText
      : sourceAppLanguage === 'en'
        ? sourceText
        : (
            await requestTranslation({
              destinationLanguage: 'en',
              sourceLanguage: sourceLanguageCode,
              text: sourceText,
            })
          )['destination-text']?.trim();

  if (!englishText) {
    throw new Error('Could not build an English helper translation.');
  }

  const translations: Phrase['translations'] = {
    en: toPhraseTranslation(englishText),
    [destinationLanguage]: toPhraseTranslation(destinationText),
  };

  if (sourceAppLanguage) {
    const sourceLanguage = sourceAppLanguage as LanguageCode;

    if (!translations[sourceLanguage]) {
      translations[sourceLanguage] = toPhraseTranslation(sourceText);
    }
  }

  return {
    id: `custom-${slugifyPhraseIdPart(sourceText || text)}-${destinationLanguage}`,
    category: 'instructions',
    tags: ['custom', 'api-translation'],
    translations,
  };
}
