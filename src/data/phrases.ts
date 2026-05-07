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

const phraseMetadata = phraseMetadataSource as StaticPhraseMeta[];

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

  phraseMetadata.forEach(({ id }) => {
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

export const phrases: Phrase[] = phraseMetadata.map(phrase => ({
  ...phrase,
  translations: buildTranslations(phrase.id),
}));
