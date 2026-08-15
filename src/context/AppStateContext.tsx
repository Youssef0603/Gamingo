import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { categoryOrder } from '../data/categories';
import { phrases as basePhrases } from '../data/phrases';
import {
  initializeAdsPolicy,
  subscribeToAdsPolicyUpdates,
} from '../features/ads/adsPolicy';
import { trackFavoriteSaveAction } from '../features/ads/mobileAds';
import { trackReviewMilestone } from '../features/reviews/appReview';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  getPhraseAnalyticsParams,
  setAnalyticsContext,
  toAnalyticsBoolean,
  trackAnalyticsEvent,
} from '../services/analytics';
import { getItemWithMigration, STORAGE_KEYS } from '../storage/asyncStorageKeys';
import {
  getAppRemoteConfigState,
  sanitizeAppRemoteConfig,
  setAppRemoteConfigState,
} from '../state/appRemoteConfigStore';
import { theme } from '../theme/theme';
import { supportedLanguageCodes } from '../types/language';
import {
  getAutoSelectedLanguagePair,
  getDeviceLocale,
  getPreferredLearningLanguage,
} from '../utils/languageSelection';

import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseCategory, PhraseTranslation } from '../types/phrase';
import type { AdsPolicy } from '../features/ads/adsPolicy';
import type { AppRemoteConfig } from '../state/appRemoteConfigStore';

export type LanguagePickerTarget = 'favorites' | 'learning' | 'native';

export type FavoriteIdsByLanguage = Partial<Record<LanguageCode, string[]>>;

export type BottomSheetContent = {
  type: 'language-picker';
  target: LanguagePickerTarget;
} | null;

type AppStateContextValue = {
  acknowledgeToxicCategoryDisclosure: () => void;
  addCustomPhrase: (
    nativeText: string,
    learningText: string,
    inputLanguage?: LanguageCode,
    learningLanguage?: LanguageCode,
  ) => Phrase;
  addPhraseToFavorites: (phrase: Phrase, language?: LanguageCode) => void;
  bottomSheetContent: BottomSheetContent;
  closeBottomSheet: () => void;
  deleteCustomPhrase: (phraseId: string) => void;
  favoriteIds: string[];
  favoriteFilterLanguage: LanguageCode;
  favoriteLanguageOptions: LanguageCode[];
  getFavoriteIdsForLanguage: (language: LanguageCode) => string[];
  getPhraseById: (phraseId: string) => Phrase | null;
  hasAcknowledgedToxicCategoryDisclosure: boolean;
  isFavorite: (phraseId: string, language?: LanguageCode) => boolean;
  nativeLanguage: LanguageCode;
  openLanguagePicker: (target: LanguagePickerTarget) => void;
  phrases: Phrase[];
  remoteConfig: AppRemoteConfig;
  selectedLanguage: LanguageCode;
  setFavoriteFilterLanguage: (language: LanguageCode) => void;
  setNativeLanguage: (language: LanguageCode) => void;
  setSelectedLanguage: (language: LanguageCode) => void;
  debugSnapshot: AppStateDebugSnapshot;
  toggleFavorite: (phraseId: string, language?: LanguageCode) => void;
};

export type AppStateDebugSnapshot = {
  bottomSheetContent: BottomSheetContent;
  customPhraseCount: number;
  favoriteFilterLanguage: LanguageCode;
  favoriteIds: string[];
  favoriteIdsByLanguage: FavoriteIdsByLanguage;
  favoriteLanguageOptions: LanguageCode[];
  isHydrated: boolean;
  nativeLanguage: LanguageCode;
  remoteConfig: AppRemoteConfig;
  selectedLanguage: LanguageCode;
};

type PersistedAppState = {
  customPhrases?: Phrase[];
  favoriteFilterLanguage: LanguageCode;
  favoriteIds?: string[];
  favoriteIdsByLanguage: FavoriteIdsByLanguage;
  hasAcknowledgedToxicCategoryDisclosure?: boolean;
  nativeLanguage: LanguageCode;
  remoteConfig?: AppRemoteConfig;
  selectedLanguage: LanguageCode;
};

const phraseCategories: PhraseCategory[] = categoryOrder;

const AppStateContext = createContext<AppStateContextValue | null>(null);

function isLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === 'string' &&
    supportedLanguageCodes.includes(value as LanguageCode)
  );
}

function sanitizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();

  value.forEach(phraseId => {
    if (typeof phraseId === 'string') {
      uniqueIds.add(phraseId);
    }
  });

  return Array.from(uniqueIds);
}

function sanitizeFavoriteIdsByLanguage(value: unknown): FavoriteIdsByLanguage {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const candidate = value as Partial<Record<LanguageCode, unknown>>;
  const nextValue: FavoriteIdsByLanguage = {};

  supportedLanguageCodes.forEach(language => {
    const favoriteIds = sanitizeFavoriteIds(candidate[language]);

    if (favoriteIds.length > 0) {
      nextValue[language] = favoriteIds;
    }
  });

  return nextValue;
}

function isPhraseCategory(value: unknown): value is PhraseCategory {
  return (
    typeof value === 'string' &&
    phraseCategories.includes(value as PhraseCategory)
  );
}

function isPhraseTranslation(value: unknown): value is PhraseTranslation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PhraseTranslation>;

  return (
    typeof candidate.text === 'string' &&
    typeof candidate.meaning === 'string' &&
    (candidate.pronunciation === undefined ||
      typeof candidate.pronunciation === 'string')
  );
}

function isCustomPhraseLanguages(
  value: unknown,
): value is NonNullable<Phrase['customLanguages']> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NonNullable<Phrase['customLanguages']>>;

  return (
    isLanguageCode(candidate.native) && isLanguageCode(candidate.learning)
  );
}

function sanitizePhrase(value: unknown): Phrase | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<Phrase>;

  if (
    typeof candidate.id !== 'string' ||
    !isPhraseCategory(candidate.category) ||
    !candidate.translations ||
    typeof candidate.translations !== 'object' ||
    !isPhraseTranslation(candidate.translations.en)
  ) {
    return null;
  }

  const translations = {
    en: candidate.translations.en,
  } as Phrase['translations'];

  supportedLanguageCodes.forEach(language => {
    const translation = candidate.translations?.[language];

    if (language !== 'en' && isPhraseTranslation(translation)) {
      translations[language] = translation;
    }
  });

  return {
    id: candidate.id,
    category: candidate.category,
    customLanguages: isCustomPhraseLanguages(candidate.customLanguages)
      ? candidate.customLanguages
      : undefined,
    isToxic:
      typeof candidate.isToxic === 'boolean' ? candidate.isToxic : undefined,
    saferAlternative:
      typeof candidate.saferAlternative === 'string'
        ? candidate.saferAlternative
        : undefined,
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.filter(tag => typeof tag === 'string')
      : undefined,
    translations,
  };
}

function sanitizeCustomPhrases(value: unknown): Phrase[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  const sanitizedPhrases: Phrase[] = [];

  value.forEach(item => {
    const phrase = sanitizePhrase(item);

    if (!phrase || seenIds.has(phrase.id)) {
      return;
    }

    seenIds.add(phrase.id);
    sanitizedPhrases.push(phrase);
  });

  return sanitizedPhrases;
}

function createCustomPhrase(
  nativeText: string,
  learningText: string,
  inputLanguage: LanguageCode,
  learningLanguage: LanguageCode,
): Phrase {
  const trimmedNativeText = nativeText.trim();
  const trimmedLearningText = learningText.trim();
  const inputTranslation: PhraseTranslation = {
    text: trimmedNativeText,
    meaning: 'Custom word added by you.',
  };
  const learningTranslation: PhraseTranslation = {
    text: trimmedLearningText,
    meaning: 'Custom word added by you.',
  };
  const translations = {
    en:
      inputLanguage === 'en'
        ? inputTranslation
        : learningLanguage === 'en'
          ? learningTranslation
          : inputTranslation,
  } as Phrase['translations'];

  translations[inputLanguage] = inputTranslation;
  translations[learningLanguage] = learningTranslation;

  return {
    id: `custom-${learningLanguage}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    category: 'custom',
    customLanguages: {
      native: inputLanguage,
      learning: learningLanguage,
    },
    tags: ['custom'],
    translations,
  };
}

function getFavoriteLanguageOptions(
  favoriteIdsByLanguage: FavoriteIdsByLanguage,
): LanguageCode[] {
  return supportedLanguageCodes.filter(
    language => (favoriteIdsByLanguage[language]?.length ?? 0) > 0,
  );
}

function getFavoriteTotalCount(favoriteIdsByLanguage: FavoriteIdsByLanguage) {
  return Object.values(favoriteIdsByLanguage).reduce(
    (totalCount, favoriteIds) => totalCount + (favoriteIds?.length ?? 0),
    0,
  );
}

function upsertCustomPhrase(current: Phrase[], nextPhrase: Phrase): Phrase[] {
  const existingIndex = current.findIndex(phrase => phrase.id === nextPhrase.id);

  if (existingIndex === -1) {
    return [...current, nextPhrase];
  }

  const nextValue = [...current];
  nextValue[existingIndex] = nextPhrase;

  return nextValue;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [
    hasAcknowledgedToxicCategoryDisclosure,
    setHasAcknowledgedToxicCategoryDisclosure,
  ] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] =
    useState<BottomSheetContent>(null);
  const [customPhrases, setCustomPhrases] = useState<Phrase[]>([]);
  const [favoriteIdsByLanguage, setFavoriteIdsByLanguage] =
    useState<FavoriteIdsByLanguage>({});
  const [favoriteFilterLanguage, setFavoriteFilterLanguage] =
    useState<LanguageCode>('en');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>('en');
  const [remoteConfig, setRemoteConfig] = useState<AppRemoteConfig>(
    getAppRemoteConfigState(),
  );
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (isHydrated) {
      return;
    }

    let isMounted = true;

    async function hydrateAppState() {
      try {
        const storedValue = await getItemWithMigration('appState');
        const autoSelectedLanguages = getAutoSelectedLanguagePair(
          getDeviceLocale(),
        );

        if (!storedValue) {
          setNativeLanguage(autoSelectedLanguages.nativeLanguage);
          setSelectedLanguage(autoSelectedLanguages.selectedLanguage);
          setFavoriteFilterLanguage(autoSelectedLanguages.selectedLanguage);
          trackAnalyticsEvent(ANALYTICS_EVENTS.APP_HYDRATED, {
            [ANALYTICS_PARAMS.LEARNING_LANG]:
              autoSelectedLanguages.selectedLanguage,
            [ANALYTICS_PARAMS.NATIVE_LANG]:
              autoSelectedLanguages.nativeLanguage,
            [ANALYTICS_PARAMS.RESULT]: 'fresh_state',
            [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
          }).catch(() => undefined);
          return;
        }

        const parsedValue: Partial<PersistedAppState> = JSON.parse(storedValue);
        const nextNativeLanguage = isLanguageCode(parsedValue.nativeLanguage)
          ? parsedValue.nativeLanguage
          : autoSelectedLanguages.nativeLanguage;
        const nextSelectedLanguage = isLanguageCode(parsedValue.selectedLanguage)
          ? parsedValue.selectedLanguage
          : getPreferredLearningLanguage(nextNativeLanguage);
        const nextFavoriteFilterLanguage = isLanguageCode(
          parsedValue.favoriteFilterLanguage,
        )
          ? parsedValue.favoriteFilterLanguage
          : nextSelectedLanguage;
        const nextFavoriteIdsByLanguage = sanitizeFavoriteIdsByLanguage(
          parsedValue.favoriteIdsByLanguage,
        );
        const nextHasAcknowledgedToxicCategoryDisclosure =
          parsedValue.hasAcknowledgedToxicCategoryDisclosure === true;
        const nextCustomPhrases = sanitizeCustomPhrases(
          parsedValue.customPhrases,
        );
        const nextRemoteConfig = sanitizeAppRemoteConfig(parsedValue.remoteConfig);
        const migratedFavoriteIds = sanitizeFavoriteIds(parsedValue.favoriteIds);

        setCustomPhrases(nextCustomPhrases);
        setNativeLanguage(nextNativeLanguage);
        setRemoteConfig(nextRemoteConfig);
        setSelectedLanguage(nextSelectedLanguage);
        setFavoriteFilterLanguage(nextFavoriteFilterLanguage);
        setHasAcknowledgedToxicCategoryDisclosure(
          nextHasAcknowledgedToxicCategoryDisclosure,
        );

        if (Object.keys(nextFavoriteIdsByLanguage).length > 0) {
          setFavoriteIdsByLanguage(nextFavoriteIdsByLanguage);
        } else if (migratedFavoriteIds.length > 0) {
          setFavoriteIdsByLanguage({
            [nextSelectedLanguage]: migratedFavoriteIds,
          });
        }

        trackAnalyticsEvent(ANALYTICS_EVENTS.APP_HYDRATED, {
          [ANALYTICS_PARAMS.CUSTOM_PHRASE_COUNT]: nextCustomPhrases.length,
          [ANALYTICS_PARAMS.FAVORITE_COUNT]: getFavoriteTotalCount(
            Object.keys(nextFavoriteIdsByLanguage).length > 0
              ? nextFavoriteIdsByLanguage
              : migratedFavoriteIds.length > 0
                ? { [nextSelectedLanguage]: migratedFavoriteIds }
                : {},
          ),
          [ANALYTICS_PARAMS.FAVORITE_LANG]: nextFavoriteFilterLanguage,
          [ANALYTICS_PARAMS.LEARNING_LANG]: nextSelectedLanguage,
          [ANALYTICS_PARAMS.NATIVE_LANG]: nextNativeLanguage,
          [ANALYTICS_PARAMS.RESULT]: 'restored_state',
          [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
        }).catch(() => undefined);
      } catch (error) {
        trackAnalyticsEvent(ANALYTICS_EVENTS.APP_HYDRATED, {
          ...getErrorAnalyticsParams(error),
          [ANALYTICS_PARAMS.RESULT]: 'failed',
          [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
        }).catch(() => undefined);
        console.warn('Failed to load persisted app state.', error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    }

    hydrateAppState();

    return () => {
      isMounted = false;
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistAppState = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.appState,
          JSON.stringify({
            customPhrases,
            favoriteFilterLanguage,
            favoriteIdsByLanguage,
            hasAcknowledgedToxicCategoryDisclosure,
            nativeLanguage,
            remoteConfig,
            selectedLanguage,
          } satisfies PersistedAppState),
        );
      } catch (error) {
        trackAnalyticsEvent(ANALYTICS_EVENTS.APP_PERSIST_FAILED, {
          ...getErrorAnalyticsParams(error),
          [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
        }).catch(() => undefined);
        console.warn('Failed to persist app state.', error);
      }
    };

    persistAppState();
  }, [
    customPhrases,
    favoriteFilterLanguage,
    favoriteIdsByLanguage,
    hasAcknowledgedToxicCategoryDisclosure,
    isHydrated,
    nativeLanguage,
    remoteConfig,
    selectedLanguage,
  ]);

  useEffect(() => {
    setAppRemoteConfigState(remoteConfig);
  }, [remoteConfig]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let isMounted = true;

    const syncAdsPolicy = (adsPolicy: AdsPolicy) => {
      if (!isMounted) {
        return;
      }

      setRemoteConfig(current => ({
        ...current,
        adsPolicy,
      }));
    };

    const unsubscribeFromAdsPolicy = subscribeToAdsPolicyUpdates(syncAdsPolicy);

    initializeAdsPolicy()
      .then(syncAdsPolicy)
      .catch(error => {
        console.warn('Failed to initialize remote config app state.', error);
      });

    return () => {
      isMounted = false;
      unsubscribeFromAdsPolicy();
    };
  }, [isHydrated]);

  useEffect(() => {
    const availableLanguages = getFavoriteLanguageOptions(favoriteIdsByLanguage);

    if (availableLanguages.length === 0) {
      if (favoriteFilterLanguage !== selectedLanguage) {
        setFavoriteFilterLanguage(selectedLanguage);
      }

      return;
    }

    if (availableLanguages.includes(favoriteFilterLanguage)) {
      return;
    }

    if (availableLanguages.includes(selectedLanguage)) {
      setFavoriteFilterLanguage(selectedLanguage);
      return;
    }

    setFavoriteFilterLanguage(availableLanguages[0]);
  }, [favoriteFilterLanguage, favoriteIdsByLanguage, selectedLanguage]);

  const phrases = useMemo(
    () => [...basePhrases, ...customPhrases],
    [customPhrases],
  );
  const favoriteIds = useMemo(
    () => favoriteIdsByLanguage[selectedLanguage] ?? [],
    [favoriteIdsByLanguage, selectedLanguage],
  );
  const favoriteLanguageOptions = getFavoriteLanguageOptions(favoriteIdsByLanguage);
  const favoriteTotalCount = getFavoriteTotalCount(favoriteIdsByLanguage);
  const phraseMap = useMemo(() => {
    const nextValue: Record<string, Phrase> = {};

    phrases.forEach(phrase => {
      nextValue[phrase.id] = phrase;
    });

    return nextValue;
  }, [phrases]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setAnalyticsContext({
      adsPolicy: remoteConfig.adsPolicy,
      customPhraseCount: customPhrases.length,
      deviceLocale: getDeviceLocale(),
      favoriteCount: favoriteTotalCount,
      favoriteFilterLanguage,
      hasAcknowledgedToxicCategoryDisclosure,
      nativeLanguage,
      selectedLanguage,
    });
  }, [
    customPhrases.length,
    favoriteFilterLanguage,
    favoriteTotalCount,
    hasAcknowledgedToxicCategoryDisclosure,
    isHydrated,
    nativeLanguage,
    remoteConfig.adsPolicy,
    selectedLanguage,
  ]);

  const getFavoriteIdsForLanguage = (language: LanguageCode) =>
    favoriteIdsByLanguage[language] ?? [];

  const getPhraseById = (phraseId: string) => phraseMap[phraseId] ?? null;

  const isFavorite = (phraseId: string, language = selectedLanguage) =>
    getFavoriteIdsForLanguage(language).includes(phraseId);

  const toggleFavorite = (phraseId: string, language = selectedLanguage) => {
    const phrase = getPhraseById(phraseId);
    const currentLanguageFavorites = getFavoriteIdsForLanguage(language);
    const shouldSaveToFavorites = !isFavorite(phraseId, language);
    const nextFavoriteCount = shouldSaveToFavorites
      ? currentLanguageFavorites.length + 1
      : Math.max(0, currentLanguageFavorites.length - 1);

    trackAnalyticsEvent(ANALYTICS_EVENTS.FAVORITE_TOGGLED, {
      ...getPhraseAnalyticsParams(phrase, nativeLanguage, language),
      [ANALYTICS_PARAMS.FAVORITE_COUNT]: nextFavoriteCount,
      [ANALYTICS_PARAMS.IS_FAVORITE]: toAnalyticsBoolean(shouldSaveToFavorites),
      [ANALYTICS_PARAMS.LEARNING_LANG]: language,
      [ANALYTICS_PARAMS.ORIGIN]: 'favorite_toggle',
      [ANALYTICS_PARAMS.UI_ACTION]: shouldSaveToFavorites ? 'save' : 'remove',
    }).catch(() => undefined);

    setFavoriteIdsByLanguage(current => {
      const storedLanguageFavorites = current[language] ?? [];
      const nextLanguageFavorites = storedLanguageFavorites.includes(phraseId)
        ? storedLanguageFavorites.filter(id => id !== phraseId)
        : [...storedLanguageFavorites, phraseId];

      if (nextLanguageFavorites.length === 0) {
        const rest = { ...current };

        delete rest[language];

        return rest;
      }

      return {
        ...current,
        [language]: nextLanguageFavorites,
      };
    });

    if (shouldSaveToFavorites) {
      trackFavoriteSaveAction();
      trackReviewMilestone('favorite-save');
    }
  };

  const addCustomPhrase = (
    nativeText: string,
    learningText: string,
    inputLanguage = nativeLanguage,
    learningLanguage = selectedLanguage,
  ) => {
    const nextPhrase = createCustomPhrase(
      nativeText,
      learningText,
      inputLanguage,
      learningLanguage,
    );

    setCustomPhrases(current => [...current, nextPhrase]);

    return nextPhrase;
  };

  const addPhraseToFavorites = (phrase: Phrase, language = selectedLanguage) => {
    const isAlreadyFavorite = isFavorite(phrase.id, language);
    const staticPhraseExists = basePhrases.some(item => item.id === phrase.id);

    if (!staticPhraseExists) {
      setCustomPhrases(current => upsertCustomPhrase(current, phrase));
    }

    setFavoriteIdsByLanguage(current => {
      const currentLanguageFavorites = current[language] ?? [];

      if (currentLanguageFavorites.includes(phrase.id)) {
        return current;
      }

      return {
        ...current,
        [language]: [...currentLanguageFavorites, phrase.id],
      };
    });

    if (!isAlreadyFavorite) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.FAVORITE_TOGGLED, {
        ...getPhraseAnalyticsParams(phrase, nativeLanguage, language),
        [ANALYTICS_PARAMS.IS_FAVORITE]: 'true',
        [ANALYTICS_PARAMS.LEARNING_LANG]: language,
        [ANALYTICS_PARAMS.ORIGIN]: 'add_phrase_modal',
        [ANALYTICS_PARAMS.UI_ACTION]: 'save',
      }).catch(() => undefined);
      trackFavoriteSaveAction();
      trackReviewMilestone('favorite-save');
    }
  };

  const deleteCustomPhrase = (phraseId: string) => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.CUSTOM_PHRASE_DELETED, {
      ...getPhraseAnalyticsParams(
        getPhraseById(phraseId),
        nativeLanguage,
        selectedLanguage,
      ),
      [ANALYTICS_PARAMS.ORIGIN]: 'app_state',
    }).catch(() => undefined);

    setCustomPhrases(current => current.filter(phrase => phrase.id !== phraseId));
    setFavoriteIdsByLanguage(current => {
      const nextValue: FavoriteIdsByLanguage = {};

      supportedLanguageCodes.forEach(language => {
        const nextFavorites = (current[language] ?? []).filter(
          id => id !== phraseId,
        );

        if (nextFavorites.length > 0) {
          nextValue[language] = nextFavorites;
        }
      });

      return nextValue;
    });
  };

  const openLanguagePicker = (target: LanguagePickerTarget) => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.LANGUAGE_PICKER_OPENED, {
      [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
      [ANALYTICS_PARAMS.LANGUAGE_TARGET]: target,
      [ANALYTICS_PARAMS.LEARNING_LANG]: selectedLanguage,
      [ANALYTICS_PARAMS.NATIVE_LANG]: nativeLanguage,
      [ANALYTICS_PARAMS.ORIGIN]: 'app_state',
    }).catch(() => undefined);

    setBottomSheetContent({ type: 'language-picker', target });
  };

  const closeBottomSheet = () => {
    setBottomSheetContent(null);
  };

  const acknowledgeToxicCategoryDisclosure = () => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.TOXIC_DISCLOSURE_ACCEPTED, {
      [ANALYTICS_PARAMS.CATEGORY]: 'toxic',
      [ANALYTICS_PARAMS.ORIGIN]: 'practice_screen',
    }).catch(() => undefined);
    setHasAcknowledgedToxicCategoryDisclosure(true);
  };

  const updateFavoriteFilterLanguage = (language: LanguageCode) => {
    if (favoriteFilterLanguage !== language) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.LANGUAGE_CHANGED, {
        [ANALYTICS_PARAMS.LANGUAGE_TARGET]: 'favorites',
        [ANALYTICS_PARAMS.NEXT_LANG]: language,
        [ANALYTICS_PARAMS.PREVIOUS_LANG]: favoriteFilterLanguage,
      }).catch(() => undefined);
    }

    setFavoriteFilterLanguage(language);
  };

  const updateNativeLanguage = (language: LanguageCode) => {
    if (nativeLanguage !== language) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.LANGUAGE_CHANGED, {
        [ANALYTICS_PARAMS.LANGUAGE_TARGET]: 'native',
        [ANALYTICS_PARAMS.NEXT_LANG]: language,
        [ANALYTICS_PARAMS.PREVIOUS_LANG]: nativeLanguage,
      }).catch(() => undefined);
    }

    setNativeLanguage(language);
  };

  const updateSelectedLanguage = (language: LanguageCode) => {
    if (selectedLanguage !== language) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.LANGUAGE_CHANGED, {
        [ANALYTICS_PARAMS.LANGUAGE_TARGET]: 'learning',
        [ANALYTICS_PARAMS.NEXT_LANG]: language,
        [ANALYTICS_PARAMS.PREVIOUS_LANG]: selectedLanguage,
      }).catch(() => undefined);
    }

    setSelectedLanguage(language);
  };

  const debugSnapshot = useMemo<AppStateDebugSnapshot>(
    () => ({
      bottomSheetContent,
      customPhraseCount: customPhrases.length,
      favoriteFilterLanguage,
      favoriteIds,
      favoriteIdsByLanguage,
      favoriteLanguageOptions,
      isHydrated,
      nativeLanguage,
      remoteConfig,
      selectedLanguage,
    }),
    [
      bottomSheetContent,
      customPhrases.length,
      favoriteFilterLanguage,
      favoriteIds,
      favoriteIdsByLanguage,
      favoriteLanguageOptions,
      isHydrated,
      nativeLanguage,
      remoteConfig,
      selectedLanguage,
    ],
  );

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} size="small" />
      </View>
    );
  }

  return (
    <AppStateContext.Provider
      value={{
        acknowledgeToxicCategoryDisclosure,
        addCustomPhrase,
        addPhraseToFavorites,
        bottomSheetContent,
        closeBottomSheet,
        debugSnapshot,
        deleteCustomPhrase,
        favoriteIds,
        favoriteFilterLanguage,
        favoriteLanguageOptions,
        getFavoriteIdsForLanguage,
        getPhraseById,
        hasAcknowledgedToxicCategoryDisclosure,
        isFavorite,
        nativeLanguage,
        openLanguagePicker,
        phrases,
        remoteConfig,
        selectedLanguage,
        setFavoriteFilterLanguage: updateFavoriteFilterLanguage,
        setNativeLanguage: updateNativeLanguage,
        setSelectedLanguage: updateSelectedLanguage,
        toggleFavorite,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider.');
  }

  return context;
}

export function useAppStateDebugSnapshot(): AppStateDebugSnapshot {
  return useAppState().debugSnapshot;
}
