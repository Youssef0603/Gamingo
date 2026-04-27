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

export type LanguagePickerTarget = 'learning' | 'native';

export type BottomSheetContent =
  | {
      type: 'language-picker';
      target: LanguagePickerTarget;
    }
  | null;

type AppStateContextValue = {
  bottomSheetContent: BottomSheetContent;
  closeBottomSheet: () => void;
  favoriteIds: string[];
  nativeLanguage: LanguageCode;
  openLanguagePicker: (target: LanguagePickerTarget) => void;
  selectedLanguage: LanguageCode;
  setNativeLanguage: (language: LanguageCode) => void;
  setSelectedLanguage: (language: LanguageCode) => void;
  toggleFavorite: (phraseId: string) => void;
};

type PersistedAppState = {
  favoriteIds: string[];
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

export function AppStateProvider({ children }: PropsWithChildren) {
  const [bottomSheetContent, setBottomSheetContent] =
    useState<BottomSheetContent>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
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

        if (Array.isArray(parsedValue.favoriteIds)) {
          setFavoriteIds(
            parsedValue.favoriteIds.filter(
              (phraseId): phraseId is string => typeof phraseId === 'string',
            ),
          );
        }

        if (isLanguageCode(parsedValue.nativeLanguage)) {
          setNativeLanguage(parsedValue.nativeLanguage);
        }

        if (isLanguageCode(parsedValue.selectedLanguage)) {
          setSelectedLanguage(parsedValue.selectedLanguage);
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
            favoriteIds,
            nativeLanguage,
            selectedLanguage,
          } satisfies PersistedAppState),
        );
      } catch (error) {
        console.warn('Failed to persist app state.', error);
      }
    };

    persistAppState();
  }, [favoriteIds, isHydrated, nativeLanguage, selectedLanguage]);

  const toggleFavorite = (phraseId: string) => {
    setFavoriteIds(current =>
      current.includes(phraseId)
        ? current.filter(id => id !== phraseId)
        : [...current, phraseId],
    );
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
        nativeLanguage,
        openLanguagePicker,
        selectedLanguage,
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
