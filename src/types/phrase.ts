export type PhraseCategory = 'basic' | 'objectives' | 'toxic';

export type PhraseItem = {
  id: string;
  phrase: string;
  meaning: string;
  whenToUse: string;
  category: PhraseCategory;
  betterResponse?: string;
};
