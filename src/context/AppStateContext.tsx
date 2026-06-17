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
import { trackFavoriteSaveAction } from '../features/ads/mobileAds';
import { theme } from '../theme/theme';
import { supportedLanguageCodes } from '../types/language';
import {
  getAutoSelectedLanguagePair,
  getDeviceLocale,
  getPreferredLearningLanguage,
} from '../utils/languageSelection';

import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseCategory, PhraseTranslation } from '../types/phrase';

export type LanguagePickerTarget = 'favorites' | 'learning' | 'native';

export type FavoriteIdsByLanguage = Partial<Record<LanguageCode, string[]>>;

export type BottomSheetContent = {
  type: 'language-picker';
  target: LanguagePickerTarget;
} | null;

type AppStateContextValue = {
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
  isFavorite: (phraseId: string, language?: LanguageCode) => boolean;
  nativeLanguage: LanguageCode;
  openLanguagePicker: (target: LanguagePickerTarget) => void;
  phrases: Phrase[];
  selectedLanguage: LanguageCode;
  setFavoriteFilterLanguage: (language: LanguageCode) => void;
  setNativeLanguage: (language: LanguageCode) => void;
  setSelectedLanguage: (language: LanguageCode) => void;
  toggleFavorite: (phraseId: string, language?: LanguageCode) => void;
};

type PersistedAppState = {
  customPhrases?: Phrase[];
  favoriteFilterLanguage: LanguageCode;
  favoriteIds?: string[];
  favoriteIdsByLanguage: FavoriteIdsByLanguage;
  nativeLanguage: LanguageCode;
  selectedLanguage: LanguageCode;
};

const APP_STATE_STORAGE_KEY = 'playcall.app-state';

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
  const [bottomSheetContent, setBottomSheetContent] =
    useState<BottomSheetContent>(null);
  const [customPhrases, setCustomPhrases] = useState<Phrase[]>([]);
  const [favoriteIdsByLanguage, setFavoriteIdsByLanguage] =
    useState<FavoriteIdsByLanguage>({});
  const [favoriteFilterLanguage, setFavoriteFilterLanguage] =
    useState<LanguageCode>('en');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>('en');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAppState() {
      try {
        const storedValue = await AsyncStorage.getItem(APP_STATE_STORAGE_KEY);
        const autoSelectedLanguages = getAutoSelectedLanguagePair(
          getDeviceLocale(),
        );

        if (!storedValue) {
          setNativeLanguage(autoSelectedLanguages.nativeLanguage);
          setSelectedLanguage(autoSelectedLanguages.selectedLanguage);
          setFavoriteFilterLanguage(autoSelectedLanguages.selectedLanguage);
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
        const nextCustomPhrases = sanitizeCustomPhrases(
          parsedValue.customPhrases,
        );
        const migratedFavoriteIds = sanitizeFavoriteIds(parsedValue.favoriteIds);

        setCustomPhrases(nextCustomPhrases);
        setNativeLanguage(nextNativeLanguage);
        setSelectedLanguage(nextSelectedLanguage);
        setFavoriteFilterLanguage(nextFavoriteFilterLanguage);

        if (Object.keys(nextFavoriteIdsByLanguage).length > 0) {
          setFavoriteIdsByLanguage(nextFavoriteIdsByLanguage);
        } else if (migratedFavoriteIds.length > 0) {
          setFavoriteIdsByLanguage({
            [nextSelectedLanguage]: migratedFavoriteIds,
          });
        }
      } catch (error) {
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
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistAppState = async () => {
      try {
        await AsyncStorage.setItem(
          APP_STATE_STORAGE_KEY,
          JSON.stringify({
            customPhrases,
            favoriteFilterLanguage,
            favoriteIdsByLanguage,
            nativeLanguage,
            selectedLanguage,
          } satisfies PersistedAppState),
        );
      } catch (error) {
        console.warn('Failed to persist app state.', error);
      }
    };

    persistAppState();
  }, [
    customPhrases,
    favoriteFilterLanguage,
    favoriteIdsByLanguage,
    isHydrated,
    nativeLanguage,
    selectedLanguage,
  ]);

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
  const favoriteIds = favoriteIdsByLanguage[selectedLanguage] ?? [];
  const favoriteLanguageOptions = getFavoriteLanguageOptions(favoriteIdsByLanguage);
  const phraseMap = useMemo(() => {
    const nextValue: Record<string, Phrase> = {};

    phrases.forEach(phrase => {
      nextValue[phrase.id] = phrase;
    });

    return nextValue;
  }, [phrases]);

  const getFavoriteIdsForLanguage = (language: LanguageCode) =>
    favoriteIdsByLanguage[language] ?? [];

  const getPhraseById = (phraseId: string) => phraseMap[phraseId] ?? null;

  const isFavorite = (phraseId: string, language = selectedLanguage) =>
    getFavoriteIdsForLanguage(language).includes(phraseId);

  const toggleFavorite = (phraseId: string, language = selectedLanguage) => {
    const shouldSaveToFavorites = !isFavorite(phraseId, language);

    setFavoriteIdsByLanguage(current => {
      const currentLanguageFavorites = current[language] ?? [];
      const nextLanguageFavorites = currentLanguageFavorites.includes(phraseId)
        ? currentLanguageFavorites.filter(id => id !== phraseId)
        : [...currentLanguageFavorites, phraseId];

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
      trackFavoriteSaveAction();
    }
  };

  const deleteCustomPhrase = (phraseId: string) => {
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
    setBottomSheetContent({ type: 'language-picker', target });
  };

  const closeBottomSheet = () => {
    setBottomSheetContent(null);
  };

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
        addCustomPhrase,
        addPhraseToFavorites,
        bottomSheetContent,
        closeBottomSheet,
        deleteCustomPhrase,
        favoriteIds,
        favoriteFilterLanguage,
        favoriteLanguageOptions,
        getFavoriteIdsForLanguage,
        getPhraseById,
        isFavorite,
        nativeLanguage,
        openLanguagePicker,
        phrases,
        selectedLanguage,
        setFavoriteFilterLanguage,
        setNativeLanguage,
        setSelectedLanguage,
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
