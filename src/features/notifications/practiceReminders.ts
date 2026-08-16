import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { getItemWithMigration, STORAGE_KEYS } from '../../storage/asyncStorageKeys';

import type { EventSubscription } from 'expo-modules-core';
import type {
  Notification,
  NotificationPermissionsStatus,
  NotificationResponse,
} from 'expo-notifications';

export type PracticeReminderMilestone =
  | 'favorite-save'
  | 'practice-success'
  | 'random-practice-complete';

type PracticeReminderOptInStatus =
  | 'accepted'
  | 'blocked'
  | 'deferred'
  | 'not_asked'
  | 'permission_denied';

type PracticeReminderPermissionStatus =
  | 'blocked'
  | 'denied'
  | 'granted'
  | 'provisional'
  | 'undetermined'
  | 'unknown';

type PracticeReminderScheduleStatus =
  | 'failed'
  | 'not_scheduled'
  | 'scheduled';

export type PracticeReminderCopyVariant = {
  body: string;
  id: string;
  title: string;
};

type ScheduledPracticeReminder = {
  copyId: string;
  id: string;
  triggerAtMs: number;
};

type PersistedPracticeReminderState = Partial<{
  anchorTriggerAtMs: number;
  favoriteSaveCount: number;
  lastDecisionAtMs: number;
  lastPromptedAtMs: number;
  lastScheduledAtMs: number;
  optInStatus: PracticeReminderOptInStatus;
  permissionCanAskAgain: boolean;
  permissionStatus: PracticeReminderPermissionStatus;
  practiceSuccessCount: number;
  promptShownCount: number;
  randomPracticeCompletionCount: number;
  scheduleStatus: PracticeReminderScheduleStatus;
  scheduledReminders: ScheduledPracticeReminder[];
}>;

export type PracticeReminderSnapshot = Required<
  Omit<
    PersistedPracticeReminderState,
    | 'anchorTriggerAtMs'
    | 'lastDecisionAtMs'
    | 'lastPromptedAtMs'
    | 'lastScheduledAtMs'
    | 'permissionCanAskAgain'
  >
> & {
  anchorTriggerAtMs: number | null;
  isHydrated: boolean;
  lastDecisionAtMs: number | null;
  lastPromptedAtMs: number | null;
  lastScheduledAtMs: number | null;
  nextTriggerAtMs: number | null;
  permissionCanAskAgain: boolean | null;
};

type ReminderNotificationData = {
  copyId: string;
  debug?: boolean;
  scheduledAtMs: number;
  source?: string;
  triggerAtMs: number;
  type: typeof PRACTICE_REMINDER_NOTIFICATION_TYPE;
};

type PromptEligibility = {
  earnedMilestone: PracticeReminderMilestone | null;
  eligible: boolean;
  reason: string;
};

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const PRACTICE_REMINDER_CHANNEL_ID = 'practice-reminders';
export const PRACTICE_REMINDER_COPY_VARIANTS: PracticeReminderCopyVariant[] = [
  {
    body: 'Keep your callouts sharp with a quick Laglingo round.',
    id: 'practice_5_phrases',
    title: 'Practice 5 game phrases',
  },
  {
    body: 'Review a few saved phrases before your next match.',
    id: 'saved_phrases_waiting',
    title: 'Your callouts are waiting',
  },
  {
    body: 'A short rep now helps your next squad comms feel faster.',
    id: 'quick_comms_rep',
    title: 'Time for a quick comms rep',
  },
  {
    body: 'Refresh the words you want ready when the round starts.',
    id: 'round_ready_words',
    title: 'Stay ready for the next round',
  },
  {
    body: 'Open Laglingo and warm up a few useful gaming phrases.',
    id: 'warm_up_phrases',
    title: 'Warm up your game language',
  },
];
export const PRACTICE_REMINDER_INTERVAL_DAYS = 2;
export const PRACTICE_REMINDER_PROMPT_COOLDOWN_MS = 3 * ONE_DAY_MS;
export const PRACTICE_REMINDER_PROMPT_MAX_COUNT = 3;
export const PRACTICE_REMINDER_SCHEDULED_COUNT = 24;
export const PRACTICE_REMINDER_TARGET_HOUR = 19;
export const PRACTICE_REMINDER_TARGET_MINUTE = 30;

const FAVORITE_SAVES_BEFORE_PROMPT = 2;
const MIN_FIRST_TRIGGER_LEAD_MS = 15 * 60 * 1000;
const MIN_PROMPT_SPACING_MS = ONE_DAY_MS;
const PRACTICE_REMINDER_NOTIFICATION_TYPE = 'practice_reminder';
const PRACTICE_REMINDER_REQUEST_PREFIX = 'practice-reminder';

let reminderState: PracticeReminderSnapshot = {
  anchorTriggerAtMs: null,
  favoriteSaveCount: 0,
  isHydrated: false,
  lastDecisionAtMs: null,
  lastPromptedAtMs: null,
  lastScheduledAtMs: null,
  nextTriggerAtMs: null,
  optInStatus: 'not_asked',
  permissionCanAskAgain: null,
  permissionStatus: 'unknown',
  practiceSuccessCount: 0,
  promptShownCount: 0,
  randomPracticeCompletionCount: 0,
  scheduleStatus: 'not_scheduled',
  scheduledReminders: [],
};

let hydrationPromise: Promise<void> | null = null;
let initializationPromise: Promise<void> | null = null;
let notificationResponseSubscription: EventSubscription | null = null;
let persistPromise: Promise<void> = Promise.resolve();
let permissionRequestInFlight = false;
let scheduleRequestInFlight = false;

const openedNotificationIds = new Set<string>();
const practiceReminderOpenedListeners = new Set<() => void>();
const stateListeners = new Set<() => void>();

function sanitizeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function sanitizeTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function sanitizeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function sanitizeOptInStatus(value: unknown): PracticeReminderOptInStatus {
  if (
    value === 'accepted' ||
    value === 'blocked' ||
    value === 'deferred' ||
    value === 'not_asked' ||
    value === 'permission_denied'
  ) {
    return value;
  }

  return 'not_asked';
}

function sanitizePermissionStatus(
  value: unknown,
): PracticeReminderPermissionStatus {
  if (
    value === 'blocked' ||
    value === 'denied' ||
    value === 'granted' ||
    value === 'provisional' ||
    value === 'undetermined' ||
    value === 'unknown'
  ) {
    return value;
  }

  return 'unknown';
}

function sanitizeScheduleStatus(
  value: unknown,
): PracticeReminderScheduleStatus {
  if (
    value === 'failed' ||
    value === 'not_scheduled' ||
    value === 'scheduled'
  ) {
    return value;
  }

  return 'not_scheduled';
}

function sanitizeScheduledReminders(value: unknown): ScheduledPracticeReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<ScheduledPracticeReminder>;

      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.copyId !== 'string' ||
        typeof candidate.triggerAtMs !== 'number' ||
        !Number.isFinite(candidate.triggerAtMs)
      ) {
        return null;
      }

      return {
        copyId: candidate.copyId,
        id: candidate.id,
        triggerAtMs: Math.floor(candidate.triggerAtMs),
      };
    })
    .filter((item): item is ScheduledPracticeReminder => Boolean(item));
}

function getNextTriggerAtMs(scheduledReminders: ScheduledPracticeReminder[]) {
  const now = Date.now();
  const futureReminder = [...scheduledReminders]
    .filter(reminder => reminder.triggerAtMs > now)
    .sort((left, right) => left.triggerAtMs - right.triggerAtMs)[0];

  return futureReminder?.triggerAtMs ?? null;
}

function toSnapshot(
  persistedState: PersistedPracticeReminderState,
): PracticeReminderSnapshot {
  const scheduledReminders = sanitizeScheduledReminders(
    persistedState.scheduledReminders,
  );

  return {
    anchorTriggerAtMs: sanitizeTimestamp(persistedState.anchorTriggerAtMs),
    favoriteSaveCount: sanitizeCount(persistedState.favoriteSaveCount),
    isHydrated: true,
    lastDecisionAtMs: sanitizeTimestamp(persistedState.lastDecisionAtMs),
    lastPromptedAtMs: sanitizeTimestamp(persistedState.lastPromptedAtMs),
    lastScheduledAtMs: sanitizeTimestamp(persistedState.lastScheduledAtMs),
    nextTriggerAtMs: getNextTriggerAtMs(scheduledReminders),
    optInStatus: sanitizeOptInStatus(persistedState.optInStatus),
    permissionCanAskAgain: sanitizeBoolean(
      persistedState.permissionCanAskAgain,
    ),
    permissionStatus: sanitizePermissionStatus(
      persistedState.permissionStatus,
    ),
    practiceSuccessCount: sanitizeCount(persistedState.practiceSuccessCount),
    promptShownCount: sanitizeCount(persistedState.promptShownCount),
    randomPracticeCompletionCount: sanitizeCount(
      persistedState.randomPracticeCompletionCount,
    ),
    scheduleStatus: sanitizeScheduleStatus(persistedState.scheduleStatus),
    scheduledReminders,
  };
}

function getPersistableState(): PersistedPracticeReminderState {
  return {
    anchorTriggerAtMs: reminderState.anchorTriggerAtMs ?? undefined,
    favoriteSaveCount: reminderState.favoriteSaveCount,
    lastDecisionAtMs: reminderState.lastDecisionAtMs ?? undefined,
    lastPromptedAtMs: reminderState.lastPromptedAtMs ?? undefined,
    lastScheduledAtMs: reminderState.lastScheduledAtMs ?? undefined,
    optInStatus: reminderState.optInStatus,
    permissionCanAskAgain: reminderState.permissionCanAskAgain ?? undefined,
    permissionStatus: reminderState.permissionStatus,
    practiceSuccessCount: reminderState.practiceSuccessCount,
    promptShownCount: reminderState.promptShownCount,
    randomPracticeCompletionCount:
      reminderState.randomPracticeCompletionCount,
    scheduleStatus: reminderState.scheduleStatus,
    scheduledReminders: reminderState.scheduledReminders,
  };
}

function notifyStateListeners() {
  stateListeners.forEach(listener => {
    listener();
  });
}

function setReminderState(
  updater: (current: PracticeReminderSnapshot) => PracticeReminderSnapshot,
) {
  reminderState = updater(reminderState);
  notifyStateListeners();
}

function queuePracticeReminderStatePersist() {
  const snapshot = getPersistableState();

  persistPromise = persistPromise
    .catch(() => undefined)
    .then(() =>
      AsyncStorage.setItem(
        STORAGE_KEYS.practiceReminderState,
        JSON.stringify(snapshot),
      ),
    )
    .catch(error => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
        ...getErrorAnalyticsParams(error),
        [ANALYTICS_PARAMS.RESULT]: 'persist_failed',
        [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
      }).catch(() => undefined);
      console.warn('Failed to persist practice reminder state.', error);
    });

  return persistPromise;
}

async function hydratePracticeReminderState() {
  try {
    const storedValue = await getItemWithMigration('practiceReminderState');

    if (!storedValue) {
      setReminderState(current => ({
        ...current,
        isHydrated: true,
      }));
      return;
    }

    const parsedValue: PersistedPracticeReminderState =
      JSON.parse(storedValue);

    setReminderState(() => toSnapshot(parsedValue));
  } catch (error) {
    setReminderState(current => ({
      ...current,
      isHydrated: true,
    }));
    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'hydrate_failed',
      [ANALYTICS_PARAMS.SOURCE]: 'async_storage',
    }).catch(() => undefined);
    console.warn('Failed to hydrate practice reminder state.', error);
  }
}

function ensurePracticeReminderStateHydrated() {
  if (!hydrationPromise) {
    hydrationPromise = hydratePracticeReminderState();
  }

  return hydrationPromise;
}

function isPermissionAllowed(status: PracticeReminderPermissionStatus) {
  return status === 'granted' || status === 'provisional';
}

function normalizePermissionStatus(
  permissions: NotificationPermissionsStatus,
): PracticeReminderPermissionStatus {
  const iosStatus = permissions.ios?.status;

  if (
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'provisional';
  }

  if (permissions.granted) {
    return 'granted';
  }

  if (iosStatus === Notifications.IosAuthorizationStatus.DENIED) {
    return permissions.canAskAgain ? 'denied' : 'blocked';
  }

  if (permissions.status === 'denied') {
    return permissions.canAskAgain ? 'denied' : 'blocked';
  }

  if (
    iosStatus === Notifications.IosAuthorizationStatus.NOT_DETERMINED ||
    permissions.status === 'undetermined'
  ) {
    return 'undetermined';
  }

  return 'unknown';
}

async function refreshPermissionStatus(source: string) {
  const permissions = await Notifications.getPermissionsAsync();
  const permissionStatus = normalizePermissionStatus(permissions);

  setReminderState(current => ({
    ...current,
    permissionCanAskAgain: permissions.canAskAgain,
    permissionStatus,
  }));
  await queuePracticeReminderStatePersist();

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PERMISSION_RESULT, {
    [ANALYTICS_PARAMS.METHOD]: 'get_permissions',
    [ANALYTICS_PARAMS.PERMISSION_CAN_ASK_AGAIN]: permissions.canAskAgain,
    [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
    [ANALYTICS_PARAMS.RESULT]: permissionStatus,
    [ANALYTICS_PARAMS.SOURCE]: source,
  }).catch(() => undefined);

  return {
    permissionStatus,
    permissions,
  };
}

async function configurePracticeReminderChannel(source: string) {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(
      PRACTICE_REMINDER_CHANNEL_ID,
      {
        description: 'Reminders to review game phrases in Laglingo.',
        enableVibrate: false,
        importance: Notifications.AndroidImportance.DEFAULT,
        name: 'Practice reminders',
        showBadge: false,
        sound: null,
      },
    );

    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_CHANNEL_RESULT, {
      [ANALYTICS_PARAMS.RESULT]: 'configured',
      [ANALYTICS_PARAMS.SOURCE]: source,
    }).catch(() => undefined);
  } catch (error) {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_CHANNEL_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'failed',
      [ANALYTICS_PARAMS.SOURCE]: source,
    }).catch(() => undefined);
    throw error;
  }
}

function getEarnedMilestone(): PracticeReminderMilestone | null {
  if (reminderState.practiceSuccessCount >= 1) {
    return 'practice-success';
  }

  if (reminderState.randomPracticeCompletionCount >= 1) {
    return 'random-practice-complete';
  }

  if (reminderState.favoriteSaveCount >= FAVORITE_SAVES_BEFORE_PROMPT) {
    return 'favorite-save';
  }

  return null;
}

function hasEarnedPromptOpportunity() {
  return getEarnedMilestone() !== null;
}

function applyPracticeReminderMilestone(milestone: PracticeReminderMilestone) {
  setReminderState(current => {
    switch (milestone) {
      case 'favorite-save':
        return {
          ...current,
          favoriteSaveCount: current.favoriteSaveCount + 1,
        };
      case 'practice-success':
        return {
          ...current,
          practiceSuccessCount: current.practiceSuccessCount + 1,
        };
      case 'random-practice-complete':
        return {
          ...current,
          randomPracticeCompletionCount:
            current.randomPracticeCompletionCount + 1,
        };
    }
  });
}

function getReminderAnalyticsCounts() {
  return {
    [ANALYTICS_PARAMS.FAVORITE_COUNT]: reminderState.favoriteSaveCount,
    [ANALYTICS_PARAMS.REMINDER_PROMPT_COUNT]: reminderState.promptShownCount,
    [ANALYTICS_PARAMS.SUCCESSFUL_COUNT]: reminderState.practiceSuccessCount,
    [ANALYTICS_PARAMS.TOTAL_COUNT]:
      reminderState.practiceSuccessCount +
      reminderState.randomPracticeCompletionCount,
  };
}

export function choosePracticeReminderCopy(
  randomValue = Math.random(),
): PracticeReminderCopyVariant {
  const safeRandomValue =
    Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1
      ? randomValue
      : 0;
  const copyIndex = Math.floor(
    safeRandomValue * PRACTICE_REMINDER_COPY_VARIANTS.length,
  );

  return PRACTICE_REMINDER_COPY_VARIANTS[copyIndex];
}

export function getInitialPracticeReminderTriggerAtMs(nowMs = Date.now()) {
  const nextTrigger = new Date(nowMs);

  nextTrigger.setHours(
    PRACTICE_REMINDER_TARGET_HOUR,
    PRACTICE_REMINDER_TARGET_MINUTE,
    0,
    0,
  );

  while (nextTrigger.getTime() - nowMs < MIN_FIRST_TRIGGER_LEAD_MS) {
    nextTrigger.setTime(nextTrigger.getTime() + TWO_DAYS_MS);
  }

  return nextTrigger.getTime();
}

export function getPracticeReminderTriggerDates(
  nowMs = Date.now(),
  anchorTriggerAtMs = getInitialPracticeReminderTriggerAtMs(nowMs),
  count = PRACTICE_REMINDER_SCHEDULED_COUNT,
) {
  const triggerDates: Date[] = [];
  const firstSchedulableMs = nowMs + MIN_FIRST_TRIGGER_LEAD_MS;
  let nextTriggerAtMs = anchorTriggerAtMs;

  while (nextTriggerAtMs < firstSchedulableMs) {
    nextTriggerAtMs += TWO_DAYS_MS;
  }

  while (triggerDates.length < count) {
    triggerDates.push(new Date(nextTriggerAtMs));
    nextTriggerAtMs += TWO_DAYS_MS;
  }

  return triggerDates;
}

function isPracticeReminderNotificationData(
  value: unknown,
): value is ReminderNotificationData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReminderNotificationData>;

  return (
    candidate.type === PRACTICE_REMINDER_NOTIFICATION_TYPE &&
    typeof candidate.copyId === 'string' &&
    typeof candidate.scheduledAtMs === 'number' &&
    typeof candidate.triggerAtMs === 'number'
  );
}

function getPracticeReminderNotificationData(
  notification: Notification,
): ReminderNotificationData | null {
  const data = notification.request.content.data;

  return isPracticeReminderNotificationData(data) ? data : null;
}

function trackReminderNotificationReceived(notification: Notification) {
  const data = getPracticeReminderNotificationData(notification);

  if (!data) {
    return;
  }

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_NOTIFICATION_RECEIVED, {
    [ANALYTICS_PARAMS.REMINDER_COPY_ID]: data.copyId,
    [ANALYTICS_PARAMS.RESULT]: 'foreground_suppressed',
    [ANALYTICS_PARAMS.SCHEDULED_FOR_MS]: data.triggerAtMs,
    [ANALYTICS_PARAMS.SOURCE]: data.source ?? 'local_notification',
  }).catch(() => undefined);
}

function handlePracticeReminderNotificationResponse(
  response: NotificationResponse,
) {
  const data = getPracticeReminderNotificationData(response.notification);

  if (!data) {
    return;
  }

  const notificationId = response.notification.request.identifier;

  if (openedNotificationIds.has(notificationId)) {
    return;
  }

  openedNotificationIds.add(notificationId);
  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_NOTIFICATION_OPENED, {
    [ANALYTICS_PARAMS.METHOD]: response.actionIdentifier,
    [ANALYTICS_PARAMS.REMINDER_COPY_ID]: data.copyId,
    [ANALYTICS_PARAMS.RESULT]: 'opened',
    [ANALYTICS_PARAMS.SCHEDULED_FOR_MS]: data.triggerAtMs,
    [ANALYTICS_PARAMS.SOURCE]: data.source ?? 'local_notification',
  }).catch(() => undefined);

  practiceReminderOpenedListeners.forEach(listener => {
    listener();
  });
  syncPracticeReminderSchedule('notification_opened').catch(() => undefined);
}

function ensureNotificationListenersRegistered() {
  if (!notificationResponseSubscription) {
    notificationResponseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        handlePracticeReminderNotificationResponse,
      );
  }

  Notifications.setNotificationHandler({
    handleNotification: async notification => {
      const data = getPracticeReminderNotificationData(notification);

      if (data) {
        trackReminderNotificationReceived(notification);
      }

      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: data?.debug === true,
        shouldShowList: data?.debug === true,
      };
    },
  });

  const lastNotificationResponse = Notifications.getLastNotificationResponse();

  if (lastNotificationResponse) {
    handlePracticeReminderNotificationResponse(lastNotificationResponse);
    Notifications.clearLastNotificationResponse();
  }
}

async function cancelScheduledPracticeReminders(source: string) {
  const scheduledReminderIds = reminderState.scheduledReminders.map(
    reminder => reminder.id,
  );

  if (scheduledReminderIds.length === 0) {
    return;
  }

  await Promise.allSettled(
    scheduledReminderIds.map(notificationId =>
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ),
  );

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
    [ANALYTICS_PARAMS.REMINDER_SCHEDULE_COUNT]: scheduledReminderIds.length,
    [ANALYTICS_PARAMS.RESULT]: 'canceled_previous',
    [ANALYTICS_PARAMS.SOURCE]: source,
  }).catch(() => undefined);
}

export async function syncPracticeReminderSchedule(source = 'sync') {
  await ensurePracticeReminderStateHydrated();

  if (scheduleRequestInFlight) {
    return false;
  }

  if (reminderState.optInStatus !== 'accepted') {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
      [ANALYTICS_PARAMS.REASON]: 'not_accepted',
      [ANALYTICS_PARAMS.RESULT]: 'not_scheduled',
      [ANALYTICS_PARAMS.SOURCE]: source,
    }).catch(() => undefined);
    return false;
  }

  if (!isPermissionAllowed(reminderState.permissionStatus)) {
    const { permissionStatus } = await refreshPermissionStatus(source);

    if (!isPermissionAllowed(permissionStatus)) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
        [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
        [ANALYTICS_PARAMS.REASON]: 'permission_not_granted',
        [ANALYTICS_PARAMS.RESULT]: 'not_scheduled',
        [ANALYTICS_PARAMS.SOURCE]: source,
      }).catch(() => undefined);
      return false;
    }
  }

  scheduleRequestInFlight = true;

  try {
    await configurePracticeReminderChannel(source);
    await cancelScheduledPracticeReminders(source);

    const now = Date.now();
    const anchorTriggerAtMs =
      reminderState.anchorTriggerAtMs ??
      getInitialPracticeReminderTriggerAtMs(now);
    const triggerDates = getPracticeReminderTriggerDates(
      now,
      anchorTriggerAtMs,
    );
    const scheduledAtMs = Date.now();
    const scheduledReminders: ScheduledPracticeReminder[] = [];

    for (let index = 0; index < triggerDates.length; index += 1) {
      const triggerDate = triggerDates[index];
      const copy = choosePracticeReminderCopy();
      const identifier = [
        PRACTICE_REMINDER_REQUEST_PREFIX,
        triggerDate.getTime(),
        copy.id,
        index,
      ].join('-');
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          autoDismiss: true,
          body: copy.body,
          data: {
            copyId: copy.id,
            scheduledAtMs,
            triggerAtMs: triggerDate.getTime(),
            type: PRACTICE_REMINDER_NOTIFICATION_TYPE,
          },
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          sound: false,
          title: copy.title,
        },
        identifier,
        trigger: {
          channelId: PRACTICE_REMINDER_CHANNEL_ID,
          date: triggerDate,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
        },
      });

      scheduledReminders.push({
        copyId: copy.id,
        id: notificationId,
        triggerAtMs: triggerDate.getTime(),
      });
    }

    setReminderState(current => ({
      ...current,
      anchorTriggerAtMs,
      lastScheduledAtMs: scheduledAtMs,
      nextTriggerAtMs: scheduledReminders[0]?.triggerAtMs ?? null,
      scheduleStatus: 'scheduled',
      scheduledReminders,
    }));
    await queuePracticeReminderStatePersist();

    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
      [ANALYTICS_PARAMS.REMINDER_INTERVAL_DAYS]:
        PRACTICE_REMINDER_INTERVAL_DAYS,
      [ANALYTICS_PARAMS.REMINDER_SCHEDULE_COUNT]: scheduledReminders.length,
      [ANALYTICS_PARAMS.REMINDER_TRIGGER_HOUR]:
        PRACTICE_REMINDER_TARGET_HOUR,
      [ANALYTICS_PARAMS.REMINDER_TRIGGER_MINUTE]:
        PRACTICE_REMINDER_TARGET_MINUTE,
      [ANALYTICS_PARAMS.RESULT]: 'scheduled',
      [ANALYTICS_PARAMS.SCHEDULED_FOR_MS]:
        scheduledReminders[0]?.triggerAtMs,
      [ANALYTICS_PARAMS.SOURCE]: source,
    }).catch(() => undefined);
    return true;
  } catch (error) {
    setReminderState(current => ({
      ...current,
      scheduleStatus: 'failed',
    }));
    await queuePracticeReminderStatePersist();
    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'failed',
      [ANALYTICS_PARAMS.SOURCE]: source,
    }).catch(() => undefined);
    console.warn('Failed to schedule practice reminders.', error);
    return false;
  } finally {
    scheduleRequestInFlight = false;
  }
}

export function getPracticeReminderSnapshot(): PracticeReminderSnapshot {
  return {
    ...reminderState,
    scheduledReminders: [...reminderState.scheduledReminders],
  };
}

export async function scheduleDebugPracticeReminderNotification({
  delayMinutes = 0,
  source = 'debug_screen',
}: {
  delayMinutes?: number;
  source?: string;
} = {}) {
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    throw new Error('Enter a delay of 0 minutes or more.');
  }

  await ensurePracticeReminderStateHydrated();
  await configurePracticeReminderChannel(source);

  let permissions = await Notifications.getPermissionsAsync();
  let permissionStatus = normalizePermissionStatus(permissions);

  if (!isPermissionAllowed(permissionStatus) && permissions.canAskAgain) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });
    permissionStatus = normalizePermissionStatus(permissions);
  }

  setReminderState(current => ({
    ...current,
    permissionCanAskAgain: permissions.canAskAgain,
    permissionStatus,
  }));
  await queuePracticeReminderStatePersist();

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PERMISSION_RESULT, {
    [ANALYTICS_PARAMS.METHOD]: 'debug_request_permissions',
    [ANALYTICS_PARAMS.PERMISSION_CAN_ASK_AGAIN]: permissions.canAskAgain,
    [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
    [ANALYTICS_PARAMS.RESULT]: permissionStatus,
    [ANALYTICS_PARAMS.SOURCE]: source,
  }).catch(() => undefined);

  if (!isPermissionAllowed(permissionStatus)) {
    throw new Error('Notification permission is not granted.');
  }

  const now = Date.now();
  const delayMs = Math.round(delayMinutes * 60 * 1000);
  const triggerAtMs = now + delayMs;
  const triggerDate = new Date(triggerAtMs);
  const copy = choosePracticeReminderCopy();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      autoDismiss: true,
      body: copy.body,
      data: {
        copyId: copy.id,
        debug: true,
        scheduledAtMs: now,
        source,
        triggerAtMs,
        type: PRACTICE_REMINDER_NOTIFICATION_TYPE,
      },
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      sound: false,
      title: copy.title,
    },
    identifier: [
      'debug',
      PRACTICE_REMINDER_REQUEST_PREFIX,
      triggerAtMs,
      copy.id,
    ].join('-'),
    trigger:
      delayMs === 0
        ? {
            channelId: PRACTICE_REMINDER_CHANNEL_ID,
          }
        : {
            channelId: PRACTICE_REMINDER_CHANNEL_ID,
            date: triggerDate,
            type: Notifications.SchedulableTriggerInputTypes.DATE,
          },
  });

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
    [ANALYTICS_PARAMS.DURATION_MS]: delayMs,
    [ANALYTICS_PARAMS.REMINDER_COPY_ID]: copy.id,
    [ANALYTICS_PARAMS.RESULT]: 'debug_scheduled',
    [ANALYTICS_PARAMS.SCHEDULED_FOR_MS]: triggerAtMs,
    [ANALYTICS_PARAMS.SOURCE]: source,
  }).catch(() => undefined);

  return {
    copyId: copy.id,
    notificationId,
    triggerAtMs,
  };
}

export function subscribeToPracticeReminderState(listener: () => void) {
  stateListeners.add(listener);

  return () => {
    stateListeners.delete(listener);
  };
}

export function subscribeToPracticeReminderOpened(listener: () => void) {
  practiceReminderOpenedListeners.add(listener);

  return () => {
    practiceReminderOpenedListeners.delete(listener);
  };
}

export function getPracticeReminderPromptEligibility(
  now = Date.now(),
): PromptEligibility {
  const earnedMilestone = getEarnedMilestone();

  if (!reminderState.isHydrated) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'not_hydrated',
    };
  }

  if (AppState.currentState && AppState.currentState !== 'active') {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'app_not_active',
    };
  }

  if (reminderState.optInStatus === 'accepted') {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'already_accepted',
    };
  }

  if (
    reminderState.optInStatus === 'blocked' ||
    reminderState.permissionStatus === 'blocked'
  ) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'permission_blocked',
    };
  }

  if (
    reminderState.optInStatus === 'permission_denied' ||
    (reminderState.permissionStatus === 'denied' &&
      reminderState.permissionCanAskAgain === false)
  ) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'permission_denied',
    };
  }

  if (!hasEarnedPromptOpportunity()) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'not_enough_signals',
    };
  }

  if (reminderState.promptShownCount >= PRACTICE_REMINDER_PROMPT_MAX_COUNT) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'max_prompt_count',
    };
  }

  if (
    reminderState.lastPromptedAtMs &&
    now - reminderState.lastPromptedAtMs < MIN_PROMPT_SPACING_MS
  ) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'prompt_recently_shown',
    };
  }

  if (
    reminderState.optInStatus === 'deferred' &&
    reminderState.lastDecisionAtMs &&
    now - reminderState.lastDecisionAtMs <
      PRACTICE_REMINDER_PROMPT_COOLDOWN_MS
  ) {
    return {
      earnedMilestone,
      eligible: false,
      reason: 'deferred_cooldown',
    };
  }

  return {
    earnedMilestone,
    eligible: true,
    reason: 'eligible',
  };
}

export async function markPracticeReminderPromptShown(
  origin: string,
  eligibility = getPracticeReminderPromptEligibility(),
) {
  await ensurePracticeReminderStateHydrated();

  const now = Date.now();

  setReminderState(current => ({
    ...current,
    lastPromptedAtMs: now,
    promptShownCount: current.promptShownCount + 1,
  }));

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PROMPT_SHOWN, {
    ...getReminderAnalyticsCounts(),
    [ANALYTICS_PARAMS.METHOD]: eligibility.earnedMilestone,
    [ANALYTICS_PARAMS.ORIGIN]: origin,
    [ANALYTICS_PARAMS.PERMISSION_STATUS]: reminderState.permissionStatus,
    [ANALYTICS_PARAMS.REASON]: eligibility.reason,
    [ANALYTICS_PARAMS.REMINDER_INTERVAL_DAYS]:
      PRACTICE_REMINDER_INTERVAL_DAYS,
    [ANALYTICS_PARAMS.REMINDER_TRIGGER_HOUR]:
      PRACTICE_REMINDER_TARGET_HOUR,
    [ANALYTICS_PARAMS.REMINDER_TRIGGER_MINUTE]:
      PRACTICE_REMINDER_TARGET_MINUTE,
    [ANALYTICS_PARAMS.RESULT]: 'shown',
  }).catch(() => undefined);
}

export async function deferPracticeReminderPrompt(
  origin: string,
  action: 'dismissed' | 'not_now' = 'not_now',
) {
  await ensurePracticeReminderStateHydrated();

  setReminderState(current => ({
    ...current,
    lastDecisionAtMs: Date.now(),
    optInStatus: 'deferred',
  }));
  await queuePracticeReminderStatePersist();

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PROMPT_ACTION, {
    ...getReminderAnalyticsCounts(),
    [ANALYTICS_PARAMS.ORIGIN]: origin,
    [ANALYTICS_PARAMS.RESULT]: 'deferred',
    [ANALYTICS_PARAMS.UI_ACTION]: action,
  }).catch(() => undefined);
}

export async function acceptPracticeReminderPrompt(origin: string) {
  await ensurePracticeReminderStateHydrated();

  if (permissionRequestInFlight) {
    return false;
  }

  permissionRequestInFlight = true;
  setReminderState(current => ({
    ...current,
    lastDecisionAtMs: Date.now(),
    optInStatus: 'accepted',
  }));
  await queuePracticeReminderStatePersist();

  trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PROMPT_ACTION, {
    ...getReminderAnalyticsCounts(),
    [ANALYTICS_PARAMS.ORIGIN]: origin,
    [ANALYTICS_PARAMS.RESULT]: 'accepted',
    [ANALYTICS_PARAMS.UI_ACTION]: 'remind_me',
  }).catch(() => undefined);

  try {
    await configurePracticeReminderChannel(origin);

    const previousPermissionStatus = reminderState.permissionStatus;
    let permissions = await Notifications.getPermissionsAsync();
    let permissionStatus = normalizePermissionStatus(permissions);

    if (!isPermissionAllowed(permissionStatus) && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: false,
        },
      });
      permissionStatus = normalizePermissionStatus(permissions);
    }

    const nextOptInStatus = isPermissionAllowed(permissionStatus)
      ? 'accepted'
      : permissions.canAskAgain
        ? 'permission_denied'
        : 'blocked';

    setReminderState(current => ({
      ...current,
      optInStatus: nextOptInStatus,
      permissionCanAskAgain: permissions.canAskAgain,
      permissionStatus,
    }));
    await queuePracticeReminderStatePersist();

    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PERMISSION_RESULT, {
      [ANALYTICS_PARAMS.METHOD]: 'request_permissions',
      [ANALYTICS_PARAMS.PERMISSION_CAN_ASK_AGAIN]: permissions.canAskAgain,
      [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
      [ANALYTICS_PARAMS.PREVIOUS_STATUS]: previousPermissionStatus,
      [ANALYTICS_PARAMS.RESULT]: permissionStatus,
      [ANALYTICS_PARAMS.SOURCE]: origin,
    }).catch(() => undefined);

    if (!isPermissionAllowed(permissionStatus)) {
      return false;
    }

    return syncPracticeReminderSchedule(origin);
  } catch (error) {
    trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_PERMISSION_RESULT, {
      ...getErrorAnalyticsParams(error),
      [ANALYTICS_PARAMS.RESULT]: 'failed',
      [ANALYTICS_PARAMS.SOURCE]: origin,
    }).catch(() => undefined);
    console.warn('Failed to request practice reminder permission.', error);
    return false;
  } finally {
    permissionRequestInFlight = false;
  }
}

export function trackPracticeReminderMilestone(
  milestone: PracticeReminderMilestone,
) {
  ensurePracticeReminderStateHydrated()
    .then(async () => {
      applyPracticeReminderMilestone(milestone);

      const eligibility = getPracticeReminderPromptEligibility();

      trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_MILESTONE, {
        ...getReminderAnalyticsCounts(),
        [ANALYTICS_PARAMS.METHOD]: milestone,
        [ANALYTICS_PARAMS.RESULT]: eligibility.eligible
          ? 'eligible_signal'
          : 'signal_recorded',
      }).catch(() => undefined);
      trackAnalyticsEvent(
        ANALYTICS_EVENTS.REMINDER_ELIGIBILITY_EVALUATED,
        {
          ...getReminderAnalyticsCounts(),
          [ANALYTICS_PARAMS.METHOD]: milestone,
          [ANALYTICS_PARAMS.PERMISSION_STATUS]:
            reminderState.permissionStatus,
          [ANALYTICS_PARAMS.REASON]: eligibility.reason,
          [ANALYTICS_PARAMS.RESULT]: eligibility.eligible
            ? 'eligible'
            : 'not_eligible',
        },
      ).catch(() => undefined);

      await queuePracticeReminderStatePersist();
    })
    .catch(error => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_MILESTONE, {
        ...getErrorAnalyticsParams(error),
        [ANALYTICS_PARAMS.METHOD]: milestone,
        [ANALYTICS_PARAMS.RESULT]: 'failed',
      }).catch(() => undefined);
    });
}

export function initializePracticeReminders() {
  if (!initializationPromise) {
    initializationPromise = ensurePracticeReminderStateHydrated()
      .then(async () => {
        ensureNotificationListenersRegistered();
        await configurePracticeReminderChannel('app_start');
        await refreshPermissionStatus('app_start');

        if (
          reminderState.optInStatus === 'accepted' &&
          isPermissionAllowed(reminderState.permissionStatus)
        ) {
          await syncPracticeReminderSchedule('app_start');
        }
      })
      .catch(error => {
        trackAnalyticsEvent(ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT, {
          ...getErrorAnalyticsParams(error),
          [ANALYTICS_PARAMS.RESULT]: 'initialize_failed',
          [ANALYTICS_PARAMS.SOURCE]: 'app_start',
        }).catch(() => undefined);
        console.warn('Failed to initialize practice reminders.', error);
      });
  }

  return initializationPromise;
}
