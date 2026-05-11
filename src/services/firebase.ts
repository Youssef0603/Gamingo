import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from '@react-native-firebase/app';
import {
  getAnalytics,
  logAppOpen,
  logEvent,
  setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  log,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

const firebaseOptions = Platform.select({
  android: {
    apiKey: 'AIzaSyCA7cWUkEgm22sliDUYxVGo3UnKfpawvDk',
    appId: '1:472785553002:android:e222abfcf94b66b5b82c13',
    databaseURL: 'https://gamingo-d8b24-default-rtdb.firebaseio.com',
    messagingSenderId: '472785553002',
    projectId: 'gamingo-d8b24',
    storageBucket: 'gamingo-d8b24.firebasestorage.app',
  },
  ios: {
    apiKey: 'AIzaSyCblZpu1ncPuimBB-_cZ-Z8wVI2ToMB9OY',
    appId: '1:472785553002:ios:358280003144c6a8b82c13',
    databaseURL: 'https://gamingo-d8b24-default-rtdb.firebaseio.com',
    messagingSenderId: '472785553002',
    projectId: 'gamingo-d8b24',
    storageBucket: 'gamingo-d8b24.firebasestorage.app',
  },
});

let firebaseReadyPromise: Promise<void> | undefined;

async function ensureFirebaseReady() {
  if (!firebaseReadyPromise) {
    firebaseReadyPromise = (async () => {
      if (getApps().length === 0 && firebaseOptions) {
        await initializeApp(firebaseOptions);
      } else {
        getApp();
      }
    })();
  }

  return firebaseReadyPromise;
}

export function initializeFirebaseServices() {
  return ensureFirebaseReady().then(() => {
    const analytics = getAnalytics();
    const crashlytics = getCrashlytics();

    setAnalyticsCollectionEnabled(analytics, true).catch(() => undefined);
    setCrashlyticsCollectionEnabled(crashlytics, true).catch(() => undefined);
    log(crashlytics, 'Firebase services initialized');
    logAppOpen(analytics).catch(() => undefined);
  });
}

export async function logScreenView(screenName: string) {
  await ensureFirebaseReady();

  return logEvent(getAnalytics(), 'screen_view', {
    screen_class: screenName,
    screen_name: screenName,
  });
}
