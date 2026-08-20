import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import {
  AppodealAdType,
  AppodealBannerEvents,
  AppodealInterstitialEvents,
  AppodealLogLevel,
  AppodealPrivacyOptionsStatus,
  AppodealSdkEvents,
} from 'react-native-appodeal';
import Appodeal from 'react-native-appodeal';

import {
  initializeAdsPolicy,
} from './adsPolicy';
import { getItemWithMigration, STORAGE_KEYS } from '../../storage/asyncStorageKeys';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import {
  getAppAdsPolicy,
  subscribeToAppRemoteConfigState,
} from '../../state/appRemoteConfigStore';
import { requestAppTrackingTransparencyForAds } from './appTrackingTransparency';

// Flip this to true when you want to test ads during development.
const SHOW_ADS_IN_DEVELOPMENT = true;

export const ADS_ENABLED = !__DEV__ || SHOW_ADS_IN_DEVELOPMENT;

const appodealAppKeys = {
  android: 'ae83f5206ce5de67cc6de2662adc8fdb62217b2f5a190eb6',
  ios: 'c0d618218a515459ca73f9c17198480092749772c045247d',
} as const;

type PersistedAdsState = {
  hasSkippedFirstCustomWordAddAd?: boolean;
  favoriteSaveCount?: number;
  firstLaunchGraceConsumedMs?: number;
  firstLaunchGraceStartedAtMs?: number;
  itemClickCount?: number;
  randomPracticeStartCount?: number;
};

const FIRST_LAUNCH_USAGE_PERSIST_INTERVAL_MS = 30 * 1000;
const APPODEAL_AD_TYPES =
  // Appodeal combines requested ad formats with a numeric bitmask.
  // eslint-disable-next-line no-bitwise
  AppodealAdType.INTERSTITIAL | AppodealAdType.BANNER;
const APPODEAL_INTERSTITIAL_AD_TYPE = AppodealAdType.INTERSTITIAL;
const APPODEAL_BANNER_AD_TYPE = AppodealAdType.BANNER;
const INLINE_BANNER_PLACEMENT = 'inline_banner';
const DEBUG_INTERSTITIAL_PLACEMENT = 'debug_appodeal_interstitial';
const DEBUG_INTERSTITIAL_LISTENER_TIMEOUT_MS = 60 * 1000;
const DEBUG_APPODEAL_LOG_PREFIX = '[AppodealDebug]';

type AppodealInitializationResult =
  | 'appodeal_initialize_requested'
  | 'ads_disabled'
  | 'missing_app_key';
type AppodealPrivacyChoicesRequirement =
  | 'required'
  | 'not_required'
  | 'unknown'
  | 'unavailable';
type AppodealEventSubscription = {
  remove: () => void;
};

let initializationPromise: Promise<AppodealInitializationResult> | null = null;
let adStateHydrationPromise: Promise<void> | null = null;
let adStatePersistPromise: Promise<void> = Promise.resolve();
let adStateHydrated = false;
let appodealInitialized = false;
let hasTrackedFirstLaunchGraceState = false;
let firstLaunchAccumulatedUsageMs = 0;
let firstLaunchForegroundStartedAtMs: number | null = null;
let hasSkippedFirstCustomWordAddAd = false;
let itemClickCount = 0;
let favoriteSaveCount = 0;
let randomPracticeStartCount = 0;
let appodealListenersAttached = false;
let appodealInitializationRequested = false;
let interstitialLoaded = false;
let interstitialShowing = false;
let pendingInterstitialAction: (() => void) | null = null;
let pendingInterstitialPlacement: string | null = null;
let adAvailabilityTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateListenerAttached = false;
let currentAppState = AppState.currentState;
let firstLaunchUsagePersistInterval: ReturnType<typeof setInterval> | null = null;
let debugInterstitialListeners: AppodealEventSubscription[] | null = null;
let debugInterstitialCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let shouldShowDebugInterstitialWhenLoaded = false;
let privacyChoicesRequirementStatus = AppodealPrivacyOptionsStatus.UNKNOWN;
let privacyChoicesRefreshPromise: Promise<AppodealPrivacyChoicesRequirement> | null =
  null;

const adAvailabilityListeners = new Set<() => void>();
const privacyChoicesRequirementListeners = new Set<() => void>();

function trackAdLifecycleEvent(
  eventName: string,
  placement: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
) {
  trackAnalyticsEvent(eventName, {
    [ANALYTICS_PARAMS.AD_FORMAT]: 'interstitial',
    [ANALYTICS_PARAMS.AD_PLACEMENT]: placement,
    ...params,
  }).catch(() => undefined);
}

function trackBannerLifecycleEvent(
  eventName: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
) {
  trackAnalyticsEvent(eventName, {
    [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
    [ANALYTICS_PARAMS.AD_PLACEMENT]: INLINE_BANNER_PLACEMENT,
    ...params,
  }).catch(() => undefined);
}

function logAppodealDebug(message: string, params?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (params === undefined) {
    console.log(`${DEBUG_APPODEAL_LOG_PREFIX} ${message}`);
    return;
  }

  console.log(`${DEBUG_APPODEAL_LOG_PREFIX} ${message}`, params);
}

function warnAppodealDebug(message: string, error?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (error === undefined) {
    console.warn(`${DEBUG_APPODEAL_LOG_PREFIX} ${message}`);
    return;
  }

  console.warn(`${DEBUG_APPODEAL_LOG_PREFIX} ${message}`, error);
}

function sanitizePersistedCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function sanitizePersistedTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function queueAdStatePersist() {
  const snapshot: PersistedAdsState = {
    hasSkippedFirstCustomWordAddAd,
    favoriteSaveCount,
    firstLaunchGraceConsumedMs: hasTrackedFirstLaunchGraceState
      ? firstLaunchAccumulatedUsageMs
      : undefined,
    firstLaunchGraceStartedAtMs: hasTrackedFirstLaunchGraceState
      ? firstLaunchForegroundStartedAtMs ?? undefined
      : undefined,
    itemClickCount,
    randomPracticeStartCount,
  };

  adStatePersistPromise = adStatePersistPromise
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(STORAGE_KEYS.adsState, JSON.stringify(snapshot)),
    )
    .catch(error => {
      console.warn('Failed to persist ad state.', error);
    });

  return adStatePersistPromise;
}

function notifyAdAvailabilityListeners() {
  adAvailabilityListeners.forEach(listener => {
    listener();
  });
}

function notifyPrivacyChoicesRequirementListeners() {
  privacyChoicesRequirementListeners.forEach(listener => {
    listener();
  });
}

function setPrivacyChoicesRequirementStatus(
  nextStatus: AppodealPrivacyOptionsStatus,
) {
  if (privacyChoicesRequirementStatus === nextStatus) {
    return;
  }

  privacyChoicesRequirementStatus = nextStatus;
  notifyPrivacyChoicesRequirementListeners();
}

function getPrivacyChoicesRequirementLabel(
  status: AppodealPrivacyOptionsStatus,
) {
  switch (status) {
    case AppodealPrivacyOptionsStatus.REQUIRED:
      return 'REQUIRED';
    case AppodealPrivacyOptionsStatus.NOT_REQUIRED:
      return 'NOT_REQUIRED';
    case AppodealPrivacyOptionsStatus.UNKNOWN:
    default:
      return 'UNKNOWN';
  }
}

function mapPrivacyChoicesRequirementStatus(
  status: AppodealPrivacyOptionsStatus,
): AppodealPrivacyChoicesRequirement {
  switch (status) {
    case AppodealPrivacyOptionsStatus.REQUIRED:
      return 'required';
    case AppodealPrivacyOptionsStatus.NOT_REQUIRED:
      return 'not_required';
    case AppodealPrivacyOptionsStatus.UNKNOWN:
    default:
      return 'unknown';
  }
}

function getCurrentPrivacyChoicesRequirement() {
  if (!isAppodealAdsConfigured()) {
    return 'unavailable';
  }

  return mapPrivacyChoicesRequirementStatus(privacyChoicesRequirementStatus);
}

function clearScheduledAdAvailabilityUpdate() {
  if (adAvailabilityTimeout) {
    clearTimeout(adAvailabilityTimeout);
    adAvailabilityTimeout = null;
  }
}

function clearFirstLaunchUsagePersistInterval() {
  if (firstLaunchUsagePersistInterval) {
    clearInterval(firstLaunchUsagePersistInterval);
    firstLaunchUsagePersistInterval = null;
  }
}

function accumulateFirstLaunchUsage(
  now: number,
  nextForegroundStartedAtMs: number | null,
) {
  if (
    !hasTrackedFirstLaunchGraceState ||
    firstLaunchForegroundStartedAtMs === null
  ) {
    firstLaunchForegroundStartedAtMs = nextForegroundStartedAtMs;
    return false;
  }

  const delta = Math.max(0, now - firstLaunchForegroundStartedAtMs);

  if (delta > 0) {
    firstLaunchAccumulatedUsageMs += delta;
  }

  firstLaunchForegroundStartedAtMs = nextForegroundStartedAtMs;
  return delta > 0;
}

function getCurrentFirstLaunchUsageMs(now = Date.now()) {
  if (
    !hasTrackedFirstLaunchGraceState ||
    currentAppState !== 'active' ||
    firstLaunchForegroundStartedAtMs === null
  ) {
    return 0;
  }

  return Math.max(0, now - firstLaunchForegroundStartedAtMs);
}

function getFirstLaunchAdGraceRemainingMs(now = Date.now()) {
  if (!hasTrackedFirstLaunchGraceState) {
    return 0;
  }

  const { firstLaunchGracePeriodMs } = getAppAdsPolicy();
  const usedMs =
    firstLaunchAccumulatedUsageMs + getCurrentFirstLaunchUsageMs(now);

  return Math.max(0, firstLaunchGracePeriodMs - usedMs);
}

function syncFirstLaunchUsagePersistInterval() {
  clearFirstLaunchUsagePersistInterval();

  if (
    !hasTrackedFirstLaunchGraceState ||
    currentAppState !== 'active' ||
    firstLaunchForegroundStartedAtMs === null ||
    getFirstLaunchAdGraceRemainingMs() <= 0
  ) {
    return;
  }

  firstLaunchUsagePersistInterval = setInterval(() => {
    const now = Date.now();
    const didAccumulateUsage = accumulateFirstLaunchUsage(now, now);

    if (didAccumulateUsage) {
      queueAdStatePersist();
    }

    scheduleAdAvailabilityUpdate();
    notifyAdAvailabilityListeners();
  }, FIRST_LAUNCH_USAGE_PERSIST_INTERVAL_MS);
}

function scheduleAdAvailabilityUpdate() {
  clearScheduledAdAvailabilityUpdate();
  syncFirstLaunchUsagePersistInterval();

  const remainingMs = getFirstLaunchAdGraceRemainingMs();

  if (
    remainingMs <= 0 ||
    currentAppState !== 'active' ||
    firstLaunchForegroundStartedAtMs === null
  ) {
    return;
  }

  adAvailabilityTimeout = setTimeout(() => {
    adAvailabilityTimeout = null;
    notifyAdAvailabilityListeners();
  }, remainingMs);
}

function attachAppStateListener() {
  if (appStateListenerAttached) {
    return;
  }

  appStateListenerAttached = true;

  AppState.addEventListener('change', nextAppState => {
    const now = Date.now();
    let shouldPersistAdState = false;

    if (
      hasTrackedFirstLaunchGraceState &&
      currentAppState === 'active' &&
      nextAppState !== 'active'
    ) {
      shouldPersistAdState = accumulateFirstLaunchUsage(now, null);
    }

    if (
      hasTrackedFirstLaunchGraceState &&
      currentAppState !== 'active' &&
      nextAppState === 'active' &&
      firstLaunchForegroundStartedAtMs === null
    ) {
      firstLaunchForegroundStartedAtMs = now;
      shouldPersistAdState = true;
    }

    currentAppState = nextAppState;
    if (shouldPersistAdState) {
      queueAdStatePersist();
    }
    scheduleAdAvailabilityUpdate();
    notifyAdAvailabilityListeners();
  });
}

async function hydrateAdState() {
  if (adStateHydrated) {
    return;
  }

  try {
    const storedValue = await getItemWithMigration('adsState');
    const now = Date.now();

    if (!storedValue) {
      hasTrackedFirstLaunchGraceState = true;
      firstLaunchAccumulatedUsageMs = 0;
      firstLaunchForegroundStartedAtMs =
        currentAppState === 'active' ? now : null;
      hasSkippedFirstCustomWordAddAd = false;
      itemClickCount = 0;
      favoriteSaveCount = 0;
      randomPracticeStartCount = 0;
      await queueAdStatePersist();
      return;
    }

    const parsedValue: PersistedAdsState = JSON.parse(storedValue);

    hasTrackedFirstLaunchGraceState =
      parsedValue.firstLaunchGraceConsumedMs !== undefined ||
      parsedValue.firstLaunchGraceStartedAtMs !== undefined;
    firstLaunchAccumulatedUsageMs = hasTrackedFirstLaunchGraceState
      ? sanitizePersistedCount(parsedValue.firstLaunchGraceConsumedMs)
      : 0;
    firstLaunchForegroundStartedAtMs = hasTrackedFirstLaunchGraceState &&
      currentAppState === 'active'
      ? now
      : null;

    if (hasTrackedFirstLaunchGraceState) {
      const persistedStartedAtMs = sanitizePersistedTimestamp(
        parsedValue.firstLaunchGraceStartedAtMs,
      );

      if (persistedStartedAtMs !== null) {
        firstLaunchAccumulatedUsageMs += Math.min(
          FIRST_LAUNCH_USAGE_PERSIST_INTERVAL_MS,
          Math.max(0, now - persistedStartedAtMs),
        );
      }
    }

    hasSkippedFirstCustomWordAddAd = Boolean(
      parsedValue.hasSkippedFirstCustomWordAddAd,
    );
    itemClickCount = sanitizePersistedCount(parsedValue.itemClickCount);
    favoriteSaveCount = sanitizePersistedCount(parsedValue.favoriteSaveCount);
    randomPracticeStartCount = sanitizePersistedCount(
      parsedValue.randomPracticeStartCount,
    );

    if (hasTrackedFirstLaunchGraceState && currentAppState === 'active') {
      queueAdStatePersist();
    }
  } catch (error) {
    hasTrackedFirstLaunchGraceState = false;
    firstLaunchAccumulatedUsageMs = 0;
    firstLaunchForegroundStartedAtMs = null;
    hasSkippedFirstCustomWordAddAd = false;
    itemClickCount = 0;
    favoriteSaveCount = 0;
    randomPracticeStartCount = 0;
    console.warn('Failed to hydrate ad state.', error);
  } finally {
    adStateHydrated = true;
    attachAppStateListener();
    scheduleAdAvailabilityUpdate();
    notifyAdAvailabilityListeners();
  }
}

function ensureAdStateHydrated() {
  if (!adStateHydrationPromise) {
    adStateHydrationPromise = hydrateAdState();
  }

  return adStateHydrationPromise;
}

function canShowAdsNow() {
  const adsPolicy = getAppAdsPolicy();

  return (
    ADS_ENABLED
    && adsPolicy.adsEnabled
    && adStateHydrated
    && getFirstLaunchAdGraceRemainingMs() === 0
  );
}

function getAppodealAppKey() {
  const appKey =
    Platform.OS === 'ios'
      ? appodealAppKeys.ios
      : Platform.OS === 'android'
        ? appodealAppKeys.android
        : '';

  return appKey.trim().length > 0 ? appKey : null;
}

export function isAppodealAdsConfigured() {
  return getAppodealAppKey() !== null;
}

export function isAppodealAdsInitialized() {
  return appodealInitialized;
}

export function getBannerAdsGateReason() {
  const adsPolicy = getAppAdsPolicy();

  if (
    !ADS_ENABLED ||
    !adsPolicy.adsEnabled ||
    !adsPolicy.bannerEnabled ||
    !adStateHydrated ||
    getFirstLaunchAdGraceRemainingMs() > 0
  ) {
    return 'not_eligible';
  }

  if (!isAppodealAdsConfigured()) {
    return 'missing_app_key';
  }

  if (!isAppodealAdsInitialized()) {
    return 'not_initialized';
  }

  return null;
}

export async function refreshAppodealPrivacyChoicesRequirement(): Promise<AppodealPrivacyChoicesRequirement> {
  const appKey = getAppodealAppKey();

  if (!appKey) {
    setPrivacyChoicesRequirementStatus(AppodealPrivacyOptionsStatus.UNKNOWN);
    return 'unavailable';
  }

  if (privacyChoicesRefreshPromise) {
    return privacyChoicesRefreshPromise;
  }

  const nextRefreshPromise: Promise<AppodealPrivacyChoicesRequirement> =
    initializeAppodealAds()
    .then(async initializationResult => {
      if (
        initializationResult !== 'appodeal_initialize_requested' &&
        !refreshAppodealInitialized()
      ) {
        setPrivacyChoicesRequirementStatus(AppodealPrivacyOptionsStatus.UNKNOWN);
        logAppodealDebug(
          `Privacy options status skipped: Appodeal initialization result is ${initializationResult}.`,
        );
        return 'unavailable';
      }

      const consentStatus = await Appodeal.requestConsentInfoUpdate(appKey);

      logAppodealDebug(
        `Consent info update completed with status: ${consentStatus}`,
      );

      const requirementStatus = Appodeal.privacyOptionsRequirementStatus();

      setPrivacyChoicesRequirementStatus(requirementStatus);
      logAppodealDebug(
        `Privacy options requirement status: ${getPrivacyChoicesRequirementLabel(
          requirementStatus,
        )}`,
      );

      return mapPrivacyChoicesRequirementStatus(requirementStatus);
    })
    .catch(error => {
      setPrivacyChoicesRequirementStatus(AppodealPrivacyOptionsStatus.UNKNOWN);
      warnAppodealDebug('Consent info update failed.', error);
      return 'unknown' as AppodealPrivacyChoicesRequirement;
    })
    .finally(() => {
      privacyChoicesRefreshPromise = null;
    });

  privacyChoicesRefreshPromise = nextRefreshPromise;
  return privacyChoicesRefreshPromise;
}

export async function showAppodealPrivacyChoicesForm() {
  if (!isAppodealAdsConfigured()) {
    return false;
  }

  if (getCurrentPrivacyChoicesRequirement() !== 'required') {
    const requirement = await refreshAppodealPrivacyChoicesRequirement();

    if (requirement !== 'required') {
      logAppodealDebug(
        `Privacy options form skipped: requirement status is ${requirement}.`,
      );
      return false;
    }
  }

  try {
    logAppodealDebug('Privacy options form opened.');
    await Appodeal.showPrivacyOptionsForm();
    logAppodealDebug('Privacy options form dismissed.');
    refreshAppodealPrivacyChoicesRequirement().catch(() => undefined);
    return true;
  } catch (error) {
    warnAppodealDebug('Privacy options form error.', error);
    return false;
  }
}

export function useShouldShowAppodealPrivacyChoices() {
  const [shouldShow, setShouldShow] = useState(
    () => getCurrentPrivacyChoicesRequirement() === 'required',
  );

  useEffect(() => {
    let isMounted = true;

    const syncState = () => {
      if (isMounted) {
        setShouldShow(getCurrentPrivacyChoicesRequirement() === 'required');
      }
    };

    privacyChoicesRequirementListeners.add(syncState);
    refreshAppodealPrivacyChoicesRequirement()
      .then(syncState)
      .catch(() => undefined);

    return () => {
      isMounted = false;
      privacyChoicesRequirementListeners.delete(syncState);
    };
  }, []);

  return shouldShow;
}

function canShowBannerAdsNow() {
  return getBannerAdsGateReason() === null;
}

function canShowInterstitialAdsNow() {
  const adsPolicy = getAppAdsPolicy();

  return canShowAdsNow() && adsPolicy.interstitialsEnabled;
}

function runPendingInterstitialAction() {
  const action = pendingInterstitialAction;

  pendingInterstitialAction = null;
  pendingInterstitialPlacement = null;
  action?.();
}

function setAppodealInitialized(nextValue: boolean) {
  if (appodealInitialized === nextValue) {
    return;
  }

  appodealInitialized = nextValue;
  notifyAdAvailabilityListeners();
}

function refreshAppodealInitialized() {
  if (!isAppodealAdsConfigured()) {
    setAppodealInitialized(false);
    return false;
  }

  try {
    setAppodealInitialized(
      appodealInitialized || Appodeal.isInitialized(APPODEAL_AD_TYPES),
    );
  } catch {
    return appodealInitialized;
  }

  return appodealInitialized;
}

function trackInterstitialSkipped(
  placement: string,
  reason: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
) {
  trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
    [ANALYTICS_PARAMS.AD_GATE_REASON]: reason,
    [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
    ...params,
  });
}

function getAppodealProviderGateReason() {
  if (!isAppodealAdsConfigured()) {
    return 'missing_app_key';
  }

  if (!refreshAppodealInitialized()) {
    return 'not_initialized';
  }

  return null;
}

function configureAppodealBeforeInitialization() {
  if (__DEV__) {
    Appodeal.setLogLevel(AppodealLogLevel.DEBUG);
  }

  Appodeal.setTesting(__DEV__);
  Appodeal.setAutoCache(APPODEAL_INTERSTITIAL_AD_TYPE, true);
  Appodeal.setAutoCache(APPODEAL_BANNER_AD_TYPE, true);
  Appodeal.setSmartBanners(true);

  try {
    Appodeal.disableNetwork('admob', APPODEAL_AD_TYPES);
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to disable Appodeal AdMob network', error);
    }
  }
}

async function initializeAppodealSdk(appKey: string) {
  if (appodealInitialized || appodealInitializationRequested) {
    return false;
  }

  const trackingAuthorizationStatus =
    await requestAppTrackingTransparencyForAds();

  if (__DEV__ && Platform.OS === 'ios') {
    logAppodealDebug(
      `ATT authorization status before Appodeal initialization: ${trackingAuthorizationStatus}`,
    );
  }

  if (appodealInitialized || appodealInitializationRequested) {
    return false;
  }

  attachAppodealListeners();
  configureAppodealBeforeInitialization();
  appodealInitializationRequested = true;

  if (__DEV__ && Platform.OS === 'android') {
    logAppodealDebug('Appodeal Android initialization requested.');
  }

  Appodeal.initialize(appKey, APPODEAL_AD_TYPES);
  refreshAppodealInitialized();

  return true;
}

function attachAppodealListeners() {
  if (appodealListenersAttached) {
    return;
  }

  appodealListenersAttached = true;

  Appodeal.addEventListener(AppodealSdkEvents.INITIALIZED, () => {
    setAppodealInitialized(true);
    preloadInterstitialAd();
  });

  Appodeal.addEventListener(AppodealBannerEvents.SHOWN, () => {
    logAppodealDebug('Banner shown.');

    trackBannerLifecycleEvent(ANALYTICS_EVENTS.AD_IMPRESSION_RECORDED, {
      [ANALYTICS_PARAMS.AD_RESULT]: 'impression',
    });
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.LOADED, () => {
    interstitialLoaded = true;
    trackAdLifecycleEvent(
      ANALYTICS_EVENTS.AD_LOADED,
      pendingInterstitialPlacement ?? 'preload',
      {
        [ANALYTICS_PARAMS.AD_RESULT]: 'loaded',
      },
    );
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_LOAD, error => {
    interstitialLoaded = false;
    trackAdLifecycleEvent(
      ANALYTICS_EVENTS.AD_FAILED,
      pendingInterstitialPlacement ?? 'preload',
      {
        ...getErrorAnalyticsParams(error),
        [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
      },
    );
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.EXPIRED, () => {
    const placement = pendingInterstitialPlacement ?? 'preload';

    interstitialLoaded = false;
    trackInterstitialSkipped(placement, 'expired');

    if (interstitialShowing) {
      interstitialShowing = false;
      runPendingInterstitialAction();
    }

    preloadInterstitialAd();
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.SHOWN, () => {
    interstitialLoaded = false;
    interstitialShowing = true;
    trackAdLifecycleEvent(
      ANALYTICS_EVENTS.AD_SHOWN,
      pendingInterstitialPlacement ?? 'unknown',
      {
        [ANALYTICS_PARAMS.AD_RESULT]: 'shown',
      },
    );
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_SHOW, error => {
    const placement = pendingInterstitialPlacement ?? 'unknown';

    interstitialLoaded = false;
    interstitialShowing = false;
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_FAILED, placement, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
    });
    runPendingInterstitialAction();
    preloadInterstitialAd();
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.CLICKED, () => {
    trackAdLifecycleEvent(
      ANALYTICS_EVENTS.AD_OPENED,
      pendingInterstitialPlacement ?? 'unknown',
      {
        [ANALYTICS_PARAMS.AD_RESULT]: 'opened',
      },
    );
  });

  Appodeal.addEventListener(AppodealInterstitialEvents.CLOSED, () => {
    const placement = pendingInterstitialPlacement ?? 'unknown';

    interstitialLoaded = false;
    interstitialShowing = false;
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_CLOSED, placement, {
      [ANALYTICS_PARAMS.AD_RESULT]: 'closed',
    });
    runPendingInterstitialAction();
    preloadInterstitialAd();
  });
}

export function preloadInterstitialAd(placement = 'preload') {
  if (!canShowInterstitialAdsNow()) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
      [ANALYTICS_PARAMS.AD_GATE_REASON]: 'not_eligible',
      [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
      [ANALYTICS_PARAMS.GRACE_REMAINING_MS]: getFirstLaunchAdGraceRemainingMs(),
    });
    return;
  }

  const providerGateReason = getAppodealProviderGateReason();

  if (providerGateReason) {
    trackInterstitialSkipped(placement, providerGateReason);
    return;
  }

  if (!interstitialLoaded && !interstitialShowing) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_LOAD_STARTED, placement, {
      [ANALYTICS_PARAMS.AD_RESULT]: 'loading',
    });

    try {
      Appodeal.cache(APPODEAL_INTERSTITIAL_AD_TYPE);
    } catch (error) {
      trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_FAILED, placement, {
        ...getErrorAnalyticsParams(error),
        [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
      });
    }
  }
}

function tryShowInterstitialBefore(action: () => void, placement = 'manual') {
  if (!canShowInterstitialAdsNow()) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
      [ANALYTICS_PARAMS.AD_GATE_REASON]: 'not_eligible',
      [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
      [ANALYTICS_PARAMS.GRACE_REMAINING_MS]: getFirstLaunchAdGraceRemainingMs(),
    });
    action();
    return false;
  }

  const providerGateReason = getAppodealProviderGateReason();

  if (providerGateReason) {
    trackInterstitialSkipped(placement, providerGateReason);
    action();
    return false;
  }

  let isLoaded = interstitialLoaded;
  let canShow = false;

  try {
    isLoaded = isLoaded || Appodeal.isLoaded(APPODEAL_INTERSTITIAL_AD_TYPE);
    canShow = Appodeal.canShow(APPODEAL_INTERSTITIAL_AD_TYPE, placement);
  } catch (error) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_FAILED, placement, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
    });
    action();
    return false;
  }

  if (!isLoaded || !canShow || interstitialShowing) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
      [ANALYTICS_PARAMS.AD_GATE_REASON]: interstitialShowing
        ? 'already_showing'
        : 'not_loaded',
      [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
    });
    preloadInterstitialAd(placement);
    action();
    return false;
  }

  pendingInterstitialAction = action;
  pendingInterstitialPlacement = placement;
  interstitialShowing = true;

  try {
    Appodeal.show(APPODEAL_INTERSTITIAL_AD_TYPE, placement);
  } catch (error) {
    interstitialShowing = false;
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_FAILED, placement, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
    });
    runPendingInterstitialAction();
    return false;
  }

  return true;
}

function tryShowInterstitial() {
  return tryShowInterstitialBefore(() => undefined, 'favorite_save');
}

export function showInterstitialBefore(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      tryShowInterstitialBefore(action, 'manual');
    })
    .catch(() => {
      action();
    });
}

export function showAdOnItemClick(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      const { itemClick } = getAppAdsPolicy();

      if (!itemClick.enabled || !canShowInterstitialAdsNow()) {
        trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, 'item_click', {
          [ANALYTICS_PARAMS.AD_GATE_REASON]: !itemClick.enabled
            ? 'policy_disabled'
            : 'not_eligible',
          [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
        });
        action();
        return;
      }

      const nextItemClickCount = itemClickCount + 1;
      const itemClickFrequency = itemClick.frequency;

      if (nextItemClickCount < itemClickFrequency) {
        itemClickCount = nextItemClickCount;
        queueAdStatePersist();
        trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, 'item_click', {
          [ANALYTICS_PARAMS.AD_FREQUENCY]: itemClickFrequency,
          [ANALYTICS_PARAMS.AD_GATE_REASON]: 'frequency_not_reached',
          [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
        });
        action();
        return;
      }

      const didShowAd = tryShowInterstitialBefore(action, 'item_click');

      itemClickCount = didShowAd ? 0 : itemClickFrequency - 1;
      queueAdStatePersist();
    })
    .catch(() => {
      action();
    });
}

export function showAdBeforeCustomWordAdd(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      const { customWordAdd } = getAppAdsPolicy();

      if (!customWordAdd.enabled || !canShowInterstitialAdsNow()) {
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'custom_word_add',
          {
            [ANALYTICS_PARAMS.AD_GATE_REASON]: !customWordAdd.enabled
              ? 'policy_disabled'
              : 'not_eligible',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        action();
        return;
      }

      if (customWordAdd.skipFirstInterstitial && !hasSkippedFirstCustomWordAddAd) {
        hasSkippedFirstCustomWordAddAd = true;
        queueAdStatePersist();
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'custom_word_add',
          {
            [ANALYTICS_PARAMS.AD_GATE_REASON]: 'first_add_skip',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        action();
        return;
      }

      tryShowInterstitialBefore(action, 'custom_word_add');
    })
    .catch(() => {
      action();
    });
}

export function showAdBeforeRandomPractice(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      const { randomPractice } = getAppAdsPolicy();

      if (!randomPractice.enabled || !canShowInterstitialAdsNow()) {
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'random_practice',
          {
            [ANALYTICS_PARAMS.AD_GATE_REASON]: !randomPractice.enabled
              ? 'policy_disabled'
              : 'not_eligible',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        action();
        return;
      }

      const nextRandomPracticeStartCount = randomPracticeStartCount + 1;
      const randomPracticeFrequency = randomPractice.frequency;

      if (nextRandomPracticeStartCount < randomPracticeFrequency) {
        randomPracticeStartCount = nextRandomPracticeStartCount;
        queueAdStatePersist();
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'random_practice',
          {
            [ANALYTICS_PARAMS.AD_FREQUENCY]: randomPracticeFrequency,
            [ANALYTICS_PARAMS.AD_GATE_REASON]: 'frequency_not_reached',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        action();
        return;
      }

      const didShowAd = tryShowInterstitialBefore(action, 'random_practice');

      randomPracticeStartCount = didShowAd ? 0 : randomPracticeFrequency - 1;
      queueAdStatePersist();
    })
    .catch(() => {
      action();
    });
}

export function trackFavoriteSaveAction() {
  ensureAdStateHydrated()
    .then(() => {
      const { favoriteSave } = getAppAdsPolicy();

      if (!favoriteSave.enabled || !canShowInterstitialAdsNow()) {
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'favorite_save',
          {
            [ANALYTICS_PARAMS.AD_GATE_REASON]: !favoriteSave.enabled
              ? 'policy_disabled'
              : 'not_eligible',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        return;
      }

      const nextFavoriteSaveCount = favoriteSaveCount + 1;
      const favoriteSaveFrequency = favoriteSave.frequency;

      if (nextFavoriteSaveCount < favoriteSaveFrequency) {
        favoriteSaveCount = nextFavoriteSaveCount;
        queueAdStatePersist();
        trackAdLifecycleEvent(
          ANALYTICS_EVENTS.AD_GATE_EVALUATED,
          'favorite_save',
          {
            [ANALYTICS_PARAMS.AD_FREQUENCY]: favoriteSaveFrequency,
            [ANALYTICS_PARAMS.AD_GATE_REASON]: 'frequency_not_reached',
            [ANALYTICS_PARAMS.AD_RESULT]: 'bypassed',
          },
        );
        return;
      }

      const didShowAd = tryShowInterstitial();

      favoriteSaveCount = didShowAd
        ? 0
        : favoriteSaveFrequency - 1;
      queueAdStatePersist();
    })
    .catch(() => undefined);
}

export function useCanShowAds() {
  const [canShowAds, setCanShowAds] = useState(canShowBannerAdsNow());

  useEffect(() => {
    let isMounted = true;

    const syncVisibility = () => {
      if (isMounted) {
        setCanShowAds(canShowBannerAdsNow());
      }
    };

    syncVisibility();
    Promise.all([
      ensureAdStateHydrated(),
      initializeAdsPolicy(),
    ]).then(syncVisibility).catch(syncVisibility);

    adAvailabilityListeners.add(syncVisibility);
    const unsubscribeFromAdsPolicy = subscribeToAppRemoteConfigState(syncVisibility);

    return () => {
      isMounted = false;
      adAvailabilityListeners.delete(syncVisibility);
      unsubscribeFromAdsPolicy();
    };
  }, []);

  return canShowAds;
}

function cleanupDebugInterstitialListeners() {
  if (debugInterstitialCleanupTimeout) {
    clearTimeout(debugInterstitialCleanupTimeout);
    debugInterstitialCleanupTimeout = null;
  }

  debugInterstitialListeners?.forEach(listener => {
    listener.remove();
  });
  debugInterstitialListeners = null;
  shouldShowDebugInterstitialWhenLoaded = false;
}

function debugShowLoadedAppodealInterstitial() {
  if (!__DEV__) {
    return false;
  }

  let canShow = false;

  try {
    canShow = Appodeal.canShow(
      APPODEAL_INTERSTITIAL_AD_TYPE,
      DEBUG_INTERSTITIAL_PLACEMENT,
    );
    logAppodealDebug(`Interstitial canShow status: ${canShow}`);
  } catch (error) {
    warnAppodealDebug('Failed to read interstitial canShow status.', error);
    cleanupDebugInterstitialListeners();
    return false;
  }

  if (!canShow) {
    warnAppodealDebug('Interstitial show skipped: canShow=false.');
    cleanupDebugInterstitialListeners();
    return false;
  }

  try {
    shouldShowDebugInterstitialWhenLoaded = false;
    Appodeal.show(APPODEAL_INTERSTITIAL_AD_TYPE, DEBUG_INTERSTITIAL_PLACEMENT);
    logAppodealDebug('Interstitial show requested.');
    return true;
  } catch (error) {
    warnAppodealDebug('Interstitial show request failed.', error);
    cleanupDebugInterstitialListeners();
    return false;
  }
}

function debugCacheAppodealInterstitial() {
  shouldShowDebugInterstitialWhenLoaded = true;

  try {
    Appodeal.cache(APPODEAL_INTERSTITIAL_AD_TYPE);
    logAppodealDebug('Interstitial cache requested.');
  } catch (error) {
    warnAppodealDebug('Interstitial cache request failed.', error);
    cleanupDebugInterstitialListeners();
  }
}

function debugLoadOrShowAppodealInterstitial() {
  let isLoaded = false;

  try {
    isLoaded = Appodeal.isLoaded(APPODEAL_INTERSTITIAL_AD_TYPE);
    logAppodealDebug(`Interstitial loaded status: ${isLoaded}`);
  } catch (error) {
    warnAppodealDebug('Failed to read interstitial loaded status.', error);
    cleanupDebugInterstitialListeners();
    return;
  }

  if (isLoaded) {
    interstitialLoaded = true;
    debugShowLoadedAppodealInterstitial();
    return;
  }

  debugCacheAppodealInterstitial();
}

function attachDebugInterstitialListeners() {
  cleanupDebugInterstitialListeners();

  debugInterstitialListeners = [
    Appodeal.addEventListener(AppodealSdkEvents.INITIALIZED, () => {
      setAppodealInitialized(true);
      logAppodealDebug('SDK initialized event received.');
      debugLoadOrShowAppodealInterstitial();
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.LOADED, () => {
      interstitialLoaded = true;
      logAppodealDebug('Interstitial loaded.');

      if (shouldShowDebugInterstitialWhenLoaded) {
        debugShowLoadedAppodealInterstitial();
      }
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_LOAD, error => {
      interstitialLoaded = false;
      warnAppodealDebug('Interstitial failed to load.', error);
      cleanupDebugInterstitialListeners();
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.EXPIRED, () => {
      interstitialLoaded = false;
      logAppodealDebug('Interstitial expired.');
      cleanupDebugInterstitialListeners();
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.SHOWN, () => {
      interstitialLoaded = false;
      interstitialShowing = true;
      logAppodealDebug('Interstitial shown.');
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_SHOW, error => {
      interstitialLoaded = false;
      interstitialShowing = false;
      warnAppodealDebug('Interstitial failed to show.', error);
      cleanupDebugInterstitialListeners();
    }),
    Appodeal.addEventListener(AppodealInterstitialEvents.CLOSED, () => {
      interstitialLoaded = false;
      interstitialShowing = false;
      logAppodealDebug('Interstitial closed.');
      cleanupDebugInterstitialListeners();
    }),
  ];

  debugInterstitialCleanupTimeout = setTimeout(() => {
    logAppodealDebug('Debug interstitial listener cleanup timeout reached.');
    cleanupDebugInterstitialListeners();
  }, DEBUG_INTERSTITIAL_LISTENER_TIMEOUT_MS);
}

export async function debugShowAppodealInterstitial() {
  if (!__DEV__) {
    return;
  }

  logAppodealDebug('Test button pressed.');

  const appKey = getAppodealAppKey();

  if (!appKey) {
    warnAppodealDebug('Skipped: missing Appodeal app key.');
    return;
  }

  attachAppodealListeners();
  attachDebugInterstitialListeners();

  let sdkInitialized = false;

  try {
    sdkInitialized = Appodeal.isInitialized(APPODEAL_INTERSTITIAL_AD_TYPE);
    logAppodealDebug(`SDK initialized status: ${sdkInitialized}`);
  } catch (error) {
    warnAppodealDebug('Failed to read Appodeal SDK initialized status.', error);
  }

  if (!sdkInitialized) {
    const didRequestInitialization = await initializeAppodealSdk(appKey);

    if (didRequestInitialization) {
      logAppodealDebug(
        'SDK initialization requested for interstitial and banner test types.',
      );
    }

    if (refreshAppodealInitialized()) {
      debugLoadOrShowAppodealInterstitial();
    }

    return;
  }

  setAppodealInitialized(true);
  debugLoadOrShowAppodealInterstitial();
}

export function initializeAppodealAds() {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      ensureAdStateHydrated(),
      initializeAdsPolicy(),
    ]).then(async ([, adsPolicy]) => {
      notifyAdAvailabilityListeners();

      if (
        !ADS_ENABLED ||
        !adsPolicy.adsEnabled ||
        (!adsPolicy.bannerEnabled && !adsPolicy.interstitialsEnabled)
      ) {
        return 'ads_disabled';
      }

      const appKey = getAppodealAppKey();

      if (!appKey) {
        trackInterstitialSkipped('app_start', 'missing_app_key');
        return 'missing_app_key';
      }

      await initializeAppodealSdk(appKey);

      if (appodealInitialized) {
        preloadInterstitialAd();
      }

      return 'appodeal_initialize_requested';
    });
  }

  return initializationPromise;
}

subscribeToAppRemoteConfigState(() => {
  scheduleAdAvailabilityUpdate();
  notifyAdAvailabilityListeners();
});
