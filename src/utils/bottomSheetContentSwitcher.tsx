import React from 'react';

import LanguagePickerSheet from '../components/LanguagePickerSheet';

import type { BottomSheetContent } from '../context/AppStateContext';
import type { LanguageCode } from '../types/language';

type BottomSheetContentProps = {
  selectedLanguage: LanguageCode;
  setSelectedLanguage: (language: LanguageCode) => void;
};

export function bottomSheetContentSwitcher(
  content: BottomSheetContent,
  props: BottomSheetContentProps,
) {
  switch (content) {
    case 'language-picker':
      return (
        <LanguagePickerSheet
          onSelect={props.setSelectedLanguage}
          selectedLanguage={props.selectedLanguage}
        />
      );
    default:
      return null;
  }
}
