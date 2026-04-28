import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { initializeGoogleMobileAds } from './src/features/ads/mobileAds';
import { theme } from './src/theme/theme';

function App() {
  useEffect(() => {
    initializeGoogleMobileAds().catch(error => {
      if (__DEV__) {
        console.warn('Google Mobile Ads failed to initialize', error);
      }
    });
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
