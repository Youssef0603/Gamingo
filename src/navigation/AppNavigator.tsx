import React from 'react';
import { StyleSheet } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BootSplash from 'react-native-bootsplash';

import BottomSheet from '../components/BottomSheet';
import { Icon } from '../components/ui';
import { AppStateProvider } from '../context/AppStateContext';
import { subscribeToPracticeReminderOpened } from '../features/notifications';
import { DebugScreen, FavoritesScreen, PracticeScreen } from '../screens';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  trackAnalyticsEvent,
  trackScreenView,
} from '../services/analytics';
import { theme } from '../theme/theme';

import type { RootTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<RootTabParamList>();

const navigationTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.card,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.accent,
  },
};

const tabIcons = {
  Debug: {
    active: 'alert-circle',
    inactive: 'alert-circle',
  },
  Favourites: {
    active: 'heart',
    inactive: 'heart-outline',
  },
  Practice: {
    active: 'game-controller',
    inactive: 'game-controller-outline',
  },
} as const satisfies Record<
  keyof RootTabParamList,
  {
    active: React.ComponentProps<typeof Icon>['name'];
    inactive: React.ComponentProps<typeof Icon>['name'];
  }
>;

function getTabBarIcon(
  routeName: keyof RootTabParamList,
  color: string,
  focused: boolean,
  size: number,
) {
  const icon = tabIcons[routeName];

  return (
    <Icon
      color={color}
      name={focused ? icon.active : icon.inactive}
      size={size}
    />
  );
}

function getScreenOptions({
  route,
}: {
  route: { name: keyof RootTabParamList };
}) {
  return {
    headerShown: false,
    sceneStyle: styles.scene,
    tabBarActiveTintColor: theme.colors.primary,
    tabBarIcon: ({
      color,
      focused,
      size,
    }: {
      color: string;
      focused: boolean;
      size: number;
    }) => getTabBarIcon(route.name, color, focused, size),
    tabBarInactiveTintColor: theme.colors.mutedText,
    tabBarItemStyle: styles.tabBarItem,
    tabBarLabelStyle: styles.tabBarLabel,
    tabBarStyle: styles.tabBar,
  };
}

function AppNavigator() {
  const navigationRef = useNavigationContainerRef<RootTabParamList>();
  const routeNameRef = React.useRef<string | undefined>(undefined);

  React.useEffect(
    () =>
      subscribeToPracticeReminderOpened(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Practice');
        }
      }),
    [navigationRef],
  );

  const trackCurrentScreen = React.useCallback(() => {
    const currentRouteName = navigationRef.getCurrentRoute()?.name;

    if (!currentRouteName || routeNameRef.current === currentRouteName) {
      return;
    }

    const previousRouteName = routeNameRef.current;

    routeNameRef.current = currentRouteName;
    trackScreenView(currentRouteName, previousRouteName);
  }, [navigationRef]);

  const screenListeners = React.useCallback(
    ({ route }: { route: { name: keyof RootTabParamList } }) => ({
      tabPress: () => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.TAB_PRESSED, {
          [ANALYTICS_PARAMS.SCREEN]: route.name,
          [ANALYTICS_PARAMS.UI_ELEMENT]: 'bottom_tab',
        }).catch(() => undefined);
      },
    }),
    [],
  );

  return (
    <AppStateProvider>
      <>
        <NavigationContainer
          onReady={() => {
            BootSplash.hide({ fade: true });
            trackCurrentScreen();
          }}
          onStateChange={trackCurrentScreen}
          ref={navigationRef}
          theme={navigationTheme}
        >
          <Tab.Navigator
            initialRouteName="Practice"
            screenListeners={screenListeners}
            screenOptions={getScreenOptions}
          >
            <Tab.Screen component={PracticeScreen} name="Practice" />
            <Tab.Screen component={FavoritesScreen} name="Favourites" />
            {__DEV__ ? (
              <Tab.Screen component={DebugScreen} name="Debug" />
            ) : null}
          </Tab.Navigator>
        </NavigationContainer>
        <BottomSheet />
      </>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    backgroundColor: theme.colors.card,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 74,
    paddingBottom: 10,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
});

export default AppNavigator;
