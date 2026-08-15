import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as StoreReview from 'react-native-store-review';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { getItemWithMigration, STORAGE_KEYS } from '../../storage/asyncStorageKeys';

const REVIEW_RETRY_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_REVIEW_ATTEMPTS = 3;
const PRACTICE_SUCCESSES_BEFORE_PROMPT = 5;
const FAVORITE_SAVE_SUPPORT_CAP = 2;
const MIN_PRACTICE_SUCCESSES_BEFORE_PROMPT = 3;

export type ReviewMilestone =
  | 'favorite-save'
  | 'practice-success'
  | 'random-practice-complete';

type PersistedReviewState = {
  attemptCount?: number;
  favoriteSaveCount?: number;
  lastAttemptedAtMs?: number;
  positiveSignalCount?: number;
  practiceSuccessCount?: number;
  randomPracticeCompletionCount?: number;
};

type ReviewState = {
  attemptCount: number;
  favoriteSaveCount: number;
  lastAttemptedAtMs: number | null;
  practiceSuccessCount: number;
  randomPracticeCompletionCount: number;
};

let reviewState: ReviewState = {
  attemptCount: 0,
  favoriteSaveCount: 0,
  lastAttemptedAtMs: null,
  practiceSuccessCount: 0,
  randomPracticeCompletionCount: 0,
};
let hydrationPromise: Promise<void> | null = null;
let persistPromise: Promise<void> = Promise.resolve();
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
    const storedValue = await getItemWithMigration('reviewState');

    if (!storedValue) {
      return;
    }

    const parsedValue: PersistedReviewState = JSON.parse(storedValue);
    const migratedPracticeSuccessCount =
      parsedValue.practiceSuccessCount ?? parsedValue.positiveSignalCount;

    reviewState = {
      attemptCount: sanitizeCount(parsedValue.attemptCount),
      favoriteSaveCount: sanitizeCount(parsedValue.favoriteSaveCount),
      lastAttemptedAtMs: sanitizeTimestamp(parsedValue.lastAttemptedAtMs),
      practiceSuccessCount: sanitizeCount(migratedPracticeSuccessCount),
      randomPracticeCompletionCount: sanitizeCount(
        parsedValue.randomPracticeCompletionCount,
      ),
    };
  } catch (error) {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'hydrate_failed',
    }).catch(() => undefined);
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
    favoriteSaveCount: reviewState.favoriteSaveCount,
    lastAttemptedAtMs: reviewState.lastAttemptedAtMs ?? undefined,
    practiceSuccessCount: reviewState.practiceSuccessCount,
    randomPracticeCompletionCount: reviewState.randomPracticeCompletionCount,
  };

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(STORAGE_KEYS.reviewState, JSON.stringify(snapshot)),
    )
    .catch(error => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
        ...getErrorAnalyticsParams(error),
        [ANALYTICS_PARAMS.RESULT]: 'persist_failed',
      }).catch(() => undefined);
      console.warn('Failed to persist review prompt state.', error);
    });

  return persistPromise;
}

function getPracticeSuccessRequirement() {
  const favoriteSaveSupport = Math.min(
    reviewState.favoriteSaveCount,
    FAVORITE_SAVE_SUPPORT_CAP,
  );

  return Math.max(
    MIN_PRACTICE_SUCCESSES_BEFORE_PROMPT,
    PRACTICE_SUCCESSES_BEFORE_PROMPT - favoriteSaveSupport,
  );
}

function hasEarnedReviewOpportunity() {
  if (reviewState.randomPracticeCompletionCount > 0) {
    return true;
  }

  return reviewState.practiceSuccessCount >= getPracticeSuccessRequirement();
}

function canRequestReview(now: number) {
  if (
    requestInFlight ||
    (AppState.currentState && AppState.currentState !== 'active') ||
    reviewState.attemptCount >= MAX_REVIEW_ATTEMPTS
  ) {
    return false;
  }

  if (!hasEarnedReviewOpportunity()) {
    return false;
  }

  if (
    reviewState.attemptCount > 0 &&
    reviewState.lastAttemptedAtMs &&
    now - reviewState.lastAttemptedAtMs < REVIEW_RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  return true;
}

function applyReviewMilestone(milestone: ReviewMilestone) {
  switch (milestone) {
    case 'favorite-save':
      reviewState.favoriteSaveCount += 1;
      break;
    case 'practice-success':
      reviewState.practiceSuccessCount += 1;
      break;
    case 'random-practice-complete':
      reviewState.randomPracticeCompletionCount += 1;
      break;
  }
}

async function requestNativeReview(now: number) {
  if (!canRequestReview(now)) {
    return false;
  }

  requestInFlight = true;
  trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
    [ANALYTICS_PARAMS.RESULT]: 'requested',
    [ANALYTICS_PARAMS.TOTAL_COUNT]: reviewState.attemptCount + 1,
  }).catch(() => undefined);

  try {
    StoreReview.requestReview();
    reviewState.attemptCount += 1;
    reviewState.favoriteSaveCount = 0;
    reviewState.lastAttemptedAtMs = now;
    reviewState.practiceSuccessCount = 0;
    reviewState.randomPracticeCompletionCount = 0;
    await queueReviewStatePersist();
    trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
      [ANALYTICS_PARAMS.RESULT]: 'request_succeeded',
      [ANALYTICS_PARAMS.TOTAL_COUNT]: reviewState.attemptCount,
    }).catch(() => undefined);
    return true;
  } catch (error) {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'request_failed',
      [ANALYTICS_PARAMS.TOTAL_COUNT]: reviewState.attemptCount,
    }).catch(() => undefined);
    console.warn('Failed to request native app review.', error);
    return false;
  } finally {
    requestInFlight = false;
  }
}

async function maybeRequestReview(milestone: ReviewMilestone) {
  await ensureReviewStateHydrated();
  applyReviewMilestone(milestone);
  trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_MILESTONE, {
    [ANALYTICS_PARAMS.METHOD]: milestone,
    [ANALYTICS_PARAMS.RESULT]: hasEarnedReviewOpportunity()
      ? 'eligible_signal'
      : 'signal_recorded',
    [ANALYTICS_PARAMS.SUCCESSFUL_COUNT]: reviewState.practiceSuccessCount,
    [ANALYTICS_PARAMS.TOTAL_COUNT]: reviewState.attemptCount,
  }).catch(() => undefined);

  const now = Date.now();

  if (!canRequestReview(now)) {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REVIEW_PROMPT_RESULT, {
      [ANALYTICS_PARAMS.METHOD]: milestone,
      [ANALYTICS_PARAMS.REASON]: requestInFlight
        ? 'request_in_flight'
        : reviewState.attemptCount >= MAX_REVIEW_ATTEMPTS
          ? 'max_attempts'
          : AppState.currentState && AppState.currentState !== 'active'
            ? 'app_not_active'
            : !hasEarnedReviewOpportunity()
              ? 'not_enough_signals'
              : 'cooldown',
      [ANALYTICS_PARAMS.RESULT]: 'not_requested',
      [ANALYTICS_PARAMS.TOTAL_COUNT]: reviewState.attemptCount,
    }).catch(() => undefined);
    await queueReviewStatePersist();
    return false;
  }

  return requestNativeReview(now);
}

export function trackReviewMilestone(milestone: ReviewMilestone) {
  maybeRequestReview(milestone).catch(() => undefined);
}

export function initializeAppReviewState() {
  return ensureReviewStateHydrated();
}
