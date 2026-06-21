import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as StoreReview from 'react-native-store-review';

const REVIEW_STATE_STORAGE_KEY = 'playcall.review-state';
const INITIAL_REVIEW_PROMPT_DELAY_MS = 3500;
const REVIEW_RETRY_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const POSITIVE_SIGNALS_BEFORE_RETRY = 3;
const MAX_REVIEW_ATTEMPTS = 3;

type ReviewPromptReason = 'first-open' | 'positive-signal';

type PersistedReviewState = {
  attemptCount?: number;
  hasHandledFirstOpen?: boolean;
  lastAttemptedAtMs?: number;
  positiveSignalCount?: number;
};

type ReviewState = {
  attemptCount: number;
  hasHandledFirstOpen: boolean;
  lastAttemptedAtMs: number | null;
  positiveSignalCount: number;
};

let reviewState: ReviewState = {
  attemptCount: 0,
  hasHandledFirstOpen: false,
  lastAttemptedAtMs: null,
  positiveSignalCount: 0,
};
let hydrationPromise: Promise<void> | null = null;
let persistPromise: Promise<void> = Promise.resolve();
let firstOpenTimeout: ReturnType<typeof setTimeout> | null = null;
let requestInFlight = false;

function sanitizeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function sanitizeTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

async function hydrateReviewState() {
  try {
    const storedValue = await AsyncStorage.getItem(REVIEW_STATE_STORAGE_KEY);

    if (!storedValue) {
      return;
    }

    const parsedValue: PersistedReviewState = JSON.parse(storedValue);

    reviewState = {
      attemptCount: sanitizeCount(parsedValue.attemptCount),
      hasHandledFirstOpen: Boolean(parsedValue.hasHandledFirstOpen),
      lastAttemptedAtMs: sanitizeTimestamp(parsedValue.lastAttemptedAtMs),
      positiveSignalCount: sanitizeCount(parsedValue.positiveSignalCount),
    };
  } catch (error) {
    console.warn('Failed to hydrate review prompt state.', error);
  }
}

function ensureReviewStateHydrated() {
  if (!hydrationPromise) {
    hydrationPromise = hydrateReviewState();
  }

  return hydrationPromise;
}

function queueReviewStatePersist() {
  const snapshot: PersistedReviewState = {
    attemptCount: reviewState.attemptCount,
    hasHandledFirstOpen: reviewState.hasHandledFirstOpen,
    lastAttemptedAtMs: reviewState.lastAttemptedAtMs ?? undefined,
    positiveSignalCount: reviewState.positiveSignalCount,
  };

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify(snapshot)),
    )
    .catch(error => {
      console.warn('Failed to persist review prompt state.', error);
    });

  return persistPromise;
}

function canRetryAfterPositiveSignal(now: number) {
  if (reviewState.attemptCount === 0) {
    return false;
  }

  if (reviewState.positiveSignalCount < POSITIVE_SIGNALS_BEFORE_RETRY) {
    return false;
  }

  if (!reviewState.lastAttemptedAtMs) {
    return true;
  }

  return now - reviewState.lastAttemptedAtMs >= REVIEW_RETRY_COOLDOWN_MS;
}

async function requestNativeReview(now: number) {
  if (
    requestInFlight ||
    (AppState.currentState && AppState.currentState !== 'active') ||
    reviewState.attemptCount >= MAX_REVIEW_ATTEMPTS
  ) {
    return false;
  }

  requestInFlight = true;

  try {
    StoreReview.requestReview();
    reviewState.attemptCount += 1;
    reviewState.lastAttemptedAtMs = now;
    reviewState.positiveSignalCount = 0;
    await queueReviewStatePersist();
    return true;
  } catch (error) {
    console.warn('Failed to request native app review.', error);
    return false;
  } finally {
    requestInFlight = false;
  }
}

async function maybeRequestReview(reason: ReviewPromptReason) {
  await ensureReviewStateHydrated();

  const now = Date.now();

  if (reason === 'first-open') {
    if (reviewState.hasHandledFirstOpen) {
      return false;
    }

    reviewState.hasHandledFirstOpen = true;
    await queueReviewStatePersist();
    return requestNativeReview(now);
  }

  reviewState.positiveSignalCount += 1;

  if (!canRetryAfterPositiveSignal(now)) {
    await queueReviewStatePersist();
    return false;
  }

  return requestNativeReview(now);
}

export function scheduleFirstOpenReviewPrompt() {
  if (firstOpenTimeout) {
    return;
  }

  firstOpenTimeout = setTimeout(() => {
    firstOpenTimeout = null;
    maybeRequestReview('first-open').catch(() => undefined);
  }, INITIAL_REVIEW_PROMPT_DELAY_MS);
}

export function trackPositiveReviewSignal() {
  maybeRequestReview('positive-signal').catch(() => undefined);
}
