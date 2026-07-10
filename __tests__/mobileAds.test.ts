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

const mockInterstitialAd = {
  addAdEventListener: jest.fn(),
  load: jest.fn(),
  show: jest.fn(),
};

const mockMobileAdsInstance = {
  initialize: jest.fn(() => Promise.resolve({})),
  setRequestConfiguration: jest.fn(() => Promise.resolve()),
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
  Platform: {
    OS: 'android',
  },
}));

jest.mock('react-native-google-mobile-ads', () => {
  const factory = jest.fn(() => mockMobileAdsInstance);

  return {
    __esModule: true,
    AdEventType: {
      CLOSED: 'closed',
      ERROR: 'error',
      LOADED: 'loaded',
    },
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => mockInterstitialAd),
    },
    TestIds: {
      ADAPTIVE_BANNER: 'test-banner-id',
      INTERSTITIAL: 'test-interstitial-id',
    },
    default: factory,
  };
});

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

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockStorage.clear();
    now = 1_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  async function loadMobileAdsModule() {
    const { setAppRemoteConfigState } = require('../src/state/appRemoteConfigStore');
    setAppRemoteConfigState({
      adsPolicy: TEST_ADS_POLICY,
    });

    const mobileAds = require('../src/features/ads/mobileAds');

    await mobileAds.initializeGoogleMobileAds();

    return mobileAds;
  }

  it('keeps first-launch banner ads hidden after an app relaunch during grace', async () => {
    const firstLaunchMobileAds = await loadMobileAdsModule();

    expect(firstLaunchMobileAds.getBannerAdUnitId()).toBeNull();

    const firstLaunchState = JSON.parse(mockStorage.get('adsState') ?? '{}');
    expect(firstLaunchState.firstLaunchGraceConsumedMs).toBe(0);
    expect(firstLaunchState.firstLaunchGraceStartedAtMs).toBe(now);

    now += 5 * 1000;
    jest.resetModules();

    const relaunchedMobileAds = await loadMobileAdsModule();

    expect(relaunchedMobileAds.getBannerAdUnitId()).toBeNull();

    const relaunchedState = JSON.parse(mockStorage.get('adsState') ?? '{}');
    expect(relaunchedState.firstLaunchGraceConsumedMs).toBe(5 * 1000);
    expect(relaunchedState.firstLaunchGraceStartedAtMs).toBe(now);
  });

  it('does not retroactively put legacy ad-state users back into grace', async () => {
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

    expect(mobileAds.getBannerAdUnitId()).toBe('test-banner-id');
  });
});
