import {
  DEFAULT_ADS_POLICY,
  sanitizeAdsPolicy,
} from '../features/ads/adsPolicy';

import type { AdsPolicy } from '../features/ads/adsPolicy';

export type AppRemoteConfig = {
  adsPolicy: AdsPolicy;
};

export const DEFAULT_APP_REMOTE_CONFIG: AppRemoteConfig = {
  adsPolicy: DEFAULT_ADS_POLICY,
};

let appRemoteConfigState: AppRemoteConfig = DEFAULT_APP_REMOTE_CONFIG;

const appRemoteConfigListeners = new Set<() => void>();

export function sanitizeAppRemoteConfig(value: unknown): AppRemoteConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_APP_REMOTE_CONFIG;
  }

  const candidate = value as Partial<AppRemoteConfig>;

  return {
    adsPolicy: sanitizeAdsPolicy(candidate.adsPolicy),
  };
}

export function getAppRemoteConfigState() {
  return appRemoteConfigState;
}

export function getAppAdsPolicy() {
  return appRemoteConfigState.adsPolicy;
}

export function setAppRemoteConfigState(nextValue: AppRemoteConfig) {
  appRemoteConfigState = sanitizeAppRemoteConfig(nextValue);
  appRemoteConfigListeners.forEach(listener => {
    listener();
  });
}

export function subscribeToAppRemoteConfigState(listener: () => void) {
  appRemoteConfigListeners.add(listener);

  return () => {
    appRemoteConfigListeners.delete(listener);
  };
}
