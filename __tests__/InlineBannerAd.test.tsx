import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const mockAppodealBanner = jest.fn(() => null);
let mockPlatformOS = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  View: 'View',
}));

jest.mock('react-native-appodeal', () => ({
  AppodealBanner: mockAppodealBanner,
}));

jest.mock('../src/features/ads/mobileAds', () => ({
  getBannerAdsGateReason: jest.fn(() => null),
  useCanShowAds: jest.fn(() => true),
}));

jest.mock('../src/services/analytics', () => {
  const actual = jest.requireActual('../src/services/analytics');

  return {
    ...actual,
    trackAnalyticsEvent: jest.fn(() => Promise.resolve()),
  };
});

describe('InlineBannerAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockPlatformOS = 'android';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mounts the inline AppodealBanner on Android, matching iOS, after the mount-settle delay', () => {
    const InlineBannerAd = require('../src/features/ads/InlineBannerAd').default;

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(React.createElement(InlineBannerAd));
    });

    expect(mockAppodealBanner).not.toHaveBeenCalled();

    ReactTestRenderer.act(() => {
      jest.runAllTimers();
    });

    expect(mockAppodealBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        adSize: 'phone',
        placement: 'inline_banner',
        usesSmartSizing: true,
      }),
      undefined,
    );
  });

  it('keeps the existing inline AppodealBanner on iOS, after the mount-settle delay', () => {
    mockPlatformOS = 'ios';
    const InlineBannerAd = require('../src/features/ads/InlineBannerAd').default;

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(React.createElement(InlineBannerAd));
    });

    ReactTestRenderer.act(() => {
      jest.runAllTimers();
    });

    expect(mockAppodealBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        adSize: 'phone',
        placement: 'inline_banner',
        usesSmartSizing: true,
      }),
      undefined,
    );
  });
});
