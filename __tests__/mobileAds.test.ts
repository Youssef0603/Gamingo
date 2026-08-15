export {};

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

const mockAddEventListener = jest.fn(() => ({
  remove: jest.fn(),
}));
const mockAppTrackingTransparency = {
  getTrackingAuthorizationStatus: jest.fn(() => Promise.resolve('unavailable')),
  requestTrackingAuthorization: jest.fn(() => Promise.resolve('unavailable')),
};

let mockPlatformOS = 'android';
const mockAppodealEventHandlers = new Map<
  string,
  Array<(params?: unknown) => void>
>();

const mockAppodeal = {
  addEventListener: jest.fn((event: string, handler: (params?: unknown) => void) => {
    const handlers = mockAppodealEventHandlers.get(event) ?? [];
    handlers.push(handler);
    mockAppodealEventHandlers.set(event, handlers);

    return {
      remove: jest.fn(() => {
        mockAppodealEventHandlers.set(
          event,
          (mockAppodealEventHandlers.get(event) ?? []).filter(
            currentHandler => currentHandler !== handler,
          ),
        );
      }),
    };
  }),
  cache: jest.fn(),
  canShow: jest.fn(() => false),
  disableNetwork: jest.fn(),
  initialize: jest.fn(),
  isInitialized: jest.fn(() => true),
  isLoaded: jest.fn(() => false),
  setAutoCache: jest.fn(),
  setLogLevel: jest.fn(),
  setSmartBanners: jest.fn(),
  setTesting: jest.fn(),
  show: jest.fn(),
};

const TEST_ADS_POLICY = {
  version: 1,
  adsEnabled: true,
  bannerEnabled: true,
  interstitialsEnabled: true,
  firstLaunchGracePeriodMs: 60 * 1000,
  itemClick: {
    enabled: false,
    frequency: 5,
  },
  favoriteSave: {
    enabled: false,
    frequency: 3,
  },
  randomPractice: {
    enabled: true,
    frequency: 3,
  },
  customWordAdd: {
    enabled: true,
    skipFirstInterstitial: true,
  },
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: mockAddEventListener,
    currentState: 'active',
  },
  NativeModules: {
    AppTrackingTransparencyModule: mockAppTrackingTransparency,
  },
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('react-native-appodeal', () => ({
  __esModule: true,
  AppodealAdType: {
    ALL: 317,
    BANNER: 4,
    BANNER_BOTTOM: 8,
    BANNER_TOP: 16,
    INTERSTITIAL: 1,
    MREC: 256,
    NONE: 0,
    REWARDED_VIDEO: 32,
  },
  AppodealLogLevel: {
    DEBUG: 'debug',
    NONE: 'none',
    VERBOSE: 'verbose',
  },
  AppodealBanner: () => null,
  AppodealBannerEvents: {
    CLICKED: 'onBannerClicked',
    EXPIRED: 'onBannerExpired',
    FAILED_TO_LOAD: 'onBannerFailedToLoad',
    LOADED: 'onBannerLoaded',
    SHOWN: 'onBannerShown',
  },
  AppodealInterstitialEvents: {
    CLICKED: 'onInterstitialClicked',
    CLOSED: 'onInterstitialClosed',
    EXPIRED: 'onInterstitialExpired',
    FAILED_TO_LOAD: 'onInterstitialFailedToLoad',
    FAILED_TO_SHOW: 'onInterstitialFailedToShow',
    LOADED: 'onInterstitialLoaded',
    SHOWN: 'onInterstitialShown',
  },
  AppodealSdkEvents: {
    AD_REVENUE: 'onAppodealDidReceiveRevenue',
    INITIALIZED: 'onAppodealInitialized',
  },
  default: mockAppodeal,
}));

jest.mock('../src/features/ads/adsPolicy', () => {
  const DEFAULT_ADS_POLICY = {
    version: 1,
    adsEnabled: true,
    bannerEnabled: false,
    interstitialsEnabled: true,
    firstLaunchGracePeriodMs: 7 * 24 * 60 * 60 * 1000,
    itemClick: {
      enabled: false,
      frequency: 5,
    },
    favoriteSave: {
      enabled: false,
      frequency: 3,
    },
    randomPractice: {
      enabled: true,
      frequency: 3,
    },
    customWordAdd: {
      enabled: true,
      skipFirstInterstitial: true,
    },
  };

  return {
    DEFAULT_ADS_POLICY,
    initializeAdsPolicy: jest.fn(() => Promise.resolve(TEST_ADS_POLICY)),
    sanitizeAdsPolicy: jest.fn((value: unknown) =>
      typeof value === 'object' && value !== null
        ? {
            ...DEFAULT_ADS_POLICY,
            ...value,
          }
        : DEFAULT_ADS_POLICY,
    ),
  };
});

describe('mobileAds', () => {
  let now = 1_000_000;
  let dateNowSpy: jest.SpyInstance<number, []>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAppodealEventHandlers.clear();
    mockPlatformOS = 'android';
    mockAppodeal.canShow.mockReturnValue(false);
    mockAppodeal.isInitialized.mockReturnValue(true);
    mockAppodeal.isLoaded.mockReturnValue(false);
    mockAppTrackingTransparency.getTrackingAuthorizationStatus.mockResolvedValue(
      'unavailable',
    );
    mockAppTrackingTransparency.requestTrackingAuthorization.mockResolvedValue(
      'unavailable',
    );
    mockStorage.clear();
    now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  async function loadMobileAdsModule() {
    const { setAppRemoteConfigState } = require('../src/state/appRemoteConfigStore');
    setAppRemoteConfigState({
      adsPolicy: TEST_ADS_POLICY,
    });

    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.initializeAppodealAds();

    return mobileAds;
  }

  it('keeps first-launch banner ads hidden after an app relaunch during grace', async () => {
    const firstLaunchMobileAds = await loadMobileAdsModule();

    expect(firstLaunchMobileAds.getBannerAdsGateReason()).toBe('not_eligible');

    const firstLaunchState = JSON.parse(mockStorage.get('adsState') ?? '{}');
    expect(firstLaunchState.firstLaunchGraceConsumedMs).toBe(0);
    expect(firstLaunchState.firstLaunchGraceStartedAtMs).toBe(now);

    now += 5 * 1000;
    jest.resetModules();

    const relaunchedMobileAds = await loadMobileAdsModule();

    expect(relaunchedMobileAds.getBannerAdsGateReason()).toBe('not_eligible');

    const relaunchedState = JSON.parse(mockStorage.get('adsState') ?? '{}');
    expect(relaunchedState.firstLaunchGraceConsumedMs).toBe(5 * 1000);
    expect(relaunchedState.firstLaunchGraceStartedAtMs).toBe(now);
  });

  it('does not retroactively put legacy ad-state users back into grace on configured iOS', async () => {
    mockPlatformOS = 'ios';
    mockAppTrackingTransparency.getTrackingAuthorizationStatus.mockResolvedValue(
      'not_determined',
    );
    mockAppTrackingTransparency.requestTrackingAuthorization.mockResolvedValue(
      'denied',
    );
    mockStorage.set(
      'adsState',
      JSON.stringify({
        favoriteSaveCount: 1,
        hasSkippedFirstCustomWordAddAd: true,
        itemClickCount: 2,
        randomPracticeStartCount: 1,
      }),
    );

    const mobileAds = await loadMobileAdsModule();

    expect(mobileAds.isAppodealAdsConfigured()).toBe(true);
    expect(mobileAds.getBannerAdsGateReason()).toBeNull();
    expect(mockAppodeal.initialize).toHaveBeenCalledWith(
      'fcd4631968342d89579fba045dccb1533ce606c6f81a27ef',
      5,
    );
    expect(mockAppodeal.setLogLevel).toHaveBeenCalledWith('debug');
    expect(mockAppodeal.setTesting).toHaveBeenCalledWith(true);
    expect(
      mockAppTrackingTransparency.requestTrackingAuthorization.mock
        .invocationCallOrder[0],
    ).toBeLessThan(mockAppodeal.initialize.mock.invocationCallOrder[0]);
    expect(
      mockAppodeal.setLogLevel.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppodeal.initialize.mock.invocationCallOrder[0]);
  });

  it('does not request ATT again when tracking authorization is already decided on iOS', async () => {
    mockPlatformOS = 'ios';
    mockAppTrackingTransparency.getTrackingAuthorizationStatus.mockResolvedValue(
      'restricted',
    );
    mockStorage.set(
      'adsState',
      JSON.stringify({
        favoriteSaveCount: 1,
        hasSkippedFirstCustomWordAddAd: true,
        itemClickCount: 2,
        randomPracticeStartCount: 1,
      }),
    );

    await loadMobileAdsModule();

    expect(
      mockAppTrackingTransparency.requestTrackingAuthorization,
    ).not.toHaveBeenCalled();
    expect(mockAppodeal.initialize).toHaveBeenCalledWith(
      'fcd4631968342d89579fba045dccb1533ce606c6f81a27ef',
      5,
    );
  });

  it('leaves Android ads unavailable until an Appodeal key is configured', async () => {
    mockStorage.set(
      'adsState',
      JSON.stringify({
        favoriteSaveCount: 1,
        hasSkippedFirstCustomWordAddAd: true,
        itemClickCount: 2,
        randomPracticeStartCount: 1,
      }),
    );

    const mobileAds = await loadMobileAdsModule();

    expect(mobileAds.isAppodealAdsConfigured()).toBe(false);
    expect(mobileAds.getBannerAdsGateReason()).toBe('missing_app_key');
    expect(mockAppodeal.initialize).not.toHaveBeenCalled();
  });

  it('keeps the temporary Appodeal interstitial debug test inert on Android', async () => {
    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.debugShowAppodealInterstitial();

    expect(mockAppodeal.initialize).not.toHaveBeenCalled();
    expect(mockAppodeal.cache).not.toHaveBeenCalled();
    expect(mockAppodeal.show).not.toHaveBeenCalled();
  });

  it('uses the temporary Appodeal interstitial debug test to initialize iOS without ads policy gates', async () => {
    mockPlatformOS = 'ios';
    mockAppodeal.isInitialized.mockReturnValue(false);
    mockAppTrackingTransparency.getTrackingAuthorizationStatus.mockResolvedValue(
      'not_determined',
    );
    mockAppTrackingTransparency.requestTrackingAuthorization.mockResolvedValue(
      'authorized',
    );
    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.debugShowAppodealInterstitial();

    expect(mockAppodeal.setLogLevel).toHaveBeenCalledWith('debug');
    expect(mockAppodeal.setTesting).toHaveBeenCalledWith(true);
    expect(mockAppodeal.initialize).toHaveBeenCalledWith(
      'fcd4631968342d89579fba045dccb1533ce606c6f81a27ef',
      5,
    );
    expect(
      mockAppTrackingTransparency.requestTrackingAuthorization.mock
        .invocationCallOrder[0],
    ).toBeLessThan(mockAppodeal.initialize.mock.invocationCallOrder[0]);
    expect(
      mockAppodeal.setLogLevel.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAppodeal.initialize.mock.invocationCallOrder[0]);

    mockAppodealEventHandlers
      .get('onInterstitialFailedToLoad')
      ?.forEach(handler => handler(new Error('debug load failed')));
  });

  it('shows a loaded iOS interstitial from the temporary debug test immediately', async () => {
    mockPlatformOS = 'ios';
    mockAppodeal.isInitialized.mockReturnValue(true);
    mockAppodeal.isLoaded.mockReturnValue(true);
    mockAppodeal.canShow.mockReturnValue(true);
    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.debugShowAppodealInterstitial();

    expect(mockAppodeal.show).toHaveBeenCalledWith(
      1,
      'debug_appodeal_interstitial',
    );
    expect(mockAppodeal.cache).not.toHaveBeenCalled();

    mockAppodealEventHandlers
      .get('onInterstitialClosed')
      ?.forEach(handler => handler());
  });

  it('caches an unloaded iOS interstitial from the temporary debug test', async () => {
    mockPlatformOS = 'ios';
    mockAppodeal.isInitialized.mockReturnValue(true);
    mockAppodeal.isLoaded.mockReturnValue(false);
    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.debugShowAppodealInterstitial();

    expect(mockAppodeal.cache).toHaveBeenCalledWith(1);
    expect(mockAppodeal.show).not.toHaveBeenCalled();

    mockAppodealEventHandlers
      .get('onInterstitialFailedToLoad')
      ?.forEach(handler => handler(new Error('debug load failed')));
  });
});
