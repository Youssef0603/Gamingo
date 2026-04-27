import React from 'react';

import LanguagePickerSheet from '../components/LanguagePickerSheet';

import type { BottomSheetContent } from '../context/AppStateContext';
import type { LanguageCode } from '../types/language';

type BottomSheetContentProps = {
  nativeLanguage: LanguageCode;
  selectedLanguage: LanguageCode;
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
          onSelect={
            content.target === 'native'
              ? props.setNativeLanguage
              : props.setSelectedLanguage
          }
          selectedLanguage={
            content.target === 'native'
              ? props.nativeLanguage
              : props.selectedLanguage
          }
          subtitle={
            content.target === 'native'
              ? 'Pick the language the user speaks natively.'
              : 'Pick the language the user wants to practice right now.'
          }
          title={
            content.target === 'native'
              ? 'Choose native language'
              : 'Choose learning language'
          }
        />
      );
    default:
      return null;
  }
}
