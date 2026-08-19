import React, { useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { AppodealBanner } from 'react-native-appodeal';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { theme } from '../../theme/theme';
import { getBannerAdsGateReason, useCanShowAds } from './mobileAds';

function IOSInlineBannerAd() {
  const canShowAds = useCanShowAds();
  const bannerGateReason = getBannerAdsGateReason();

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
    </View>
  );
}

function InlineBannerAd() {
  if (Platform.OS === 'android') {
    return null;
  }

  return <IOSInlineBannerAd />;
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
