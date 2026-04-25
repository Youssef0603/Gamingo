import React from 'react';
import { StyleSheet } from 'react-native';
import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppStateProvider } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import {
  FavoritesScreen,
  HomeScreen,
  PhraseListScreen,
  PracticeScreen,
  SettingsScreen,
} from '../screens';
import { theme, withAlpha } from '../theme/theme';

import type {
  HomeStackParamList,
  PracticeStackScreenProps,
  PracticeTabScreenProps,
  RootTabParamList,
} from '../types/navigation';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

const tabLabels: Record<keyof RootTabParamList, { icon: string; label: string }> = {
  HomeTab: { icon: '🎮', label: 'Home' },
  PracticeTab: { icon: '🎤', label: 'Practice' },
  FavoritesTab: { icon: '★', label: 'Favorites' },
  SettingsTab: { icon: '⚙️', label: 'Settings' },
};

const navigationTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: withAlpha(theme.colors.primary, 0.18),
    notification: theme.colors.accent,
  },
};

function PracticeStackRoute(props: PracticeStackScreenProps) {
  return <PracticeScreen {...props} variant="stack" />;
}

function PracticeTabRoute(props: PracticeTabScreenProps) {
  return <PracticeScreen {...props} variant="tab" />;
}

function HomeStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.colors.background },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          color: theme.colors.textPrimary,
          fontSize: 16,
          fontWeight: '800',
        },
      }}
    >
      <Stack.Screen
        component={HomeScreen}
        name="Home"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={PhraseListScreen}
        name="PhraseList"
        options={({ route }) => ({
          title: categoryMetadata[route.params.category].title.toUpperCase(),
        })}
      />
      <Stack.Screen
        component={PracticeStackRoute}
        name="Practice"
        options={{ title: 'PRACTICE' }}
      />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStateProvider>
      <NavigationContainer theme={navigationTheme}>
        <Tab.Navigator
          initialRouteName="HomeTab"
          screenOptions={({ route }) => {
            const tabMeta = tabLabels[route.name as keyof RootTabParamList];

            return {
              animation: 'fade',
              headerShown: false,
              sceneStyle: styles.scene,
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: theme.colors.textSecondary,
              tabBarItemStyle: styles.tabBarItem,
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarStyle: styles.tabBar,
              tabBarLabel: `${tabMeta.icon} ${tabMeta.label}`,
            };
          }}
        >
          <Tab.Screen
            component={HomeStackNavigator}
            name="HomeTab"
            options={{ tabBarLabel: tabLabels.HomeTab.label }}
          />
          <Tab.Screen
            component={PracticeTabRoute}
            name="PracticeTab"
            options={{ tabBarLabel: 'Practice' }}
          />
          <Tab.Screen
            component={FavoritesScreen}
            name="FavoritesTab"
            options={{ tabBarLabel: 'Favorites' }}
          />
          <Tab.Screen
            component={SettingsScreen}
            name="SettingsTab"
            options={{ tabBarLabel: 'Settings' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: withAlpha(theme.colors.primary, 0.18),
    borderTopWidth: 1,
    height: 84,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
});

export default AppNavigator;
