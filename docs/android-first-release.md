# Android First Release

This app is configured to ship on Google Play with the Android application ID `com.laglingo.app`.

## 0. Use JDK 17 for Android builds

React Native/Android Gradle should be run with Java 17. On macOS, one way to do that is:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

The repo intentionally does not hardcode a machine-specific `org.gradle.java.home` path.

## 1. Create an upload keystore

Run this from the project root:

```sh
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/upload-keystore.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep the generated `.jks` file and both passwords somewhere safe. Google Play App Signing should stay enabled, and this key becomes your upload key.

## 2. Configure signing for local release builds

Create `android/keystore.properties` from the example file:

```sh
cp android/keystore.properties.example android/keystore.properties
```

Then fill in:

- `storeFile`: usually `upload-keystore.jks`
- `storePassword`
- `keyAlias`
- `keyPassword`

You can also skip the file and use these environment variables instead:

- `ANDROID_UPLOAD_STORE_FILE`
- `ANDROID_UPLOAD_STORE_PASSWORD`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`

## 3. Build the Play upload bundle

From the project root:

```sh
cd android
./gradlew clean bundleRelease
```

The uploadable bundle will be created at:

`android/app/build/outputs/bundle/release/app-release.aab`

## 4. Versioning

The Android release build reads these optional Gradle properties:

- `LAGLINGO_VERSION_CODE`
- `LAGLINGO_VERSION_NAME`

Example:

```sh
cd android
./gradlew bundleRelease -PLAGLINGO_VERSION_CODE=15 -PLAGLINGO_VERSION_NAME=1.0.1
```

`versionCode` must increase for every Play upload.

## 5. Play Console checklist

Before submitting the first production build, make sure these are ready in Play Console:

- App name, short description, and full description
- 512x512 app icon
- Feature graphic
- Phone screenshots
- Privacy policy URL
- Data safety form
- App access / content rating / ads declarations
- A test track upload before production

The repo already includes a privacy policy page in [docs/privacy.html](/Users/mohamad/Desktop/My Projects/Gamingo/docs/privacy.html).
