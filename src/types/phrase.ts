import type { LanguageCode } from './language';

export type PhraseCategory =
  | 'callouts'
  | 'instructions'
  | 'strategy'
  | 'objective'
  | 'danger'
  | 'economy'
  | 'teamwork'
  | 'slang'
  | 'toxic'
  | 'antiToxic';

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
  tags?: string[];
  isToxic?: boolean;
  saferAlternative?: string;
}
