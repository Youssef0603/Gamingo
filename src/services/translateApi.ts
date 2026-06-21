import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

const MY_MEMORY_API_BASE_URL = 'https://api.mymemory.translated.net';
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

type MyMemoryTranslateResponse = {
  quotaFinished?: boolean;
  responseData?: {
    translatedText?: string;
  };
  responseDetails?: string;
  responseStatus?: number;
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
  sourceLanguage: LanguageCode;
  text: string;
}) {
  const trimmedText = text.trim();
  const sourceApiLanguage = toApiLanguageCode(sourceLanguage);
  const destinationApiLanguage = toApiLanguageCode(destinationLanguage);
  const params = new URLSearchParams({
    langpair: `${sourceApiLanguage}|${destinationApiLanguage}`,
    q: trimmedText,
  });

  const response = await fetch(
    `${MY_MEMORY_API_BASE_URL}/get?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error('Translation service is unavailable right now.');
  }

  const payload = (await response.json()) as MyMemoryTranslateResponse;
  const translatedText = payload.responseData?.translatedText?.trim();

  if (payload.quotaFinished) {
    throw new Error('Translation service daily quota is finished.');
  }

  if (payload.responseStatus && payload.responseStatus >= 400) {
    throw new Error(
      payload.responseDetails || 'Translation service could not translate this.',
    );
  }

  if (!translatedText) {
    throw new Error('Translation service returned an incomplete response.');
  }

  return {
    destinationText: translatedText,
    sourceLanguage,
    sourceText: trimmedText,
  };
}

export async function translateTextWithDetectedSource({
  destinationLanguage,
  sourceLanguage,
  text,
}: {
  destinationLanguage: LanguageCode;
  sourceLanguage: LanguageCode;
  text: string;
}) {
  const translation = await requestTranslation({
    destinationLanguage,
    sourceLanguage,
    text,
  });

  return {
    destinationText: translation.destinationText,
    sourceLanguage: translation.sourceLanguage,
    sourceText: translation.sourceText,
  };
}

export async function buildTranslatedCustomPhrase({
  destinationLanguage,
  sourceLanguage,
  text,
}: {
  destinationLanguage: LanguageCode;
  sourceLanguage: LanguageCode;
  text: string;
}): Promise<Phrase> {
  const initialTranslation = await requestTranslation({
    destinationLanguage,
    sourceLanguage,
    text,
  });
  const sourceText = initialTranslation.sourceText;
  const destinationText = initialTranslation.destinationText;

  const englishText =
    destinationLanguage === 'en'
      ? destinationText
      : sourceLanguage === 'en'
        ? sourceText
        : (
            await requestTranslation({
              destinationLanguage: 'en',
              sourceLanguage,
              text: sourceText,
            })
          ).destinationText;

  if (!englishText) {
    throw new Error('Could not build an English helper translation.');
  }

  const translations: Phrase['translations'] = {
    en: toPhraseTranslation(englishText),
    [destinationLanguage]: toPhraseTranslation(destinationText),
  };

  if (!translations[sourceLanguage]) {
    translations[sourceLanguage] = toPhraseTranslation(sourceText);
  }

  return {
    id: `custom-${slugifyPhraseIdPart(sourceText || text)}-${destinationLanguage}`,
    category: 'instructions',
    tags: ['custom', 'api-translation'],
    translations,
  };
}
