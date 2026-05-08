import type { LanguageCode } from './language';

export type PhraseCategory =
  | 'callouts'
  | 'instructions'
  | 'strategy'
  | 'objective'
  | 'danger'
  | 'economy'
  | 'teamwork'
  | 'abbreviations'
  | 'slang'
  | 'toxic'
  | 'antiToxic'
  | 'custom';

export interface PhraseTranslation {
  text: string;
  meaning: string;
  pronunciation?: string;
}

export interface Phrase {
  id: string;
  category: PhraseCategory;
  translations: {
    en: PhraseTranslation;
  } & Partial<Record<LanguageCode, PhraseTranslation>>;
  customLanguages?: {
    native: LanguageCode;
    learning: LanguageCode;
  };
  tags?: string[];
  isToxic?: boolean;
  saferAlternative?: string;
}
