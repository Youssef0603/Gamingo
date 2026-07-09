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
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
  },
}));
jest.mock('react-native-store-review', () => ({
  requestReview: jest.fn(),
}));

const REVIEW_STATE_STORAGE_KEY = 'reviewState';
const LEGACY_REVIEW_STATE_STORAGE_KEY = 'com.gamingo.app.review-state';
const REVIEW_RETRY_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

async function flushPromises() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe('appReview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
    jest.resetModules();
    mockStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('migrates the legacy review storage key to the new namespace', async () => {
    mockStorage.set(
      LEGACY_REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        attemptCount: 1,
        favoriteSaveCount: 0,
        lastAttemptedAtMs: Date.now() - REVIEW_RETRY_COOLDOWN_MS,
        practiceSuccessCount: 0,
        randomPracticeCompletionCount: 0,
      }),
    );

    const { initializeAppReviewState } = require('../src/features/reviews/appReview');

    await initializeAppReviewState();

    expect(mockStorage.get(REVIEW_STATE_STORAGE_KEY)).toBeTruthy();
    expect(mockStorage.has(LEGACY_REVIEW_STATE_STORAGE_KEY)).toBe(false);
  });

  it('requests a native review after a completed random practice session', async () => {
    const StoreReview = require('react-native-store-review');
    const { trackReviewMilestone } = require('../src/features/reviews/appReview');

    trackReviewMilestone('random-practice-complete');
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('requests a review after enough successful practice reps', async () => {
    const StoreReview = require('react-native-store-review');
    const { trackReviewMilestone } = require('../src/features/reviews/appReview');

    for (let index = 0; index < 4; index += 1) {
      trackReviewMilestone('practice-success');
    }

    await flushPromises();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    trackReviewMilestone('practice-success');
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('lets favorite saves support the practice threshold without triggering alone', async () => {
    const StoreReview = require('react-native-store-review');
    const { trackReviewMilestone } = require('../src/features/reviews/appReview');

    trackReviewMilestone('favorite-save');
    trackReviewMilestone('favorite-save');
    await flushPromises();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    trackReviewMilestone('practice-success');
    trackReviewMilestone('practice-success');
    await flushPromises();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    trackReviewMilestone('practice-success');
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('retries after cooldown and new earned milestones', async () => {
    await mockAsyncStorage.setItem(
      REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        attemptCount: 1,
        lastAttemptedAtMs: Date.now() - REVIEW_RETRY_COOLDOWN_MS,
        practiceSuccessCount: 0,
        randomPracticeCompletionCount: 0,
        favoriteSaveCount: 0,
      }),
    );

    const StoreReview = require('react-native-store-review');
    const { trackReviewMilestone } = require('../src/features/reviews/appReview');

    trackReviewMilestone('random-practice-complete');
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('stops requesting after the max attempt count', async () => {
    await mockAsyncStorage.setItem(
      REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        attemptCount: 3,
        lastAttemptedAtMs: Date.now() - REVIEW_RETRY_COOLDOWN_MS,
        practiceSuccessCount: 5,
        randomPracticeCompletionCount: 0,
        favoriteSaveCount: 0,
      }),
    );

    const StoreReview = require('react-native-store-review');
    const { trackReviewMilestone } = require('../src/features/reviews/appReview');

    trackReviewMilestone('random-practice-complete');
    await flushPromises();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
