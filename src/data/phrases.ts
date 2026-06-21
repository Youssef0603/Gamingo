import arTranslations from './phrases/ar.json';
import deTranslations from './phrases/de.json';
import enTranslations from './phrases/en.json';
import esTranslations from './phrases/es.json';
import frTranslations from './phrases/fr.json';
import hiTranslations from './phrases/hi.json';
import itTranslations from './phrases/it.json';
import jaTranslations from './phrases/ja.json';
import koTranslations from './phrases/ko.json';
import nlTranslations from './phrases/nl.json';
import phraseMetadataSource from './phrases/meta.json';
import plTranslations from './phrases/pl.json';
import ptTranslations from './phrases/pt.json';
import ruTranslations from './phrases/ru.json';
import trTranslations from './phrases/tr.json';
import zhTranslations from './phrases/zh.json';
import { supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

type StaticPhraseMeta = Pick<
  Phrase,
  'id' | 'category' | 'tags' | 'isToxic' | 'saferAlternative'
>;

type TranslationDictionary = Record<string, PhraseTranslation>;

type WordBankRecommendedAction =
  | 'block_do_not_translate'
  | 'block_or_warn'
  | 'normalize_then_match'
  | 'translate_normally'
  | 'translate_with_caution'
  | 'warn_or_filter';

type WordBankConcept = {
  id: string;
  category: string;
  severity?: string;
  meaning: string;
  recommendedAction: WordBankRecommendedAction;
  terms: Partial<Record<LanguageCode, string | string[]>>;
};

type WordBankData = {
  concepts: WordBankConcept[];
};

const staticPhraseMetadata = phraseMetadataSource as StaticPhraseMeta[];
const wordBank = require('./wordBank.json') as WordBankData;

const translationSources = {
  ar: arTranslations,
  de: deTranslations,
  en: enTranslations,
  es: esTranslations,
  fr: frTranslations,
  hi: hiTranslations,
  it: itTranslations,
  ja: jaTranslations,
  ko: koTranslations,
  nl: nlTranslations,
  pl: plTranslations,
  pt: ptTranslations,
  ru: ruTranslations,
  tr: trTranslations,
  zh: zhTranslations,
} as Record<LanguageCode, TranslationDictionary>;

function validateStaticPhraseData() {
  const knownPhraseIds = new Set<string>();

  staticPhraseMetadata.forEach(({ id }) => {
    if (knownPhraseIds.has(id)) {
      throw new Error(`Duplicate phrase id found in meta.json: ${id}`);
    }

    knownPhraseIds.add(id);
  });

  supportedLanguageCodes.forEach(language => {
    const translations = translationSources[language];

    Object.keys(translations).forEach(phraseId => {
      if (!knownPhraseIds.has(phraseId)) {
        throw new Error(
          `Unknown phrase id "${phraseId}" found in ${language}.json`,
        );
      }
    });
  });
}

function getWordBankPhraseId(conceptId: string) {
  return `toxic-${conceptId}`;
}

function getConceptTermValue(
  termValue: string | string[] | undefined,
): string | null {
  if (typeof termValue === 'string') {
    const trimmedValue = termValue.trim();

    return trimmedValue || null;
  }

  if (Array.isArray(termValue)) {
    const firstValue = termValue[0]?.trim();

    return firstValue || null;
  }

  return null;
}

function buildWordBankPhraseTranslations(
  concept: WordBankConcept,
): Phrase['translations'] {
  const englishText = getConceptTermValue(concept.terms.en);

  if (!englishText) {
    throw new Error(
      `Missing English word bank term for concept "${concept.id}"`,
    );
  }

  const translations = {
    en: {
      text: englishText,
      meaning: concept.meaning,
    },
  } as Phrase['translations'];

  supportedLanguageCodes.forEach(language => {
    if (language === 'en') {
      return;
    }

    const text = getConceptTermValue(concept.terms[language]);

    if (!text) {
      return;
    }

    translations[language] = {
      text,
      meaning: concept.meaning,
    };
  });

  return translations;
}

function buildWordBankPhrases() {
  const seenPhraseIds = new Set(staticPhraseMetadata.map(({ id }) => id));

  return wordBank.concepts.map<Phrase>(concept => {
    const phraseId = getWordBankPhraseId(concept.id);

    if (seenPhraseIds.has(phraseId)) {
      throw new Error(`Duplicate generated toxic phrase id: ${phraseId}`);
    }

    seenPhraseIds.add(phraseId);

    return {
      id: phraseId,
      category: 'toxic',
      isToxic: true,
      tags: [
        'wordbank',
        'cursing',
        concept.category,
        concept.recommendedAction,
        ...(concept.severity ? [concept.severity] : []),
      ],
      translations: buildWordBankPhraseTranslations(concept),
    };
  });
}

function buildTranslations(phraseId: string): Phrase['translations'] {
  const englishTranslation = translationSources.en[phraseId];

  if (!englishTranslation) {
    throw new Error(`Missing English translation for phrase id "${phraseId}"`);
  }

  const translations = {
    en: englishTranslation,
  } as Phrase['translations'];

  supportedLanguageCodes.forEach(language => {
    if (language === 'en') {
      return;
    }

    const translation = translationSources[language][phraseId];

    if (translation) {
      translations[language] = translation;
    }
  });

  return translations;
}

validateStaticPhraseData();

const wordBankPhrases = buildWordBankPhrases();

export const phrases: Phrase[] = [
  ...staticPhraseMetadata.map(phrase => ({
    ...phrase,
    translations: buildTranslations(phrase.id),
  })),
  ...wordBankPhrases,
];
