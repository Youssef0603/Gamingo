const fs = require('fs');
const path = require('path');

function patchFile(filePath, transform, successMessage, skipMessage) {
  if (!fs.existsSync(filePath)) {
    console.log(`[postinstall] Missing ${path.basename(filePath)}, skipping.`);
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const patched = transform(original);

  if (patched === original) {
    console.log(`[postinstall] ${skipMessage}`);
    return;
  }

  fs.writeFileSync(filePath, patched);
  console.log(`[postinstall] ${successMessage}`);
}

// On Android, Appodeal.getBannerView() always returns the same process-wide
// shared BannerView instance (there is no way to create independent inline
// banner ad slots like iOS's APDBannerView). When React Native remounts an
// inline <AppodealBanner/> (e.g. list virtualization while scrolling, or
// switching between category tabs), the SDK's ViewAdRenderer treats the ad
// as "already on screen" and skips re-rendering it into the newly mounted
// container, leaving it permanently blank. Forcing Appodeal.hide()
// immediately before Appodeal.show() resets that internal state so the ad
// is correctly redrawn into the current container. Hiding the ad can also
// invalidate the cached creative, so if nothing is loaded afterward we
// explicitly kick off a fresh Appodeal.cache() instead of passively waiting
// on the SDK's own auto-cache timer — otherwise a quick switch back to a
// screen with a banner can find no ad ready yet. iOS is unaffected: it
// creates a fresh, independent ad view per component instance and never
// hits this shared-instance path.
patchFile(
  path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native-appodeal',
    'android',
    'src',
    'main',
    'java',
    'com',
    'appodeal',
    'rnappodeal',
    'RCTAppodealBannerView.kt'
  ),
  content => {
    const pristineShow =
      '            Appodeal.show(activity, Appodeal.BANNER_VIEW, placement)\n';
    const hideOnlyShow =
      '            Appodeal.hide(activity, Appodeal.BANNER_VIEW)\n            Appodeal.show(activity, Appodeal.BANNER_VIEW, placement)\n';
    const fullyPatchedShow =
      '            Appodeal.hide(activity, Appodeal.BANNER_VIEW)\n' +
      '            Appodeal.show(activity, Appodeal.BANNER_VIEW, placement)\n' +
      '\n' +
      '            if (!Appodeal.isLoaded(Appodeal.BANNER_VIEW)) {\n' +
      '                Appodeal.cache(activity, Appodeal.BANNER_VIEW)\n' +
      '            }\n';

    if (content.includes(fullyPatchedShow)) {
      return content;
    }

    if (content.includes(hideOnlyShow)) {
      return content.replace(hideOnlyShow, fullyPatchedShow);
    }

    return content.replace(pristineShow, fullyPatchedShow);
  },
  'Patched react-native-appodeal Android inline banner reattachment.',
  'react-native-appodeal Android inline banner reattachment already patched.'
);
