import { supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';

type WordBankRecommendedAction =
  | 'block_do_not_translate'
  | 'block_or_warn'
  | 'normalize_then_match'
  | 'translate_normally'
  | 'translate_with_caution'
  | 'warn_or_filter';

type WordBankTermEntry = {
  conceptId: string;
  normalized: string;
  term: string;
};

type WordBankConcept = {
  id: string;
  meaning: string;
  recommendedAction: WordBankRecommendedAction;
  terms: Partial<Record<LanguageCode, string | string[]>>;
};

type WordBankLanguageEntry = {
  terms: WordBankTermEntry[];
};

type WordBankData = {
  byLanguage: Partial<Record<LanguageCode, WordBankLanguageEntry>>;
  concepts: WordBankConcept[];
};

export type WordBankMatch = {
  conceptId: string;
  destinationText: string;
  meaning: string;
  recommendedAction: WordBankRecommendedAction;
  sourceLanguage: LanguageCode;
  sourceTerm: string;
};

const wordBank = require('../data/wordBank.json') as WordBankData;

const ZERO_WIDTH_CHARACTERS_REGEX = /[\u200B-\u200D\uFEFF]/g;
const TATWEEL_REGEX = /\u0640/g;
const NON_LETTER_OR_NUMBER_REGEX = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE_REGEX = /\s+/g;
const LEETSPEAK_CHARACTER_MAP: Record<string, string> = {
  '!': 'i',
  $: 's',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
};

const conceptById = new Map<string, WordBankConcept>();
const termLookupByLanguage: Partial<
  Record<LanguageCode, Map<string, WordBankTermEntry>>
> = {};

function normalizeArabicCharacters(value: string) {
  return value
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي');
}

function normalizeWordBankLookupValue(value: string, language: LanguageCode) {
  const normalizedValue = value
    .trim()
    .normalize('NFKC')
    .replace(ZERO_WIDTH_CHARACTERS_REGEX, '')
    .replace(TATWEEL_REGEX, '');

  return normalizeArabicCharacters(normalizedValue)
    .toLocaleLowerCase(language)
    .replace(NON_LETTER_OR_NUMBER_REGEX, ' ')
    .replace(WHITESPACE_REGEX, ' ')
    .trim();
}

function normalizeWithLeetspeak(value: string, language: LanguageCode) {
  return normalizeWordBankLookupValue(
    value.replace(
      /[!$0134@]/g,
      character => LEETSPEAK_CHARACTER_MAP[character],
    ),
    language,
  );
}

function getWordBankLookupKeys(value: string, language: LanguageCode) {
  const basicKey = normalizeWordBankLookupValue(value, language);

  if (!basicKey) {
    return [];
  }

  const leetspeakKey = normalizeWithLeetspeak(value, language);

  return leetspeakKey && leetspeakKey !== basicKey
    ? [basicKey, leetspeakKey]
    : [basicKey];
}

function getConceptTermValue(
  termValue: string | string[] | undefined,
): string | null {
  if (typeof termValue === 'string') {
    const trimmedValue = termValue.trim();

    return trimmedValue || null;
  }

  if (Array.isArray(termValue)) {
    const firstTerm = termValue[0]?.trim();

    return firstTerm || null;
  }

  return null;
}

wordBank.concepts.forEach(concept => {
  conceptById.set(concept.id, concept);
});

supportedLanguageCodes.forEach(language => {
  const lookup = new Map<string, WordBankTermEntry>();
  const terms = wordBank.byLanguage[language]?.terms ?? [];

  terms.forEach(termEntry => {
    const normalizedValue = normalizeWordBankLookupValue(
      termEntry.normalized || termEntry.term,
      language,
    );

    if (!normalizedValue || lookup.has(normalizedValue)) {
      return;
    }

    lookup.set(normalizedValue, termEntry);
  });

  termLookupByLanguage[language] = lookup;
});

export function findWordBankMatch({
  destinationLanguage,
  sourceLanguage,
  text,
}: {
  destinationLanguage: LanguageCode;
  sourceLanguage: LanguageCode;
  text: string;
}): WordBankMatch | null {
  const termLookup = termLookupByLanguage[sourceLanguage];

  if (!termLookup) {
    return null;
  }

  const matchedTerm = getWordBankLookupKeys(text, sourceLanguage)
    .map(key => termLookup.get(key))
    .find((termEntry): termEntry is WordBankTermEntry => Boolean(termEntry));

  if (!matchedTerm) {
    return null;
  }

  const concept = conceptById.get(matchedTerm.conceptId);

  if (!concept) {
    return null;
  }

  const destinationText =
    destinationLanguage === sourceLanguage
      ? text.trim()
      : getConceptTermValue(concept.terms[destinationLanguage]);

  if (!destinationText) {
    return null;
  }

  return {
    conceptId: concept.id,
    destinationText,
    meaning: concept.meaning,
    recommendedAction: concept.recommendedAction,
    sourceLanguage,
    sourceTerm: matchedTerm.term,
  };
}
