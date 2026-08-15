import React, { useEffect } from 'react';
import { AppState, StatusBar, StyleSheet } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { initializeAppodealAds } from './src/features/ads/mobileAds';
import { initializePracticeReminders } from './src/features/notifications';
import { initializeAppReviewState } from './src/features/reviews/appReview';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from './src/services/analytics';
import { theme } from './src/theme/theme';

function App() {
  useEffect(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.APP_STARTED, {
      [ANALYTICS_PARAMS.APP_STATE]: AppState.currentState,
      [ANALYTICS_PARAMS.SOURCE]: 'react_native',
    }).catch(() => undefined);

    initializeAppReviewState()
      .then(() => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
          [ANALYTICS_PARAMS.RESULT]: 'initialized',
          [ANALYTICS_PARAMS.SOURCE]: 'app_start',
        }).catch(() => undefined);
      })
      .catch(error => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
          ...getErrorAnalyticsParams(error),
          [ANALYTICS_PARAMS.RESULT]: 'initialize_failed',
          [ANALYTICS_PARAMS.SOURCE]: 'app_start',
        }).catch(() => undefined);

        if (__DEV__) {
          console.warn('App review state failed to initialize', error);
        }
      });

    initializeAppodealAds()
      .then(result => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, {
          [ANALYTICS_PARAMS.AD_PLACEMENT]: 'app_start',
          [ANALYTICS_PARAMS.AD_RESULT]: result,
        }).catch(() => undefined);
      })
      .catch(error => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, {
          ...getErrorAnalyticsParams(error),
          [ANALYTICS_PARAMS.AD_PLACEMENT]: 'app_start',
          [ANALYTICS_PARAMS.AD_RESULT]: 'appodeal_failed',
        }).catch(() => undefined);

        if (__DEV__) {
          console.warn('Appodeal ads failed to initialize', error);
        }
      });

    initializePracticeReminders().catch(error => {
      if (__DEV__) {
        console.warn('Practice reminders failed to initialize', error);
      }
    });

    const subscription = AppState.addEventListener('change', nextAppState => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.APP_STATE_CHANGED, {
        [ANALYTICS_PARAMS.APP_STATE]: nextAppState,
      }).catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={theme.colors.background}
          />
          <AppNavigator />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
