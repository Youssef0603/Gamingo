import { getPhraseDisplayTranslations } from './phraseDisplay';

import type { LanguageCode } from '../types/language';
import type { Phrase } from '../types/phrase';

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function phraseMatchesSearch(
  phrase: Phrase,
  query: string,
  nativeLanguage: LanguageCode,
  learningLanguage: LanguageCode,
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const { helperTranslation, translation } = getPhraseDisplayTranslations(
    phrase,
    nativeLanguage,
    learningLanguage,
  );
  const searchableValues = [
    translation.text,
    translation.meaning,
    translation.pronunciation,
    helperTranslation.text,
    helperTranslation.meaning,
    helperTranslation.pronunciation,
    ...(phrase.tags ?? []),
  ];

  return searchableValues.some(
    value =>
      typeof value === 'string' &&
      normalizeSearchText(value).includes(normalizedQuery),
  );
}
