import { phraseMatchesSearch } from '../src/utils/phraseSearch';

import type { Phrase } from '../src/types/phrase';

const phrase: Phrase = {
  category: 'callouts',
  id: 'behind-you',
  tags: ['warning'],
  translations: {
    en: {
      meaning: 'Warn a teammate about danger behind them.',
      text: 'Behind you!',
    },
    fr: {
      meaning: 'Avertir un coequipier.',
      pronunciation: 'deh-ryair twa',
      text: 'Derrière toi !',
    },
  },
};

describe('phraseMatchesSearch', () => {
  it('matches the displayed learning-language word', () => {
    expect(phraseMatchesSearch(phrase, 'derriere', 'en', 'fr')).toBe(true);
  });

  it('matches the displayed native-language translation', () => {
    expect(phraseMatchesSearch(phrase, 'BEHIND', 'en', 'fr')).toBe(true);
  });

  it('matches meanings, pronunciation, and tags', () => {
    expect(phraseMatchesSearch(phrase, 'danger', 'en', 'fr')).toBe(true);
    expect(phraseMatchesSearch(phrase, 'ryair', 'en', 'fr')).toBe(true);
    expect(phraseMatchesSearch(phrase, 'warning', 'en', 'fr')).toBe(true);
  });

  it('returns every phrase for an empty query', () => {
    expect(phraseMatchesSearch(phrase, '   ', 'en', 'fr')).toBe(true);
  });

  it('rejects unrelated words', () => {
    expect(phraseMatchesSearch(phrase, 'economy', 'en', 'fr')).toBe(false);
  });
});
