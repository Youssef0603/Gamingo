import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { theme } from '../../theme/theme';
import { getBannerAdUnitId, useCanShowAds } from './mobileAds';

function InlineBannerAd() {
  const canShowAds = useCanShowAds();

  if (!canShowAds) {
    return null;
  }

  const adUnitId = getBannerAdUnitId();

  if (!adUnitId) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        onAdFailedToLoad={error => {
          if (__DEV__) {
            console.warn('Banner ad failed to load', error);
          }
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
