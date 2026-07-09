import {
  activate,
  ensureInitialized,
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  onConfigUpdate,
} from '@react-native-firebase/remote-config';

import { ensureFirebaseReady } from '../../services/firebase';

export const ADS_POLICY_REMOTE_CONFIG_KEY = 'ads_policy_v1';

const ADS_POLICY_FETCH_INTERVAL_MS = __DEV__ ? 0 : 4 * 60 * 60 * 1000;
const MIN_GRACE_PERIOD_MS = 0;
const MAX_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

type AdsFrequencyPolicy = {
  enabled: boolean;
  frequency: number;
};

type CustomWordAddAdsPolicy = {
  enabled: boolean;
  skipFirstInterstitial: boolean;
};

export type AdsPolicy = {
  version: number;
  adsEnabled: boolean;
  bannerEnabled: boolean;
  interstitialsEnabled: boolean;
  firstLaunchGracePeriodMs: number;
  itemClick: AdsFrequencyPolicy;
  favoriteSave: AdsFrequencyPolicy;
  randomPractice: AdsFrequencyPolicy;
  customWordAdd: CustomWordAddAdsPolicy;
};

export const DEFAULT_ADS_POLICY: AdsPolicy = {
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

let adsPolicy = DEFAULT_ADS_POLICY;
let adsPolicyReadyPromise: Promise<AdsPolicy> | null = null;
let adsPolicyRealtimeUnsubscribe: (() => void) | null = null;

const adsPolicyListeners = new Set<(policy: AdsPolicy) => void>();

function sanitizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeFrequency(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

function sanitizeGracePeriodMs(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(
    MAX_GRACE_PERIOD_MS,
    Math.max(MIN_GRACE_PERIOD_MS, Math.floor(value)),
  );
}

function sanitizeVersion(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

function sanitizeFrequencyPolicy(
  value: unknown,
  fallback: AdsFrequencyPolicy,
): AdsFrequencyPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const candidate = value as Partial<AdsFrequencyPolicy>;

  return {
    enabled: sanitizeBoolean(candidate.enabled, fallback.enabled),
    frequency: sanitizeFrequency(candidate.frequency, fallback.frequency),
  };
}

function sanitizeCustomWordAddPolicy(
  value: unknown,
  fallback: CustomWordAddAdsPolicy,
): CustomWordAddAdsPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  const candidate = value as Partial<CustomWordAddAdsPolicy>;

  return {
    enabled: sanitizeBoolean(candidate.enabled, fallback.enabled),
    skipFirstInterstitial: sanitizeBoolean(
      candidate.skipFirstInterstitial,
      fallback.skipFirstInterstitial,
    ),
  };
}

export function sanitizeAdsPolicy(value: unknown): AdsPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_ADS_POLICY;
  }

  const candidate = value as Partial<AdsPolicy>;

  return {
    version: sanitizeVersion(candidate.version, DEFAULT_ADS_POLICY.version),
    adsEnabled: sanitizeBoolean(
      candidate.adsEnabled,
      DEFAULT_ADS_POLICY.adsEnabled,
    ),
    bannerEnabled: sanitizeBoolean(
      candidate.bannerEnabled,
      DEFAULT_ADS_POLICY.bannerEnabled,
    ),
    interstitialsEnabled: sanitizeBoolean(
      candidate.interstitialsEnabled,
      DEFAULT_ADS_POLICY.interstitialsEnabled,
    ),
    firstLaunchGracePeriodMs: sanitizeGracePeriodMs(
      candidate.firstLaunchGracePeriodMs,
      DEFAULT_ADS_POLICY.firstLaunchGracePeriodMs,
    ),
    itemClick: sanitizeFrequencyPolicy(
      candidate.itemClick,
      DEFAULT_ADS_POLICY.itemClick,
    ),
    favoriteSave: sanitizeFrequencyPolicy(
      candidate.favoriteSave,
      DEFAULT_ADS_POLICY.favoriteSave,
    ),
    randomPractice: sanitizeFrequencyPolicy(
      candidate.randomPractice,
      DEFAULT_ADS_POLICY.randomPractice,
    ),
    customWordAdd: sanitizeCustomWordAddPolicy(
      candidate.customWordAdd,
      DEFAULT_ADS_POLICY.customWordAdd,
    ),
  };
}

function safeStringifyAdsPolicy(policy: AdsPolicy) {
  return JSON.stringify(policy);
}

function notifyAdsPolicyListeners() {
  adsPolicyListeners.forEach(listener => {
    listener(adsPolicy);
  });
}

function applyAdsPolicy(rawValue: string | null | undefined) {
  if (!rawValue) {
    adsPolicy = DEFAULT_ADS_POLICY;
    notifyAdsPolicyListeners();
    return adsPolicy;
  }

  try {
    adsPolicy = sanitizeAdsPolicy(JSON.parse(rawValue));
  } catch (error) {
    console.warn('Failed to parse remote ads policy. Falling back to defaults.', error);
    adsPolicy = DEFAULT_ADS_POLICY;
  }

  notifyAdsPolicyListeners();
  return adsPolicy;
}

export function getAdsPolicy() {
  return adsPolicy;
}

export function subscribeToAdsPolicyUpdates(listener: (policy: AdsPolicy) => void) {
  adsPolicyListeners.add(listener);

  return () => {
    adsPolicyListeners.delete(listener);
  };
}

function getConfiguredRemoteConfig() {
  const remoteConfig = getRemoteConfig();

  remoteConfig.settings = {
    minimumFetchIntervalMillis: ADS_POLICY_FETCH_INTERVAL_MS,
  };
  remoteConfig.defaultConfig = {
    [ADS_POLICY_REMOTE_CONFIG_KEY]: safeStringifyAdsPolicy(DEFAULT_ADS_POLICY),
  };

  return remoteConfig;
}

function attachRealtimeAdsPolicyListener() {
  if (adsPolicyRealtimeUnsubscribe) {
    return;
  }

  const remoteConfig = getConfiguredRemoteConfig();

  adsPolicyRealtimeUnsubscribe = onConfigUpdate(remoteConfig, {
    next: async () => {
      try {
        await activate(remoteConfig);
        applyAdsPolicy(
          getValue(remoteConfig, ADS_POLICY_REMOTE_CONFIG_KEY).asString(),
        );
      } catch (error) {
        console.warn('Failed to activate realtime remote ads policy update.', error);
      }
    },
    error: error => {
      console.warn('Remote ads policy listener failed.', error);
    },
    complete: () => undefined,
  });
}

export async function initializeAdsPolicy() {
  if (!adsPolicyReadyPromise) {
    adsPolicyReadyPromise = (async () => {
      try {
        await ensureFirebaseReady();

        const remoteConfig = getConfiguredRemoteConfig();
        await ensureInitialized(remoteConfig);

        applyAdsPolicy(
          getValue(remoteConfig, ADS_POLICY_REMOTE_CONFIG_KEY).asString(),
        );

        try {
          await fetchAndActivate(remoteConfig);
        } catch (error) {
          console.warn('Failed to fetch remote ads policy.', error);
        }

        const nextAdsPolicy = applyAdsPolicy(
          getValue(remoteConfig, ADS_POLICY_REMOTE_CONFIG_KEY).asString(),
        );

        attachRealtimeAdsPolicyListener();

        return nextAdsPolicy;
      } catch (error) {
        console.warn('Failed to initialize remote ads policy.', error);
        return applyAdsPolicy(safeStringifyAdsPolicy(DEFAULT_ADS_POLICY));
      }
    })();
  }

  return adsPolicyReadyPromise;
}
