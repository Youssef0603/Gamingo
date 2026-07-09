import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  adsState: 'adsState',
  appState: 'appState',
  reviewState: 'reviewState',
} as const;

const LEGACY_STORAGE_KEYS = {
  adsState: ['com.gamingo.app.ads-state', 'gamingo.ads-state'],
  appState: ['com.gamingo.app.app-state', 'playcall.app-state'],
  reviewState: ['com.gamingo.app.review-state', 'playcall.review-state'],
} as const satisfies Record<keyof typeof STORAGE_KEYS, readonly string[]>;

type StorageKeyName = keyof typeof STORAGE_KEYS;

async function removeLegacyStorageKeys(keys: readonly string[]) {
  await Promise.all(
    keys.map(key =>
      AsyncStorage.removeItem(key).catch(() => undefined),
    ),
  );
}

export async function getItemWithMigration(keyName: StorageKeyName) {
  const currentKey = STORAGE_KEYS[keyName];
  const legacyKeys = LEGACY_STORAGE_KEYS[keyName];
  const currentValue = await AsyncStorage.getItem(currentKey);

  if (currentValue !== null) {
    await removeLegacyStorageKeys(legacyKeys);
    return currentValue;
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = await AsyncStorage.getItem(legacyKey);

    if (legacyValue === null) {
      continue;
    }

    try {
      await AsyncStorage.setItem(currentKey, legacyValue);
      await removeLegacyStorageKeys(legacyKeys);
    } catch (error) {
      console.warn(`Failed to migrate storage key "${legacyKey}".`, error);
    }

    return legacyValue;
  }

  return null;
}
