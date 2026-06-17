import {
  getAutoSelectedLanguagePair,
  getPreferredLearningLanguage,
  getSupportedLanguageFromLocale,
} from '../src/utils/languageSelection';

describe('languageSelection', () => {
  it('maps supported locale strings to app language codes', () => {
    expect(getSupportedLanguageFromLocale('ru-RU')).toBe('ru');
    expect(getSupportedLanguageFromLocale('pt_BR')).toBe('pt');
    expect(getSupportedLanguageFromLocale('zh-Hans-CN')).toBe('zh');
  });

  it('returns null when the locale is unsupported', () => {
    expect(getSupportedLanguageFromLocale('sv-SE')).toBeNull();
    expect(getSupportedLanguageFromLocale(null)).toBeNull();
  });

  it('prioritizes English for learning unless English is native', () => {
    expect(getPreferredLearningLanguage('ru')).toBe('en');
    expect(getPreferredLearningLanguage('fr')).toBe('en');
  });

  it('falls back to Russian when English is native', () => {
    expect(getPreferredLearningLanguage('en')).toBe('ru');
  });

  it('builds the first-launch pair from the device locale', () => {
    expect(getAutoSelectedLanguagePair('ru-RU')).toEqual({
      nativeLanguage: 'ru',
      selectedLanguage: 'en',
    });
    expect(getAutoSelectedLanguagePair('en-US')).toEqual({
      nativeLanguage: 'en',
      selectedLanguage: 'ru',
    });
    expect(getAutoSelectedLanguagePair('sv-SE')).toEqual({
      nativeLanguage: 'en',
      selectedLanguage: 'ru',
    });
  });
});
