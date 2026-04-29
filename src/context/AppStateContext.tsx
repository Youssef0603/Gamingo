import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { phrases } from '../data/phrases';
import { theme } from '../theme/theme';
import { supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseTranslation } from '../types/phrase';

export type LanguagePickerTarget = 'favorites' | 'learning' | 'native';

export type FavoriteIdsByLanguage = Partial<Record<LanguageCode, string[]>>;

export type BottomSheetContent = {
  type: 'language-picker';
  target: LanguagePickerTarget;
} | null;

type AppStateContextValue = {
  addPhraseToFavorites: (phrase: Phrase, language?: LanguageCode) => void;
  allPhrases: Phrase[];
  bottomSheetContent: BottomSheetContent;
  closeBottomSheet: () => void;
  favoriteIds: string[];
  favoriteFilterLanguage: LanguageCode;
  favoriteLanguageOptions: LanguageCode[];
  getFavoriteIdsForLanguage: (language: LanguageCode) => string[];
  getPhraseById: (phraseId: string) => Phrase | null;
  isFavorite: (phraseId: string, language?: LanguageCode) => boolean;
  nativeLanguage: LanguageCode;
  openLanguagePicker: (target: LanguagePickerTarget) => void;
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

function isPhraseTranslation(value: unknown): value is PhraseTranslation {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'text' in value &&
      'meaning' in value &&
      typeof value.text === 'string' &&
      typeof value.meaning === 'string',
  );
}

function sanitizeCustomPhrases(value: unknown): Record<string, Phrase> {
  if (!Array.isArray(value)) {
    return {};
  }

  return value.reduce<Record<string, Phrase>>((accumulator, item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.id !== 'string' ||
      typeof item.category !== 'string' ||
      !item.translations ||
      typeof item.translations !== 'object' ||
      !isPhraseTranslation((item.translations as Phrase['translations']).en)
    ) {
      return accumulator;
    }

    const phrase = item as Phrase;

    accumulator[phrase.id] = phrase;
    return accumulator;
  }, {});
}

function getFavoriteLanguageOptions(
  favoriteIdsByLanguage: FavoriteIdsByLanguage,
): LanguageCode[] {
  return supportedLanguageCodes.filter(
    language => (favoriteIdsByLanguage[language]?.length ?? 0) > 0,
  );
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [bottomSheetContent, setBottomSheetContent] =
    useState<BottomSheetContent>(null);
  const [favoriteIdsByLanguage, setFavoriteIdsByLanguage] =
    useState<FavoriteIdsByLanguage>({});
  const [customPhrasesById, setCustomPhrasesById] =
    useState<Record<string, Phrase>>({});
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

        if (!storedValue) {
          return;
        }

        const parsedValue: Partial<PersistedAppState> = JSON.parse(storedValue);
        const nextNativeLanguage = isLanguageCode(parsedValue.nativeLanguage)
          ? parsedValue.nativeLanguage
          : 'en';
        const nextSelectedLanguage = isLanguageCode(parsedValue.selectedLanguage)
          ? parsedValue.selectedLanguage
          : 'en';
        const nextFavoriteFilterLanguage = isLanguageCode(
          parsedValue.favoriteFilterLanguage,
        )
          ? parsedValue.favoriteFilterLanguage
          : nextSelectedLanguage;
        const nextFavoriteIdsByLanguage = sanitizeFavoriteIdsByLanguage(
          parsedValue.favoriteIdsByLanguage,
        );
        const nextCustomPhrasesById = sanitizeCustomPhrases(
          parsedValue.customPhrases,
        );
        const migratedFavoriteIds = sanitizeFavoriteIds(parsedValue.favoriteIds);

        setNativeLanguage(nextNativeLanguage);
        setSelectedLanguage(nextSelectedLanguage);
        setFavoriteFilterLanguage(nextFavoriteFilterLanguage);
        setCustomPhrasesById(nextCustomPhrasesById);

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
            customPhrases: Object.values(customPhrasesById),
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
    customPhrasesById,
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

  const favoriteIds = favoriteIdsByLanguage[selectedLanguage] ?? [];
  const favoriteLanguageOptions = getFavoriteLanguageOptions(favoriteIdsByLanguage);
  const allPhrases = [...phrases, ...Object.values(customPhrasesById)];

  const getFavoriteIdsForLanguage = (language: LanguageCode) =>
    favoriteIdsByLanguage[language] ?? [];

  const getPhraseById = (phraseId: string) =>
    customPhrasesById[phraseId] ??
    phrases.find(phrase => phrase.id === phraseId) ??
    null;

  const isFavorite = (phraseId: string, language = selectedLanguage) =>
    getFavoriteIdsForLanguage(language).includes(phraseId);

  const toggleFavorite = (phraseId: string, language = selectedLanguage) => {
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
  };

  const addPhraseToFavorites = (phrase: Phrase, language = selectedLanguage) => {
    const staticPhraseExists = phrases.some(item => item.id === phrase.id);

    if (!staticPhraseExists) {
      setCustomPhrasesById(current => ({
        ...current,
        [phrase.id]: phrase,
      }));
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
        addPhraseToFavorites,
        allPhrases,
        bottomSheetContent,
        closeBottomSheet,
        favoriteIds,
        favoriteFilterLanguage,
        favoriteLanguageOptions,
        getFavoriteIdsForLanguage,
        getPhraseById,
        isFavorite,
        nativeLanguage,
        openLanguagePicker,
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
