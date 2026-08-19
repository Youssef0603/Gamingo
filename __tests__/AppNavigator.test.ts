jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
}));
jest.mock('../src/components/BottomSheet', () => () => null);
jest.mock('../src/components/ui', () => ({
  Icon: () => null,
}));
jest.mock('../src/context/AppStateContext', () => ({
  AppStateProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('../src/features/ads/mobileAds', () => ({
  ANDROID_BOTTOM_BANNER_HEIGHT: 50,
  useIsAndroidBottomBannerVisible: jest.fn(() => false),
}));
jest.mock('../src/features/notifications', () => ({
  subscribeToPracticeReminderOpened: jest.fn(() => jest.fn()),
}));
jest.mock('../src/screens/DebugScreen', () => () => null);
jest.mock('../src/screens/FavoritesScreen', () => () => null);
jest.mock('../src/screens/PracticeScreen', () => () => null);

import { getAndroidBottomBannerTabBarOffset } from '../src/navigation/AppNavigator';

describe('AppNavigator Android bottom banner tab offset', () => {
  it('offsets the tab bar by the Appodeal banner height on Android when visible', () => {
    expect(getAndroidBottomBannerTabBarOffset(true, 'android')).toBe(50);
  });

  it('keeps the normal tab bar position on Android when the banner is hidden', () => {
    expect(getAndroidBottomBannerTabBarOffset(false, 'android')).toBe(0);
  });

  it('does not apply the Appodeal banner offset on iOS', () => {
    expect(getAndroidBottomBannerTabBarOffset(true, 'ios')).toBe(0);
  });

  it('does not accumulate offset across repeated visibility checks', () => {
    expect(getAndroidBottomBannerTabBarOffset(true, 'android')).toBe(50);
    expect(getAndroidBottomBannerTabBarOffset(true, 'android')).toBe(50);
    expect(getAndroidBottomBannerTabBarOffset(false, 'android')).toBe(0);
  });
});
