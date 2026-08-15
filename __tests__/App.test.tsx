/**
 * @format
 */

export {};

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

const mockStorage = new Map<string, string>();
const mockAsyncStorage = {
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockStorage.get(key) ?? null),
  ),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));
jest.mock('../src/features/ads/mobileAds', () => ({
  debugShowAppodealInterstitial: jest.fn(),
  getBannerAdsGateReason: jest.fn(() => 'not_eligible'),
  initializeAppodealAds: jest.fn(() => Promise.resolve('ads_disabled')),
  isAppodealAdsConfigured: jest.fn(() => false),
  isAppodealAdsInitialized: jest.fn(() => false),
  trackFavoriteSaveAction: jest.fn(),
  useCanShowAds: jest.fn(() => false),
}));
jest.mock('react-native-appodeal', () => ({
  __esModule: true,
  AppodealAdType: {
    BANNER: 4,
    INTERSTITIAL: 1,
  },
  AppodealLogLevel: {
    DEBUG: 'debug',
    NONE: 'none',
    VERBOSE: 'verbose',
  },
  AppodealBanner: () => null,
  default: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));
jest.mock('../src/services', () => ({
  isSpeechRecognitionAvailable: jest.fn(() => false),
  isTextToSpeechAvailable: jest.fn(() => false),
  onError: jest.fn(() => jest.fn()),
  onPermissionChange: jest.fn(() => jest.fn()),
  onResult: jest.fn(() => jest.fn()),
  onStateChange: jest.fn(() => jest.fn()),
  playSuccessSound: jest.fn(() => Promise.resolve()),
  speak: jest.fn(() => Promise.resolve()),
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  stopSpeaking: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/features/practice/usePractice', () => ({
  usePractice: jest.fn(() => ({
    cancelPractice: jest.fn(() => Promise.resolve()),
    error: null,
    invalidatePractice: jest.fn(),
    isListening: false,
    isPlaying: false,
    isRequestingPermission: false,
    playPhrase: jest.fn(() => Promise.resolve()),
    speakPhrase: jest.fn(() => Promise.resolve()),
  })),
}));
jest.mock('../src/services/firebase', () => ({
  initializeFirebaseServices: jest.fn(),
  logScreenView: jest.fn(() => Promise.resolve()),
}));
jest.mock('../src/features/reviews/appReview', () => ({
  initializeAppReviewState: jest.fn(() => Promise.resolve()),
  trackReviewMilestone: jest.fn(),
}));
jest.mock('../src/features/notifications', () => ({
  initializePracticeReminders: jest.fn(() => Promise.resolve()),
  PracticeReminderPrompt: () => null,
  subscribeToPracticeReminderOpened: jest.fn(() => jest.fn()),
  trackPracticeReminderMilestone: jest.fn(),
}));
jest.mock('@react-native-firebase/remote-config', () => ({
  activate: jest.fn(() => Promise.resolve(true)),
  ensureInitialized: jest.fn(() => Promise.resolve()),
  fetchAndActivate: jest.fn(() => Promise.resolve(true)),
  getRemoteConfig: jest.fn(() => ({
    defaultConfig: undefined,
    settings: undefined,
  })),
  getValue: jest.fn(() => ({
    asString: () => '',
  })),
  onConfigUpdate: jest.fn(() => jest.fn()),
}));
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
}));
jest.mock('react-native-gesture-handler', () => {
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const MockReact = require('react');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetHandle: () => null,
    BottomSheetModal: MockReact.forwardRef(
      ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
        MockReact.useImperativeHandle(ref, () => ({
          dismiss: jest.fn(),
          present: jest.fn(),
        }));

        return children;
      },
    ),
    BottomSheetModalProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  };
});
jest.mock('react-native-store-review', () => ({
  requestReview: jest.fn(),
}));
jest.mock('react-native-json-tree', () => () => null);
jest.mock('lottie-react-native', () => 'LottieView');

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
