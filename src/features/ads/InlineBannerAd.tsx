import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppodealBanner } from 'react-native-appodeal';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { theme } from '../../theme/theme';
import { getBannerAdsGateReason, useCanShowAds } from './mobileAds';

// Appodeal's Android SDK fails to (re)display its single shared banner slot
// when the native view is created in the same pass as a surrounding layout
// change (e.g. switching between category lists) — confirmed by Appodeal
// maintainers as the fix for "banner doesn't show after switching screens":
// https://github.com/appodeal/react-native-appodeal/issues/87. Mounting the
// native banner view slightly after this component itself mounts, once the
// surrounding list has settled, avoids that race. iOS isn't affected but the
// delay is harmless there too.
const BANNER_MOUNT_SETTLE_DELAY_MS = 300;

function InlineBannerAd() {
  const canShowAds = useCanShowAds();
  const bannerGateReason = getBannerAdsGateReason();
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    setIsSettled(false);
    const timeoutId = setTimeout(() => {
      setIsSettled(true);
    }, BANNER_MOUNT_SETTLE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!canShowAds) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, {
        [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
        [ANALYTICS_PARAMS.AD_GATE_REASON]:
          bannerGateReason ?? 'not_eligible',
        [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
        [ANALYTICS_PARAMS.AD_RESULT]: 'hidden',
      }).catch(() => undefined);
      return;
    }

    trackAnalyticsEvent(ANALYTICS_EVENTS.AD_LOAD_STARTED, {
      [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
      [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
      [ANALYTICS_PARAMS.AD_RESULT]: 'loading',
    }).catch(() => undefined);
  }, [bannerGateReason, canShowAds]);

  if (!canShowAds) {
    return null;
  }

  return (
    <View style={styles.container}>
      {isSettled ? (
        <AppodealBanner
          adSize="phone"
          onAdFailedToLoad={error => {
            trackAnalyticsEvent(ANALYTICS_EVENTS.AD_FAILED, {
              ...getErrorAnalyticsParams(error),
              [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
              [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
              [ANALYTICS_PARAMS.AD_RESULT]: 'failed',
            }).catch(() => undefined);

            if (__DEV__) {
              console.warn('Banner ad failed to load', error);
            }
          }}
          onAdLoaded={() => {
            trackAnalyticsEvent(ANALYTICS_EVENTS.AD_LOADED, {
              [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
              [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
              [ANALYTICS_PARAMS.AD_RESULT]: 'loaded',
            }).catch(() => undefined);
          }}
          onAdClicked={() => {
            trackAnalyticsEvent(ANALYTICS_EVENTS.AD_OPENED, {
              [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
              [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
              [ANALYTICS_PARAMS.AD_RESULT]: 'opened',
            }).catch(() => undefined);
          }}
          onAdExpired={() => {
            trackAnalyticsEvent(ANALYTICS_EVENTS.AD_SKIPPED, {
              [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
              [ANALYTICS_PARAMS.AD_GATE_REASON]: 'expired',
              [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
              [ANALYTICS_PARAMS.AD_RESULT]: 'skipped',
            }).catch(() => undefined);
          }}
          placement="inline_banner"
          style={styles.banner}
          usesSmartSizing
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    minHeight: 60,
  },
  banner: {
    alignSelf: 'stretch',
    width: '100%',
  },
});

export default InlineBannerAd;
