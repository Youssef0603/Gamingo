import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';

import {
  initializeAdsPolicy,
} from './adsPolicy';
import { getItemWithMigration, STORAGE_KEYS } from '../../storage/asyncStorageKeys';
import {
  getAppAdsPolicy,
  subscribeToAppRemoteConfigState,
} from '../../state/appRemoteConfigStore';

// Flip this to true when you want to test ads during development.
const SHOW_ADS_IN_DEVELOPMENT = true;

export const ADS_ENABLED = !__DEV__ || SHOW_ADS_IN_DEVELOPMENT;

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
  randomPracticeStartCount?: number;
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
let randomPracticeStartCount = 0;
let interstitialListenersAttached = false;
let interstitialLoaded = false;
let interstitialShowing = false;
let pendingInterstitialAction: (() => void) | null = null;
let adAvailabilityTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateListenerAttached = false;
let currentAppState = AppState.currentState;
let interstitialAd: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;

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

  const { firstLaunchGracePeriodMs } = getAppAdsPolicy();
  const usedMs =
    firstLaunchAccumulatedUsageMs + getCurrentFirstLaunchUsageMs(now);

  return Math.max(0, firstLaunchGracePeriodMs - usedMs);
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
    const storedValue = await getItemWithMigration('adsState');

    if (!storedValue) {
      isFirstLaunchSession = true;
      firstLaunchAccumulatedUsageMs = 0;
      firstLaunchForegroundStartedAtMs =
        currentAppState === 'active' ? Date.now() : null;
      hasSkippedFirstCustomWordAddAd = false;
      itemClickCount = 0;
      favoriteSaveCount = 0;
      randomPracticeStartCount = 0;
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
    randomPracticeStartCount = sanitizePersistedCount(
      parsedValue.randomPracticeStartCount,
    );
  } catch (error) {
    isFirstLaunchSession = false;
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

function canShowBannerAdsNow() {
  const adsPolicy = getAppAdsPolicy();

  return canShowAdsNow() && adsPolicy.bannerEnabled;
}

function canShowInterstitialAdsNow() {
  const adsPolicy = getAppAdsPolicy();

  return canShowAdsNow() && adsPolicy.interstitialsEnabled;
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
  if (!canShowBannerAdsNow()) {
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

function getInterstitialAd() {
  if (interstitialAd) {
    return interstitialAd;
  }

  const interstitialAdUnitId = getInterstitialAdUnitId();

  if (!interstitialAdUnitId) {
    return null;
  }

  interstitialAd = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  return interstitialAd;
}

function runPendingInterstitialAction() {
  const action = pendingInterstitialAction;

  pendingInterstitialAction = null;
  action?.();
}

function attachInterstitialListeners() {
  const nextInterstitialAd = getInterstitialAd();

  if (!nextInterstitialAd || interstitialListenersAttached) {
    return;
  }

  interstitialListenersAttached = true;

  nextInterstitialAd.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });

  nextInterstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitialShowing = false;
    runPendingInterstitialAction();
    nextInterstitialAd.load();
  });

  nextInterstitialAd.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    interstitialShowing = false;
    runPendingInterstitialAction();
    nextInterstitialAd.load();
  });
}

export function preloadInterstitialAd() {
  if (!canShowInterstitialAdsNow()) {
    return;
  }

  const nextInterstitialAd = getInterstitialAd();

  if (!nextInterstitialAd) {
    return;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded && !interstitialShowing) {
    nextInterstitialAd.load();
  }
}

function tryShowInterstitialBefore(action: () => void) {
  if (!canShowInterstitialAdsNow()) {
    action();
    return false;
  }

  const nextInterstitialAd = getInterstitialAd();

  if (!nextInterstitialAd) {
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
  nextInterstitialAd.show();

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
      const { itemClick } = getAppAdsPolicy();

      if (!itemClick.enabled || !canShowInterstitialAdsNow()) {
        action();
        return;
      }

      const nextItemClickCount = itemClickCount + 1;
      const itemClickFrequency = itemClick.frequency;

      if (nextItemClickCount < itemClickFrequency) {
        itemClickCount = nextItemClickCount;
        queueAdStatePersist();
        action();
        return;
      }

      const didShowAd = tryShowInterstitialBefore(action);

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
        action();
        return;
      }

      if (customWordAdd.skipFirstInterstitial && !hasSkippedFirstCustomWordAddAd) {
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
  ensureAdStateHydrated()
    .then(() => {
      const { randomPractice } = getAppAdsPolicy();

      if (!randomPractice.enabled || !canShowInterstitialAdsNow()) {
        action();
        return;
      }

      const nextRandomPracticeStartCount = randomPracticeStartCount + 1;
      const randomPracticeFrequency = randomPractice.frequency;

      if (nextRandomPracticeStartCount < randomPracticeFrequency) {
        randomPracticeStartCount = nextRandomPracticeStartCount;
        queueAdStatePersist();
        action();
        return;
      }

      const didShowAd = tryShowInterstitialBefore(action);

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
        return;
      }

      const nextFavoriteSaveCount = favoriteSaveCount + 1;
      const favoriteSaveFrequency = favoriteSave.frequency;

      if (nextFavoriteSaveCount < favoriteSaveFrequency) {
        favoriteSaveCount = nextFavoriteSaveCount;
        queueAdStatePersist();
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

export function initializeGoogleMobileAds() {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      ensureAdStateHydrated(),
      initializeAdsPolicy(),
    ]).then(([, adsPolicy]) => {
      notifyAdAvailabilityListeners();

      if (
        !ADS_ENABLED ||
        !adsPolicy.adsEnabled ||
        (!adsPolicy.bannerEnabled && !adsPolicy.interstitialsEnabled)
      ) {
        return null;
      }

      return mobileAds()
        .setRequestConfiguration({
          testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
        })
        .then(() => mobileAds().initialize())
        .then(result => {
          preloadInterstitialAd();
          return result;
        });
    });
  }

  return initializationPromise;
}

subscribeToAppRemoteConfigState(() => {
  scheduleAdAvailabilityUpdate();
  notifyAdAvailabilityListeners();
});
