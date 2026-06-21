const mockStorage = new Map<string, string>();
const mockAsyncStorage = {
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockStorage.get(key) ?? null),
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
  },
}));
jest.mock('react-native-store-review', () => ({
  requestReview: jest.fn(),
}));

const REVIEW_STATE_STORAGE_KEY = 'playcall.review-state';
const INITIAL_REVIEW_PROMPT_DELAY_MS = 3500;
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

  it('requests a native review after the first app open delay', async () => {
    const StoreReview = require('react-native-store-review');
    const {
      scheduleFirstOpenReviewPrompt,
    } = require('../src/features/reviews/appReview');

    scheduleFirstOpenReviewPrompt();

    await jest.advanceTimersByTimeAsync(INITIAL_REVIEW_PROMPT_DELAY_MS - 1);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('retries after enough positive signals and cooldown time', async () => {
    await mockAsyncStorage.setItem(
      REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        attemptCount: 1,
        hasHandledFirstOpen: true,
        lastAttemptedAtMs: Date.now() - REVIEW_RETRY_COOLDOWN_MS,
        positiveSignalCount: 0,
      }),
    );

    const StoreReview = require('react-native-store-review');
    const { trackPositiveReviewSignal } = require('../src/features/reviews/appReview');

    trackPositiveReviewSignal();
    trackPositiveReviewSignal();
    await flushPromises();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    trackPositiveReviewSignal();
    await flushPromises();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('stops requesting after the max attempt count', async () => {
    await mockAsyncStorage.setItem(
      REVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        attemptCount: 3,
        hasHandledFirstOpen: true,
        lastAttemptedAtMs: Date.now() - REVIEW_RETRY_COOLDOWN_MS,
        positiveSignalCount: 3,
      }),
    );

    const StoreReview = require('react-native-store-review');
    const { trackPositiveReviewSignal } = require('../src/features/reviews/appReview');

    trackPositiveReviewSignal();
    await flushPromises();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
