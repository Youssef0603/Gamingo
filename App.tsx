import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme/theme';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.background}
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
