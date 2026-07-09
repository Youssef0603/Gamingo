export {};

const mockStorage = new Map<string, string>();
const mockAsyncStorage = {
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockStorage.get(key) ?? null),
  ),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));

describe('asyncStorageKeys', () => {
  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
  });

  it('migrates a legacy key to the canonical namespace', async () => {
    mockStorage.set('playcall.app-state', '{"selectedLanguage":"en"}');

    const {
      STORAGE_KEYS,
      getItemWithMigration,
    } = require('../src/storage/asyncStorageKeys');

    await expect(getItemWithMigration('appState')).resolves.toBe(
      '{"selectedLanguage":"en"}',
    );
    expect(mockStorage.get(STORAGE_KEYS.appState)).toBe(
      '{"selectedLanguage":"en"}',
    );
    expect(mockStorage.has('playcall.app-state')).toBe(false);
  });

  it('prefers the canonical key when it already exists', async () => {
    mockStorage.set('appState', '{"selectedLanguage":"ru"}');
    mockStorage.set('playcall.app-state', '{"selectedLanguage":"en"}');

    const {
      getItemWithMigration,
    } = require('../src/storage/asyncStorageKeys');

    await expect(getItemWithMigration('appState')).resolves.toBe(
      '{"selectedLanguage":"ru"}',
    );
    expect(mockStorage.has('playcall.app-state')).toBe(false);
  });
});
