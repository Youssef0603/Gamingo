import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

export function getPhraseDisplayLanguages(
  phrase: Phrase,
  fallbackNativeLanguage: LanguageCode,
  fallbackLearningLanguage: LanguageCode,
) {
  return phrase.category === 'custom' && phrase.customLanguages
    ? phrase.customLanguages
    : {
        native: fallbackNativeLanguage,
        learning: fallbackLearningLanguage,
      };
}

export function getPhraseDisplayTranslations(
  phrase: Phrase,
  fallbackNativeLanguage: LanguageCode,
  fallbackLearningLanguage: LanguageCode,
): {
  helperLanguage: LanguageCode;
  helperTranslation: PhraseTranslation;
  learningLanguage: LanguageCode;
  translation: PhraseTranslation;
} {
  const english = phrase.translations.en;
  const { learning, native } = getPhraseDisplayLanguages(
    phrase,
    fallbackNativeLanguage,
    fallbackLearningLanguage,
  );

  return {
    helperLanguage: native,
    helperTranslation: phrase.translations[native] ?? english,
    learningLanguage: learning,
    translation: phrase.translations[learning] ?? english,
  };
}
