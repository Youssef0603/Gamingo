import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';

// Flip this to true when you want to test ads during development.
const SHOW_ADS_IN_DEVELOPMENT = true;

export const ADS_ENABLED = !__DEV__ || SHOW_ADS_IN_DEVELOPMENT;

const ADS_STATE_STORAGE_KEY = 'gamingo.ads-state';
const FIRST_LAUNCH_AD_GRACE_PERIOD_MS = 10 * 60 * 1000;
const ITEM_CLICK_INTERSTITIAL_FREQUENCY = 5;
const FAVORITE_SAVE_INTERSTITIAL_FREQUENCY = 3;

const productionBannerUnitIds = {
  android: 'ca-app-pub-2492542777972482/9535287858',
  ios: 'ca-app-pub-2492542777972482/3486708659',
} as const;

const productionInterstitialUnitIds = {
  android: 'ca-app-pub-2492542777972482/6078808861',
  ios: 'ca-app-pub-2492542777972482/1157654674',
} as const;

type PersistedAdsState = {
  hasSkippedFirstCustomWordAddAd?: boolean;
  favoriteSaveCount?: number;
  itemClickCount?: number;
};

let initializationPromise: Promise<unknown> | null = null;
let adStateHydrationPromise: Promise<void> | null = null;
let adStatePersistPromise: Promise<void> = Promise.resolve();
let adStateHydrated = false;
let isFirstLaunchSession = false;
let firstLaunchAccumulatedUsageMs = 0;
let firstLaunchForegroundStartedAtMs: number | null = null;
let hasSkippedFirstCustomWordAddAd = false;
let itemClickCount = 0;
let favoriteSaveCount = 0;
let interstitialListenersAttached = false;
let interstitialLoaded = false;
let interstitialShowing = false;
let pendingInterstitialAction: (() => void) | null = null;
let adAvailabilityTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateListenerAttached = false;
let currentAppState = AppState.currentState;

const adAvailabilityListeners = new Set<() => void>();

function sanitizePersistedCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function queueAdStatePersist() {
  const snapshot: PersistedAdsState = {
    hasSkippedFirstCustomWordAddAd,
    favoriteSaveCount,
    itemClickCount,
  };

  adStatePersistPromise = adStatePersistPromise
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(ADS_STATE_STORAGE_KEY, JSON.stringify(snapshot)),
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

function clearScheduledAdAvailabilityUpdate() {
  if (adAvailabilityTimeout) {
    clearTimeout(adAvailabilityTimeout);
    adAvailabilityTimeout = null;
  }
}

function getCurrentFirstLaunchUsageMs(now = Date.now()) {
  if (
    !isFirstLaunchSession ||
    currentAppState !== 'active' ||
    firstLaunchForegroundStartedAtMs === null
  ) {
    return 0;
  }

  return Math.max(0, now - firstLaunchForegroundStartedAtMs);
}

function getFirstLaunchAdGraceRemainingMs(now = Date.now()) {
  if (!isFirstLaunchSession) {
    return 0;
  }

  const usedMs =
    firstLaunchAccumulatedUsageMs + getCurrentFirstLaunchUsageMs(now);

  return Math.max(0, FIRST_LAUNCH_AD_GRACE_PERIOD_MS - usedMs);
}

function scheduleAdAvailabilityUpdate() {
  clearScheduledAdAvailabilityUpdate();

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

    if (
      isFirstLaunchSession &&
      currentAppState === 'active' &&
      nextAppState !== 'active' &&
      firstLaunchForegroundStartedAtMs !== null
    ) {
      firstLaunchAccumulatedUsageMs += Math.max(
        0,
        now - firstLaunchForegroundStartedAtMs,
      );
      firstLaunchForegroundStartedAtMs = null;
    }

    if (
      isFirstLaunchSession &&
      currentAppState !== 'active' &&
      nextAppState === 'active' &&
      firstLaunchForegroundStartedAtMs === null
    ) {
      firstLaunchForegroundStartedAtMs = now;
    }

    currentAppState = nextAppState;
    scheduleAdAvailabilityUpdate();
    notifyAdAvailabilityListeners();
  });
}

async function hydrateAdState() {
  if (adStateHydrated) {
    return;
  }

  try {
    const storedValue = await AsyncStorage.getItem(ADS_STATE_STORAGE_KEY);

    if (!storedValue) {
      isFirstLaunchSession = true;
      firstLaunchAccumulatedUsageMs = 0;
      firstLaunchForegroundStartedAtMs =
        currentAppState === 'active' ? Date.now() : null;
      hasSkippedFirstCustomWordAddAd = false;
      itemClickCount = 0;
      favoriteSaveCount = 0;
      await queueAdStatePersist();
      return;
    }

    const parsedValue: PersistedAdsState = JSON.parse(storedValue);

    isFirstLaunchSession = false;
    firstLaunchAccumulatedUsageMs = 0;
    firstLaunchForegroundStartedAtMs = null;
    hasSkippedFirstCustomWordAddAd = Boolean(
      parsedValue.hasSkippedFirstCustomWordAddAd,
    );
    itemClickCount = sanitizePersistedCount(parsedValue.itemClickCount);
    favoriteSaveCount = sanitizePersistedCount(parsedValue.favoriteSaveCount);
  } catch (error) {
    isFirstLaunchSession = false;
    firstLaunchAccumulatedUsageMs = 0;
    firstLaunchForegroundStartedAtMs = null;
    hasSkippedFirstCustomWordAddAd = false;
    itemClickCount = 0;
    favoriteSaveCount = 0;
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
  return ADS_ENABLED && adStateHydrated && getFirstLaunchAdGraceRemainingMs() === 0;
}

function getProductionBannerAdUnitId() {
  const unitId =
    Platform.OS === 'ios'
      ? productionBannerUnitIds.ios
      : productionBannerUnitIds.android;

  return unitId.trim().length > 0 ? unitId : null;
}

function getProductionInterstitialAdUnitId() {
  const unitId =
    Platform.OS === 'ios'
      ? productionInterstitialUnitIds.ios
      : productionInterstitialUnitIds.android;

  return unitId.trim().length > 0 ? unitId : null;
}

export function getBannerAdUnitId() {
  if (!canShowAdsNow()) {
    return null;
  }

  if (__DEV__) {
    return TestIds.ADAPTIVE_BANNER;
  }

  return getProductionBannerAdUnitId();
}

function getInterstitialAdUnitId() {
  if (!ADS_ENABLED) {
    return null;
  }

  if (__DEV__) {
    return TestIds.INTERSTITIAL;
  }

  return getProductionInterstitialAdUnitId();
}

const interstitialAdUnitId = getInterstitialAdUnitId();
const interstitialAd = interstitialAdUnitId
  ? InterstitialAd.createForAdRequest(interstitialAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    })
  : null;

function runPendingInterstitialAction() {
  const action = pendingInterstitialAction;

  pendingInterstitialAction = null;
  action?.();
}

function attachInterstitialListeners() {
  if (!interstitialAd || interstitialListenersAttached) {
    return;
  }

  interstitialListenersAttached = true;

  interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });

  interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitialShowing = false;
    runPendingInterstitialAction();
    interstitialAd.load();
  });

  interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialShowing = false;
    runPendingInterstitialAction();
    interstitialAd.load();
  });
}

export function preloadInterstitialAd() {
  if (!interstitialAd) {
    return;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded && !interstitialShowing) {
    interstitialAd.load();
  }
}

function tryShowInterstitialBefore(action: () => void) {
  if (!canShowAdsNow()) {
    action();
    return false;
  }

  if (!interstitialAd) {
    action();
    return false;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded || interstitialShowing) {
    preloadInterstitialAd();
    action();
    return false;
  }

  pendingInterstitialAction = action;
  interstitialShowing = true;
  interstitialAd.show();

  return true;
}

function tryShowInterstitial() {
  return tryShowInterstitialBefore(() => undefined);
}

export function showInterstitialBefore(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      tryShowInterstitialBefore(action);
    })
    .catch(() => {
      action();
    });
}

export function showAdOnItemClick(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      if (!canShowAdsNow()) {
        action();
        return;
      }

      const nextItemClickCount = itemClickCount + 1;

      if (nextItemClickCount < ITEM_CLICK_INTERSTITIAL_FREQUENCY) {
        itemClickCount = nextItemClickCount;
        queueAdStatePersist();
        action();
        return;
      }

      if (!interstitialAd) {
        itemClickCount = 0;
        queueAdStatePersist();
        action();
        return;
      }

      const didShowAd = tryShowInterstitialBefore(action);

      itemClickCount = didShowAd ? 0 : ITEM_CLICK_INTERSTITIAL_FREQUENCY - 1;
      queueAdStatePersist();
    })
    .catch(() => {
      action();
    });
}

export function showAdBeforeCustomWordAdd(action: () => void) {
  ensureAdStateHydrated()
    .then(() => {
      if (!hasSkippedFirstCustomWordAddAd) {
        hasSkippedFirstCustomWordAddAd = true;
        queueAdStatePersist();
        action();
        return;
      }

      tryShowInterstitialBefore(action);
    })
    .catch(() => {
      action();
    });
}

export function showAdBeforeRandomPractice(action: () => void) {
  showInterstitialBefore(action);
}

export function trackFavoriteSaveAction() {
  ensureAdStateHydrated()
    .then(() => {
      if (!canShowAdsNow()) {
        return;
      }

      const nextFavoriteSaveCount = favoriteSaveCount + 1;

      if (nextFavoriteSaveCount < FAVORITE_SAVE_INTERSTITIAL_FREQUENCY) {
        favoriteSaveCount = nextFavoriteSaveCount;
        queueAdStatePersist();
        return;
      }

      if (!interstitialAd) {
        favoriteSaveCount = 0;
        queueAdStatePersist();
        return;
      }

      const didShowAd = tryShowInterstitial();

      favoriteSaveCount = didShowAd
        ? 0
        : FAVORITE_SAVE_INTERSTITIAL_FREQUENCY - 1;
      queueAdStatePersist();
    })
    .catch(() => undefined);
}

export function useCanShowAds() {
  const [canShowAds, setCanShowAds] = useState(canShowAdsNow());

  useEffect(() => {
    let isMounted = true;

    const syncVisibility = () => {
      if (isMounted) {
        setCanShowAds(canShowAdsNow());
      }
    };

    syncVisibility();
    ensureAdStateHydrated().then(syncVisibility).catch(syncVisibility);

    adAvailabilityListeners.add(syncVisibility);

    return () => {
      isMounted = false;
      adAvailabilityListeners.delete(syncVisibility);
    };
  }, []);

  return canShowAds;
}

export function initializeGoogleMobileAds() {
  if (!ADS_ENABLED) {
    return ensureAdStateHydrated().then(() => null);
  }

  if (!initializationPromise) {
    initializationPromise = ensureAdStateHydrated().then(() =>
      mobileAds()
        .setRequestConfiguration({
          testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
        })
        .then(() => mobileAds().initialize())
        .then(result => {
          preloadInterstitialAd();
          return result;
        }),
    );
  }

  return initializationPromise;
}
