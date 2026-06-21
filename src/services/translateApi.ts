import { detectAll } from 'tinyld';

import { languageMetadata } from '../types/language';
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

type TextScript =
  | 'arabic'
  | 'cyrillic'
  | 'devanagari'
  | 'han'
  | 'hangul'
  | 'hiragana'
  | 'katakana'
  | 'latin';

type LocalDetection = {
  language: LanguageCode;
  reason: 'marker' | 'detector';
};

const LANGUAGE_ALLOWED_SCRIPTS: Record<LanguageCode, TextScript[]> = {
  ar: ['arabic'],
  de: ['latin'],
  en: ['latin'],
  es: ['latin'],
  fr: ['latin'],
  hi: ['devanagari'],
  it: ['latin'],
  ja: ['hiragana', 'katakana', 'han'],
  ko: ['hangul'],
  nl: ['latin'],
  pl: ['latin'],
  pt: ['latin'],
  ru: ['cyrillic'],
  tr: ['latin'],
  zh: ['han'],
};

const TEXT_SCRIPT_PATTERNS: Record<TextScript, RegExp> = {
  arabic: /\p{Script=Arabic}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  devanagari: /\p{Script=Devanagari}/u,
  han: /\p{Script=Han}/u,
  hangul: /\p{Script=Hangul}/u,
  hiragana: /\p{Script=Hiragana}/u,
  katakana: /\p{Script=Katakana}/u,
  latin: /\p{Script=Latin}/u,
};

const TINYLD_SUPPORTED_APP_LANGUAGE_CODES: LanguageCode[] = [
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

const LATIN_SOURCE_LANGUAGES: LanguageCode[] = [
  'de',
  'en',
  'es',
  'fr',
  'it',
  'nl',
  'pl',
  'pt',
  'tr',
];

const SHORT_TEXT_MARKERS: Partial<Record<LanguageCode, string[]>> = {
  de: [
    'bitte',
    'danke',
    'guten',
    'hallo',
    'morgen',
    'nicht',
    'tschuss',
  ],
  en: [
    'attack',
    'behind',
    'friend',
    'hello',
    'help',
    'need',
    'please',
    'thanks',
  ],
  es: [
    'adios',
    'amigo',
    'buenas',
    'buenos',
    'dias',
    'gracias',
    'hola',
    'senor',
  ],
  fr: [
    'ami',
    'bonjour',
    'merci',
    'oui',
    'salut',
    'soir',
    'vous',
  ],
  it: [
    'amico',
    'buongiorno',
    'ciao',
    'grazie',
    'prego',
    'sera',
  ],
  nl: [
    'alsjeblieft',
    'bedankt',
    'goedemorgen',
    'hallo',
    'vriend',
  ],
  pl: [
    'czesc',
    'dziekuje',
    'prosze',
    'przyjaciel',
    'witaj',
  ],
  pt: [
    'amigo',
    'bom',
    'dia',
    'obrigado',
    'ola',
    'por',
    'favor',
  ],
  tr: [
    'arkadas',
    'gunaydin',
    'lutfen',
    'merhaba',
    'tesekkurler',
  ],
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

function normalizeTextForLanguageDetection(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function detectTextScripts(text: string) {
  return Object.entries(TEXT_SCRIPT_PATTERNS).flatMap(([script, pattern]) =>
    pattern.test(text) ? [script as TextScript] : [],
  );
}

function detectLanguageByMarkers(text: string): LocalDetection | null {
  const normalizedText = normalizeTextForLanguageDetection(text);
  const tokens = normalizedText.split(' ').filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  const scores = Object.entries(SHORT_TEXT_MARKERS).flatMap(
    ([language, markers]) => {
      const markerSet = new Set(markers);
      const score = tokens.reduce(
        (total, token) => total + (markerSet.has(token) ? 1 : 0),
        0,
      );

      return score > 0
        ? [{ language: language as LanguageCode, score }]
        : [];
    },
  );

  scores.sort((first, second) => second.score - first.score);

  const [bestMatch, secondMatch] = scores;

  if (!bestMatch) {
    return null;
  }

  if (bestMatch.score >= 2 || bestMatch.score > (secondMatch?.score ?? 0)) {
    return {
      language: bestMatch.language,
      reason: 'marker',
    };
  }

  return null;
}

function detectLanguageByTinyld(
  text: string,
  sourceLanguage: LanguageCode,
): LocalDetection | null {
  const tokenCount = normalizeTextForLanguageDetection(text)
    .split(' ')
    .filter(Boolean).length;

  if (tokenCount < 2) {
    return null;
  }

  const detections = detectAll(text, {
    only: TINYLD_SUPPORTED_APP_LANGUAGE_CODES,
  });
  const [bestDetection] = detections;

  if (!bestDetection || bestDetection.lang === sourceLanguage) {
    return null;
  }

  const sourceDetection = detections.find(
    detection => detection.lang === sourceLanguage,
  );
  const sourceAccuracy = sourceDetection?.accuracy ?? 0;
  const isStrongEnough =
    bestDetection.accuracy >= 0.14 &&
    bestDetection.accuracy - sourceAccuracy >= 0.08;

  if (!isStrongEnough) {
    return null;
  }

  return {
    language: bestDetection.lang as LanguageCode,
    reason: 'detector',
  };
}

function detectSourceLanguageMismatch(
  text: string,
  sourceLanguage: LanguageCode,
): LocalDetection | null {
  if (!LATIN_SOURCE_LANGUAGES.includes(sourceLanguage)) {
    return null;
  }

  const markerDetection = detectLanguageByMarkers(text);

  if (markerDetection && markerDetection.language !== sourceLanguage) {
    return markerDetection;
  }

  const tinyldDetection = detectLanguageByTinyld(text, sourceLanguage);

  if (tinyldDetection && tinyldDetection.language !== sourceLanguage) {
    return tinyldDetection;
  }

  return null;
}

function validateSourceLanguage(text: string, sourceLanguage: LanguageCode) {
  const detectedScripts = detectTextScripts(text);
  const allowedScripts = LANGUAGE_ALLOWED_SCRIPTS[sourceLanguage];
  const unsupportedScripts = detectedScripts.filter(
    script => !allowedScripts.includes(script),
  );

  if (unsupportedScripts.length > 0) {
    throw new Error(
      `This does not look like ${languageMetadata[sourceLanguage].label}. ` +
        `Switch your native language or enter the word in ${
          languageMetadata[sourceLanguage].label
        }.`,
    );
  }

  const localDetection = detectSourceLanguageMismatch(text, sourceLanguage);

  if (!localDetection) {
    return;
  }

  throw new Error(
    `This looks like ${languageMetadata[localDetection.language].label}, ` +
      `but your native language is set to ${
        languageMetadata[sourceLanguage].label
      }. Switch your native language or enter the word in ${
        languageMetadata[sourceLanguage].label
      }.`,
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
  sourceLanguage: LanguageCode;
  text: string;
}) {
  const trimmedText = text.trim();

  validateSourceLanguage(trimmedText, sourceLanguage);

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
