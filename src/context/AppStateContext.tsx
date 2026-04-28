import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { theme } from '../theme/theme';
import { supportedLanguageCodes } from '../types/language';

import type { LanguageCode } from '../types/language';

export type LanguagePickerTarget = 'favorites' | 'learning' | 'native';

export type FavoriteIdsByLanguage = Partial<Record<LanguageCode, string[]>>;

export type BottomSheetContent = {
  type: 'language-picker';
  target: LanguagePickerTarget;
} | null;

type AppStateContextValue = {
  bottomSheetContent: BottomSheetContent;
  closeBottomSheet: () => void;
  favoriteIds: string[];
  favoriteFilterLanguage: LanguageCode;
  favoriteLanguageOptions: LanguageCode[];
  getFavoriteIdsForLanguage: (language: LanguageCode) => string[];
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
        const migratedFavoriteIds = sanitizeFavoriteIds(parsedValue.favoriteIds);

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

  const getFavoriteIdsForLanguage = (language: LanguageCode) =>
    favoriteIdsByLanguage[language] ?? [];

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
        bottomSheetContent,
        closeBottomSheet,
        favoriteIds,
        favoriteFilterLanguage,
        favoriteLanguageOptions,
        getFavoriteIdsForLanguage,
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
