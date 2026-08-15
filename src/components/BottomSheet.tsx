import React, { createRef, useCallback, useEffect } from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetHandleProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native';

import { useAppState } from '../context/AppStateContext';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  trackAnalyticsEvent,
} from '../services/analytics';
import { theme } from '../theme/theme';
import { bottomSheetContentSwitcher } from '../utils/bottomSheetContentSwitcher';

export const bottomSheetModalRef = createRef<BottomSheetModal>();

function BottomSheet() {
  const {
    bottomSheetContent,
    closeBottomSheet,
    favoriteFilterLanguage,
    favoriteLanguageOptions,
    nativeLanguage,
    selectedLanguage,
    setFavoriteFilterLanguage,
    setNativeLanguage,
    setSelectedLanguage,
  } = useAppState();

  useEffect(() => {
    if (bottomSheetContent) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.BOTTOM_SHEET_OPENED, {
        [ANALYTICS_PARAMS.MODAL]: bottomSheetContent.type,
        [ANALYTICS_PARAMS.SOURCE]:
          bottomSheetContent.type === 'language-picker'
            ? bottomSheetContent.target
            : undefined,
      }).catch(() => undefined);
      bottomSheetModalRef.current?.present();
      return;
    }

    bottomSheetModalRef.current?.dismiss();
  }, [bottomSheetContent]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.32}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    [],
  );

  const renderHandle = useCallback(
    (props: BottomSheetHandleProps) => (
      <BottomSheetHandle
        {...props}
        indicatorStyle={styles.handleIndicator}
        style={styles.handle}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      enableDynamicSizing
      enablePanDownToClose
      handleComponent={renderHandle}
      index={1}
      onDismiss={() => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.BOTTOM_SHEET_DISMISSED, {
          [ANALYTICS_PARAMS.MODAL]: bottomSheetContent?.type,
          [ANALYTICS_PARAMS.SOURCE]:
            bottomSheetContent?.type === 'language-picker'
              ? bottomSheetContent.target
              : undefined,
        }).catch(() => undefined);
        closeBottomSheet();
      }}
      snapPoints={[1]}
    >
      {bottomSheetContentSwitcher(bottomSheetContent, {
        favoriteFilterLanguage,
        favoriteLanguageOptions,
        nativeLanguage,
        selectedLanguage,
        setFavoriteFilterLanguage,
        setNativeLanguage,
        setSelectedLanguage,
      })}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    backgroundColor: theme.colors.card,
  },
  handleIndicator: {
    backgroundColor: theme.colors.border,
    width: 44,
  },
});

export default BottomSheet;
