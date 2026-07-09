let mockRemoteConfigValue = '';
const mockRemoteConfigState: {
  defaultConfig?: Record<string, string>;
  settings?: { minimumFetchIntervalMillis?: number };
} = {};

jest.mock('@react-native-firebase/remote-config', () => ({
  activate: jest.fn(() => Promise.resolve(true)),
  ensureInitialized: jest.fn(() => Promise.resolve()),
  fetchAndActivate: jest.fn(() => Promise.resolve(true)),
  getRemoteConfig: jest.fn(() => mockRemoteConfigState),
  getValue: jest.fn(() => ({
    asString: () => mockRemoteConfigValue,
  })),
  onConfigUpdate: jest.fn(() => jest.fn()),
}));

jest.mock('../src/services/firebase', () => ({
  ensureFirebaseReady: jest.fn(() => Promise.resolve()),
}));

describe('adsPolicy', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRemoteConfigValue = '';
    mockRemoteConfigState.defaultConfig = undefined;
    mockRemoteConfigState.settings = undefined;
  });

  it('sanitizes partial policies with safe fallbacks', () => {
    const { sanitizeAdsPolicy } = require('../src/features/ads/adsPolicy');

    expect(
      sanitizeAdsPolicy({
        adsEnabled: false,
        favoriteSave: {
          enabled: true,
          frequency: 0,
        },
        firstLaunchGracePeriodMs: -1,
        itemClick: {
          enabled: true,
          frequency: 2.8,
        },
      }),
    ).toEqual({
      adsEnabled: false,
      bannerEnabled: false,
      customWordAdd: {
        enabled: true,
        skipFirstInterstitial: true,
      },
      favoriteSave: {
        enabled: true,
        frequency: 3,
      },
      firstLaunchGracePeriodMs: 0,
      interstitialsEnabled: true,
      itemClick: {
        enabled: true,
        frequency: 2,
      },
      randomPractice: {
        enabled: true,
        frequency: 3,
      },
      version: 1,
    });
  });

  it('loads and activates the remote ads policy', async () => {
    mockRemoteConfigValue = JSON.stringify({
      adsEnabled: false,
      bannerEnabled: true,
      customWordAdd: {
        enabled: false,
        skipFirstInterstitial: false,
      },
      favoriteSave: {
        enabled: true,
        frequency: 4,
      },
      firstLaunchGracePeriodMs: 60000,
      interstitialsEnabled: false,
      itemClick: {
        enabled: true,
        frequency: 6,
      },
      randomPractice: {
        enabled: false,
        frequency: 5,
      },
      version: 1,
    });

    const {
      ADS_POLICY_REMOTE_CONFIG_KEY,
      DEFAULT_ADS_POLICY,
      getAdsPolicy,
      initializeAdsPolicy,
    } = require('../src/features/ads/adsPolicy');

    await initializeAdsPolicy();

    expect(mockRemoteConfigState.defaultConfig).toEqual({
      [ADS_POLICY_REMOTE_CONFIG_KEY]: JSON.stringify(DEFAULT_ADS_POLICY),
    });
    expect(mockRemoteConfigState.settings).toEqual({
      minimumFetchIntervalMillis: __DEV__ ? 0 : 4 * 60 * 60 * 1000,
    });
    expect(getAdsPolicy()).toEqual({
      adsEnabled: false,
      bannerEnabled: true,
      customWordAdd: {
        enabled: false,
        skipFirstInterstitial: false,
      },
      favoriteSave: {
        enabled: true,
        frequency: 4,
      },
      firstLaunchGracePeriodMs: 60000,
      interstitialsEnabled: false,
      itemClick: {
        enabled: true,
        frequency: 6,
      },
      randomPractice: {
        enabled: false,
        frequency: 5,
      },
      version: 1,
    });
  });

  it('falls back to defaults when the remote ads policy is malformed', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    mockRemoteConfigValue = '{not-valid-json';

    const {
      DEFAULT_ADS_POLICY,
      getAdsPolicy,
      initializeAdsPolicy,
    } = require('../src/features/ads/adsPolicy');

    await initializeAdsPolicy();

    expect(getAdsPolicy()).toEqual(DEFAULT_ADS_POLICY);
    consoleWarnSpy.mockRestore();
  });
});
