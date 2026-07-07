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

function replaceImport(content, fromImport, toImport) {
  return content.includes(fromImport)
    ? content.replace(fromImport, toImport)
    : content;
}

function replaceAnyImport(content, candidates, toImport) {
  for (const candidate of candidates) {
    if (content.includes(candidate)) {
      return content.replace(candidate, toImport);
    }
  }

  return content;
}

const projectRoot = path.join(__dirname, '..');

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'analytics',
    'ios',
    'RNFBAnalytics',
    'RNFBAnalyticsModule.m',
  ),
  content =>
    replaceAnyImport(
      content,
      ['#import <Firebase/Firebase.h>'],
      '@import FirebaseAnalytics;',
    ),
  'Patched RNFBAnalyticsModule.m to use direct Firebase imports.',
  'RNFBAnalyticsModule.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'app',
    'ios',
    'RNFBApp',
    'RNFBAppModule.m',
  ),
  content =>
    replaceAnyImport(
      content,
      ['#import <Firebase/Firebase.h>'],
      '@import FirebaseCore;',
    ),
  'Patched RNFBAppModule.m to use direct Firebase imports.',
  'RNFBAppModule.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'storage',
    'ios',
    'RNFBStorage',
    'RNFBStorageCommon.m',
  ),
  content =>
    replaceAnyImport(
      content,
      [
        '#import <Firebase/Firebase.h>',
        '#import <FirebaseCore/FirebaseCore.h>\n#import <FirebaseStorage/FirebaseStorage.h>',
      ],
      '@import FirebaseCore;\n@import FirebaseStorage;',
    ),
  'Patched RNFBStorageCommon.m to use direct Firebase imports.',
  'RNFBStorageCommon.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'storage',
    'ios',
    'RNFBStorage',
    'RNFBStorageModule.m',
  ),
  content =>
    replaceAnyImport(
      content,
      [
        '#import <Firebase/Firebase.h>',
        '#import <FirebaseCore/FirebaseCore.h>\n#import <FirebaseStorage/FirebaseStorage.h>',
      ],
      '@import FirebaseCore;\n@import FirebaseStorage;',
    ),
  'Patched RNFBStorageModule.m to use direct Firebase imports.',
  'RNFBStorageModule.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'crashlytics',
    'ios',
    'RNFBCrashlytics',
    'RNFBCrashlyticsModule.m',
  ),
  content =>
    replaceAnyImport(
      content,
      [
        '#import <Firebase/Firebase.h>',
        '#import <FirebaseCrashlytics/FirebaseCrashlytics.h>',
      ],
      '@import FirebaseCrashlytics;',
    ),
  'Patched RNFBCrashlyticsModule.m to use direct Firebase imports.',
  'RNFBCrashlyticsModule.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'crashlytics',
    'ios',
    'RNFBCrashlytics',
    'RNFBCrashlyticsNativeHelper.m',
  ),
  content =>
    replaceAnyImport(
      content,
      [
        '#import <Firebase/Firebase.h>',
        '#import <FirebaseCrashlytics/FirebaseCrashlytics.h>',
      ],
      '@import FirebaseCrashlytics;',
    ),
  'Patched RNFBCrashlyticsNativeHelper.m to use direct Firebase imports.',
  'RNFBCrashlyticsNativeHelper.m direct Firebase imports already patched.',
);

patchFile(
  path.join(
    projectRoot,
    'node_modules',
    '@react-native-firebase',
    'crashlytics',
    'ios',
    'RNFBCrashlytics',
    'RNFBCrashlyticsInitProvider.m',
  ),
  content =>
    replaceImport(
      content,
      '#import <Firebase/Firebase.h>\n',
      '',
    ),
  'Removed umbrella Firebase import from RNFBCrashlyticsInitProvider.m.',
  'RNFBCrashlyticsInitProvider.m umbrella Firebase import already removed.',
);
