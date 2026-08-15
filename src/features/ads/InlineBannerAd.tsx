import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { theme } from '../../theme/theme';
import { getBannerAdUnitId, useCanShowAds } from './mobileAds';

function InlineBannerAd() {
  const canShowAds = useCanShowAds();
  const adUnitId = canShowAds ? getBannerAdUnitId() : null;

  useEffect(() => {
    if (!canShowAds) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, {
        [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
        [ANALYTICS_PARAMS.AD_GATE_REASON]: 'not_eligible',
        [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
        [ANALYTICS_PARAMS.AD_RESULT]: 'hidden',
      }).catch(() => undefined);
      return;
    }

    if (!adUnitId) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.AD_GATE_EVALUATED, {
        [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
        [ANALYTICS_PARAMS.AD_GATE_REASON]: 'missing_unit_id',
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
  }, [adUnitId, canShowAds]);

  if (!canShowAds || !adUnitId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        onAdImpression={() => {
          trackAnalyticsEvent(ANALYTICS_EVENTS.AD_IMPRESSION_RECORDED, {
            [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
            [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
            [ANALYTICS_PARAMS.AD_RESULT]: 'impression',
          }).catch(() => undefined);
        }}
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
        onAdOpened={() => {
          trackAnalyticsEvent(ANALYTICS_EVENTS.AD_OPENED, {
            [ANALYTICS_PARAMS.AD_FORMAT]: 'banner',
            [ANALYTICS_PARAMS.AD_PLACEMENT]: 'inline_banner',
            [ANALYTICS_PARAMS.AD_RESULT]: 'opened',
          }).catch(() => undefined);
        }}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        unitId={adUnitId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    minHeight: 60,
  },
});

export default InlineBannerAd;
