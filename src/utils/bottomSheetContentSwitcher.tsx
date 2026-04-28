import React from 'react';

import LanguagePickerSheet from '../components/LanguagePickerSheet';

import type { BottomSheetContent } from '../context/AppStateContext';
import type { LanguageCode } from '../types/language';

type BottomSheetContentProps = {
  favoriteFilterLanguage: LanguageCode;
  favoriteLanguageOptions: LanguageCode[];
  nativeLanguage: LanguageCode;
  selectedLanguage: LanguageCode;
  setFavoriteFilterLanguage: (language: LanguageCode) => void;
  setNativeLanguage: (language: LanguageCode) => void;
  setSelectedLanguage: (language: LanguageCode) => void;
};

export function bottomSheetContentSwitcher(
  content: BottomSheetContent,
  props: BottomSheetContentProps,
) {
  switch (content?.type) {
    case 'language-picker':
      return (
        <LanguagePickerSheet
          availableLanguages={
            content.target === 'favorites'
              ? props.favoriteLanguageOptions
              : undefined
          }
          emptyStateText={
            content.target === 'favorites'
              ? 'Save phrases from Practice to build this list.'
              : undefined
          }
          onSelect={
            content.target === 'native'
              ? props.setNativeLanguage
              : content.target === 'favorites'
                ? props.setFavoriteFilterLanguage
                : props.setSelectedLanguage
          }
          selectedLanguage={
            content.target === 'native'
              ? props.nativeLanguage
              : content.target === 'favorites'
                ? props.favoriteFilterLanguage
                : props.selectedLanguage
          }
          subtitle={
            content.target === 'native'
              ? 'Pick the language the user speaks natively.'
              : content.target === 'favorites'
                ? 'Pick a saved learning language to filter favourites.'
                : 'Pick the language the user wants to practice right now.'
          }
          title={
            content.target === 'native'
              ? 'Choose native language'
              : content.target === 'favorites'
                ? 'Choose saved language'
                : 'Choose learning language'
          }
        />
      );
    default:
      return null;
  }
}
