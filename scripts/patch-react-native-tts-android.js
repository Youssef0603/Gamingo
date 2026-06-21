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

patchFile(
  path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native-tts',
    'ios',
    'TextToSpeech',
    'TextToSpeech.m'
  ),
  content =>
    content
      .replace(
        'RCT_EXPORT_METHOD(stop:(BOOL *)onWordBoundary resolve:(RCTPromiseResolveBlock)resolve reject:(__unused RCTPromiseRejectBlock)reject)',
        'RCT_EXPORT_METHOD(stop:(BOOL)onWordBoundary resolve:(RCTPromiseResolveBlock)resolve reject:(__unused RCTPromiseRejectBlock)reject)'
      )
      .replace(
        'RCT_EXPORT_METHOD(pause:(BOOL *)onWordBoundary resolve:(RCTPromiseResolveBlock)resolve reject:(__unused RCTPromiseRejectBlock)reject)',
        'RCT_EXPORT_METHOD(pause:(BOOL)onWordBoundary resolve:(RCTPromiseResolveBlock)resolve reject:(__unused RCTPromiseRejectBlock)reject)'
      )
      .replaceAll(
        'if(onWordBoundary != NULL && onWordBoundary) {',
        'if(onWordBoundary) {'
      )
      .replace(
        'RCT_EXPORT_METHOD(setDucking:(BOOL *)ducking',
        'RCT_EXPORT_METHOD(setDucking:(BOOL)ducking'
      )
      .replace(
        'skipTransform:(BOOL *)skipTransform // not used, compatibility with Android native module signature',
        'skipTransform:(BOOL)skipTransform // not used, compatibility with Android native module signature'
      ),
  'Patched react-native-tts iOS bridge boolean signatures.',
  'react-native-tts iOS bridge boolean signatures already patched.'
);

patchFile(
  path.join(
    __dirname,
    '..',
    'node_modules',
    'react-native-tts',
    'android',
    'build.gradle'
  ),
  content => {
    let patched = content.replace(/buildscript\s*\{[\s\S]*?\n\}\n\n/, '');

    if (
      patched.includes('android {') &&
      !patched.includes('namespace "net.no_mad.tts"') &&
      !patched.includes("namespace 'net.no_mad.tts'")
    ) {
      patched = patched.replace(
        'android {\n',
        'android {\n    namespace "net.no_mad.tts"\n'
      );
    }

    return patched;
  },
  'Patched react-native-tts Android Gradle file.',
  'react-native-tts Android Gradle file already patched.'
);

patchFile(
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-modules-core',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'kotlin',
    'Promise.kt'
  ),
  content =>
    content
      .replace('override fun reject(code: String, message: String?) {', 'override fun reject(code: String?, message: String?) {')
      .replace('override fun reject(code: String, throwable: Throwable?) {', 'override fun reject(code: String?, throwable: Throwable?) {')
      .replace(
        'override fun reject(code: String, message: String?, throwable: Throwable?) {',
        'override fun reject(code: String?, message: String?, throwable: Throwable?) {'
      )
      .replace('override fun reject(code: String, userInfo: WritableMap) {', 'override fun reject(code: String?, userInfo: WritableMap) {')
      .replace(
        'override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {',
        'override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {'
      )
      .replace(
        'override fun reject(code: String, message: String?, userInfo: WritableMap) {',
        'override fun reject(code: String?, message: String?, userInfo: WritableMap) {'
      )
      .replace('expoPromise.reject(code, message, null)', 'expoPromise.reject(code ?: unknownCode, message, null)')
      .replace('expoPromise.reject(code, null, throwable)', 'expoPromise.reject(code ?: unknownCode, null, throwable)')
      .replace('expoPromise.reject(code, message, throwable)', 'expoPromise.reject(code ?: unknownCode, message, throwable)')
      .replace('expoPromise.reject(code, null, null)', 'expoPromise.reject(code ?: unknownCode, null, null)'),
  'Patched expo-modules-core Promise bridge for React Native 0.85.',
  'expo-modules-core Promise bridge already patched.'
);

patchFile(
  path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-modules-core',
    'android',
    'build.gradle'
  ),
  content =>
    content.replace(
      `        def tokenizer = new org.apache.commons.text.StringTokenizer(commandObj.command, " ")
        def tokens = tokenizer.tokenList

        def workingDirFile = new File(commandObj.directory)

        providers.exec {
          workingDir(providers.provider { workingDirFile }.get())
          commandLine(tokens)
        }.getResult().get().assertNormalExitValue()`,
      `        def workingDirFile = new File(commandObj.directory)

        providers.exec {
          workingDir(providers.provider { workingDirFile }.get())
          commandLine("bash", "-lc", commandObj.command)
        }.getResult().get().assertNormalExitValue()`
    ),
  'Patched expo-modules-core generatePCH command handling for paths with spaces.',
  'expo-modules-core generatePCH command handling already patched.'
);
