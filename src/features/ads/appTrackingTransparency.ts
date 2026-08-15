import { NativeModules, Platform } from 'react-native';

export type AppTrackingTransparencyStatus =
  | 'authorized'
  | 'denied'
  | 'restricted'
  | 'not_determined'
  | 'unavailable'
  | 'unknown';

type NativeAppTrackingTransparencyModule = {
  getTrackingAuthorizationStatus: () => Promise<unknown>;
  requestTrackingAuthorization: () => Promise<unknown>;
};

const validTrackingAuthorizationStatuses = new Set<AppTrackingTransparencyStatus>([
  'authorized',
  'denied',
  'restricted',
  'not_determined',
  'unavailable',
  'unknown',
]);

function getNativeAppTrackingTransparencyModule() {
  const nativeModules = NativeModules as
    | {
        AppTrackingTransparencyModule?: Partial<NativeAppTrackingTransparencyModule>;
      }
    | undefined;

  return nativeModules?.AppTrackingTransparencyModule;
}

function normalizeTrackingAuthorizationStatus(
  status: unknown,
): AppTrackingTransparencyStatus {
  return typeof status === 'string'
    && validTrackingAuthorizationStatuses.has(
      status as AppTrackingTransparencyStatus,
    )
    ? (status as AppTrackingTransparencyStatus)
    : 'unknown';
}

export async function requestAppTrackingTransparencyForAds() {
  if (Platform.OS !== 'ios') {
    return 'unavailable';
  }

  const nativeModule = getNativeAppTrackingTransparencyModule();

  if (
    !nativeModule?.getTrackingAuthorizationStatus
    || !nativeModule.requestTrackingAuthorization
  ) {
    if (__DEV__) {
      console.warn('App Tracking Transparency native module is unavailable.');
    }

    return 'unavailable';
  }

  try {
    const currentStatus = normalizeTrackingAuthorizationStatus(
      await nativeModule.getTrackingAuthorizationStatus(),
    );

    if (currentStatus !== 'not_determined') {
      return currentStatus;
    }

    return normalizeTrackingAuthorizationStatus(
      await nativeModule.requestTrackingAuthorization(),
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('App Tracking Transparency request failed.', error);
    }

    return 'unknown';
  }
}
