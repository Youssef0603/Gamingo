import { Platform } from 'react-native';
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';
import mobileAds from 'react-native-google-mobile-ads';

// Flip this to true when you want to test ads during development.
const SHOW_ADS_IN_DEVELOPMENT = false;

export const ADS_ENABLED = !__DEV__ || SHOW_ADS_IN_DEVELOPMENT;

const productionBannerUnitIds = {
  android: '',
  ios: '',
} as const;

const productionInterstitialUnitIds = {
  android: '',
  ios: '',
} as const;

let initializationPromise: Promise<unknown> | null = null;
let interstitialListenersAttached = false;
let interstitialLoaded = false;
let interstitialShowing = false;
let pendingInterstitialAction: (() => void) | null = null;

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
  if (!ADS_ENABLED) {
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

export function showInterstitialBefore(action: () => void) {
  if (!interstitialAd) {
    action();
    return;
  }

  attachInterstitialListeners();

  if (!interstitialLoaded || interstitialShowing) {
    preloadInterstitialAd();
    action();
    return;
  }

  pendingInterstitialAction = action;
  interstitialShowing = true;
  interstitialAd.show();
}

export function initializeGoogleMobileAds() {
  if (!ADS_ENABLED) {
    return Promise.resolve(null);
  }

  if (!initializationPromise) {
    initializationPromise = mobileAds()
      .setRequestConfiguration({
        testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
      })
      .then(() => mobileAds().initialize())
      .then(result => {
        preloadInterstitialAd();
        return result;
      });
  }

  return initializationPromise;
}
