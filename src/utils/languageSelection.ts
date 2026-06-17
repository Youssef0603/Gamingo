import { NativeModules, Platform } from 'react-native';

import { supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';

const prioritizedLearningLanguages: LanguageCode[] = [
  'en',
  'ru',
  ...supportedLanguageCodes.filter(
    language => language !== 'en' && language !== 'ru',
  ),
];

function isLanguageCode(value: string): value is LanguageCode {
  return supportedLanguageCodes.includes(value as LanguageCode);
}

function getIntlLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

export function getDeviceLocale() {
  const settingsManager = NativeModules.SettingsManager as
    | {
        settings?: {
          AppleLanguages?: string[];
          AppleLocale?: string;
        };
      }
    | undefined;
  const i18nManager = NativeModules.I18nManager as
    | {
        localeIdentifier?: string;
      }
    | undefined;

  const firstAppleLanguage =
    Array.isArray(settingsManager?.settings?.AppleLanguages) &&
    typeof settingsManager.settings.AppleLanguages[0] === 'string'
      ? settingsManager.settings.AppleLanguages[0]
      : null;
  const appleLocale =
    typeof settingsManager?.settings?.AppleLocale === 'string'
      ? settingsManager.settings.AppleLocale
      : null;
  const localeIdentifier =
    typeof i18nManager?.localeIdentifier === 'string'
      ? i18nManager.localeIdentifier
      : null;
  const intlLocale = getIntlLocale();

  if (Platform.OS === 'ios') {
    return firstAppleLanguage ?? appleLocale ?? localeIdentifier ?? intlLocale;
  }

  return localeIdentifier ?? firstAppleLanguage ?? appleLocale ?? intlLocale;
}

export function getSupportedLanguageFromLocale(
  locale: string | null | undefined,
): LanguageCode | null {
  if (!locale) {
    return null;
  }

  const normalizedLocale = locale.replace(/_/g, '-').toLowerCase();
  const segments = normalizedLocale.split('-');

  for (const segment of segments) {
    if (isLanguageCode(segment)) {
      return segment;
    }
  }

  return null;
}

export function getPreferredLearningLanguage(nativeLanguage: LanguageCode) {
  return (
    prioritizedLearningLanguages.find(language => language !== nativeLanguage) ??
    supportedLanguageCodes.find(language => language !== nativeLanguage) ??
    'en'
  );
}

export function getAutoSelectedLanguagePair(
  locale: string | null | undefined,
) {
  const nativeLanguage = getSupportedLanguageFromLocale(locale) ?? 'en';

  return {
    nativeLanguage,
    selectedLanguage: getPreferredLearningLanguage(nativeLanguage),
  };
}
