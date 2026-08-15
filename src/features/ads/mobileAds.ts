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
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
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
  firstLaunchGraceConsumedMs?: number;
  firstLaunchGraceStartedAtMs?: number;
  itemClickCount?: number;
  randomPracticeStartCount?: number;
};

const FIRST_LAUNCH_USAGE_PERSIST_INTERVAL_MS = 30 * 1000;

let initializationPromise: Promise<unknown> | null = null;
let adStateHydrationPromise: Promise<void> | null = null;
let adStatePersistPromise: Promise<void> = Promise.resolve();
let adStateHydrated = false;
let hasTrackedFirstLaunchGraceState = false;
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
let pendingInterstitialPlacement: string | null = null;
let adAvailabilityTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateListenerAttached = false;
let currentAppState = AppState.currentState;
let interstitialAd: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let firstLaunchUsagePersistInterval: ReturnType<typeof setInterval> | null = null;

const adAvailabilityListeners = new Set<() => void>();

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
  pendingInterstitialPlacement = null;
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
    trackAdLifecycleEvent(
      ANALYTICS_EVENTS.AD_LOADED,
      pendingInterstitialPlacement ?? 'preload',
      {
        [ANALYTICS_PARAMS.AD_RESULT]: 'loaded',
      },
    );
  });

  nextInterstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
    const placement = pendingInterstitialPlacement ?? 'unknown';

    interstitialLoaded = false;
    interstitialShowing = false;
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_CLOSED, placement, {
      [ANALYTICS_PARAMS.AD_RESULT]: 'closed',
    });
    runPendingInterstitialAction();
    nextInterstitialAd.load();
  });

  nextInterstitialAd.addAdEventListener(AdEventType.ERROR, error => {
    const placement = pendingInterstitialPlacement ?? 'unknown';

    interstitialLoaded = false;
    interstitialShowing = false;
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_FAILED, placement, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
    });
    runPendingInterstitialAction();
    nextInterstitialAd.load();
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

  const nextInterstitialAd = getInterstitialAd();

  if (!nextInterstitialAd) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
      [ANALYTICS_PARAMS.AD_GATE_REASON]: 'missing_unit_id',
      [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
    });
    return;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded && !interstitialShowing) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_LOAD_STARTED, placement, {
      [ANALYTICS_PARAMS.AD_RESULT]: 'loading',
    });
    nextInterstitialAd.load();
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

  const nextInterstitialAd = getInterstitialAd();

  if (!nextInterstitialAd) {
    trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SKIPPED, placement, {
      [ANALYTICS_PARAMS.AD_GATE_REASON]: 'missing_unit_id',
      [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
    });
    action();
    return false;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded || interstitialShowing) {
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
  trackAdLifecycleEvent(ANALYTICS_EVENTS.AD_SHOWN, placement, {
    [ANALYTICS_PARAMS.AD_RESULT]: 'shown',
  });
  nextInterstitialAd.show();

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
