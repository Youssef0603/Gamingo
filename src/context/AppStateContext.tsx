import React, { PropsWithChildren, createContext, useContext, useState } from 'react';

import {
  initialPracticeStats,
  updatePracticeStats,
} from '../features/practice/practiceGamification';

import type { LanguageCode } from '../types/language';
import type { PracticeStats } from '../features/practice/practiceGamification';
import type { PracticeFeedbackLabel } from '../features/practice/practiceUtils';

type AppStateContextValue = {
  favoriteIds: string[];
  practiceStats: PracticeStats;
  recordPracticeAttempt: (label: PracticeFeedbackLabel) => void;
  selectedLanguage: LanguageCode;
  setSelectedLanguage: (language: LanguageCode) => void;
  toggleFavorite: (phraseId: string) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [practiceStats, setPracticeStats] = useState<PracticeStats>(
    initialPracticeStats,
  );
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  const toggleFavorite = (phraseId: string) => {
    setFavoriteIds(current =>
      current.includes(phraseId)
        ? current.filter(id => id !== phraseId)
        : [...current, phraseId],
    );
  };

  const recordPracticeAttempt = (label: PracticeFeedbackLabel) => {
    setPracticeStats(current => updatePracticeStats(current, label));
  };

  return (
    <AppStateContext.Provider
      value={{
        favoriteIds,
        practiceStats,
        recordPracticeAttempt,
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
