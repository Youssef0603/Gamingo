import React, { PropsWithChildren, createContext, useContext, useState } from 'react';

import type { LanguageCode } from '../types/language';

type AppStateContextValue = {
  favoriteIds: string[];
  selectedLanguage: LanguageCode;
  setSelectedLanguage: (language: LanguageCode) => void;
  toggleFavorite: (phraseId: string) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  const toggleFavorite = (phraseId: string) => {
    setFavoriteIds(current =>
      current.includes(phraseId)
        ? current.filter(id => id !== phraseId)
        : [...current, phraseId],
    );
  };

  return (
    <AppStateContext.Provider
      value={{
        favoriteIds,
        selectedLanguage,
        setSelectedLanguage,
        toggleFavorite,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider.');
  }

  return context;
}
