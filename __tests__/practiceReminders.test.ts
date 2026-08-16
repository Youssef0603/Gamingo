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
const mockPermissionStatus = {
  canAskAgain: true,
  granted: true,
  status: 'granted',
};
const mockNotifications = {
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  AndroidImportance: {
    DEFAULT: 5,
  },
  AndroidNotificationPriority: {
    DEFAULT: 'default',
  },
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  clearLastNotificationResponse: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  getPermissionsAsync: jest.fn(() => Promise.resolve(mockPermissionStatus)),
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    DENIED: 1,
    EPHEMERAL: 4,
    NOT_DETERMINED: 0,
    PROVISIONAL: 3,
  },
  requestPermissionsAsync: jest.fn(() => Promise.resolve(mockPermissionStatus)),
  scheduleNotificationAsync: jest.fn(
    ({ identifier }: { identifier: string }) => Promise.resolve(identifier),
  ),
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  setNotificationHandler: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
  ...mockAsyncStorage,
}));
jest.mock('expo-notifications', () => mockNotifications);
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
  },
}));
jest.mock('../src/services/analytics', () => {
  const actual = jest.requireActual('../src/services/analytics');

  return {
    ...actual,
    getErrorAnalyticsParams: jest.fn(() => ({
      error_code: 'test_error',
    })),
    trackAnalyticsEvent: jest.fn(() => Promise.resolve()),
  };
});

const PRACTICE_REMINDER_STORAGE_KEY = 'practiceReminderState';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

async function flushPromises() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function loadPracticeReminders() {
  return require('../src/features/notifications/practiceReminders');
}

describe('practiceReminders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 16, 10, 0, 0));
    jest.resetModules();
    jest.clearAllMocks();
    mockStorage.clear();
    mockPermissionStatus.canAskAgain = true;
    mockPermissionStatus.granted = true;
    mockPermissionStatus.status = 'granted';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('targets 7:30 PM local time every 2 days', () => {
    const {
      getInitialPracticeReminderTriggerAtMs,
      getPracticeReminderTriggerDates,
    } = loadPracticeReminders();
    const anchor = getInitialPracticeReminderTriggerAtMs(Date.now());
    const dates = getPracticeReminderTriggerDates(Date.now(), anchor, 3);

    dates.forEach((date: Date) => {
      expect(date.getHours()).toBe(19);
      expect(date.getMinutes()).toBe(30);
    });
    expect(dates[1].getTime() - dates[0].getTime()).toBe(TWO_DAYS_MS);
    expect(dates[2].getTime() - dates[1].getTime()).toBe(TWO_DAYS_MS);
  });

  it('skips tonight when the target time is too close', () => {
    const { getInitialPracticeReminderTriggerAtMs } = loadPracticeReminders();
    const nowMs = new Date(2026, 7, 16, 19, 20, 0).getTime();
    const trigger = new Date(getInitialPracticeReminderTriggerAtMs(nowMs));

    expect(trigger.getDate()).toBe(new Date(2026, 7, 18).getDate());
    expect(trigger.getHours()).toBe(19);
    expect(trigger.getMinutes()).toBe(30);
  });

  it('selects from all reminder copy variants by random bucket', () => {
    const {
      PRACTICE_REMINDER_COPY_VARIANTS,
      choosePracticeReminderCopy,
    } = loadPracticeReminders();
    const selectedCopyIds = [0, 0.2, 0.4, 0.6, 0.99].map(
      (randomValue: number) => choosePracticeReminderCopy(randomValue).id,
    );

    expect(new Set(selectedCopyIds)).toEqual(
      new Set(
        PRACTICE_REMINDER_COPY_VARIANTS.map(
          (copy: { id: string }) => copy.id,
        ),
      ),
    );
  });

  it('becomes eligible after one successful pronunciation', async () => {
    const service = loadPracticeReminders();
    const analytics = require('../src/services/analytics');

    await service.initializePracticeReminders();
    expect(service.getPracticeReminderPromptEligibility().eligible).toBe(false);

    service.trackPracticeReminderMilestone('practice-success');
    await flushPromises();

    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: true,
      earnedMilestone: 'practice-success',
      reason: 'eligible',
    });
    expect(analytics.trackAnalyticsEvent).toHaveBeenCalledWith(
      analytics.ANALYTICS_EVENTS.REMINDER_ELIGIBILITY_EVALUATED,
      expect.objectContaining({
        method: 'practice-success',
        result: 'eligible',
      }),
    );
  });

  it('requires two favorite saves before prompting from favorites alone', async () => {
    const service = loadPracticeReminders();

    await service.initializePracticeReminders();
    service.trackPracticeReminderMilestone('favorite-save');
    await flushPromises();

    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: false,
      reason: 'not_enough_signals',
    });

    service.trackPracticeReminderMilestone('favorite-save');
    await flushPromises();

    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: true,
      earnedMilestone: 'favorite-save',
    });
  });

  it('shows again 3 days after the user taps Not now', async () => {
    const service = loadPracticeReminders();

    await service.initializePracticeReminders();
    service.trackPracticeReminderMilestone('practice-success');
    await flushPromises();
    await service.markPracticeReminderPromptShown('test');
    await service.deferPracticeReminderPrompt('test', 'not_now');

    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: false,
      reason: 'prompt_recently_shown',
    });

    jest.setSystemTime(new Date(Date.now() + THREE_DAYS_MS - 1000));
    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: false,
      reason: 'deferred_cooldown',
    });

    jest.setSystemTime(new Date(Date.now() + 1000));
    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: true,
      reason: 'eligible',
    });
  });

  it('does not persist a cooldown when the prompt is shown without a response', async () => {
    const service = loadPracticeReminders();

    await service.initializePracticeReminders();
    service.trackPracticeReminderMilestone('practice-success');
    await flushPromises();
    await service.markPracticeReminderPromptShown('test');

    expect(service.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: false,
      reason: 'prompt_recently_shown',
    });

    const persistedState = JSON.parse(
      mockStorage.get(PRACTICE_REMINDER_STORAGE_KEY) ?? '{}',
    );

    expect(persistedState.lastPromptedAtMs).toBeUndefined();
    expect(persistedState.promptShownCount).toBe(0);

    jest.resetModules();

    const restartedService = loadPracticeReminders();

    await restartedService.initializePracticeReminders();

    expect(restartedService.getPracticeReminderPromptEligibility()).toMatchObject({
      eligible: true,
      reason: 'eligible',
    });
  });

  it('requests permission and schedules the rolling two-day reminder set', async () => {
    const service = loadPracticeReminders();
    const analytics = require('../src/services/analytics');

    await service.initializePracticeReminders();
    service.trackPracticeReminderMilestone('practice-success');
    await flushPromises();

    await service.markPracticeReminderPromptShown('test');
    const didSchedule = await service.acceptPracticeReminderPrompt('test');
    const persistedState = JSON.parse(
      mockStorage.get(PRACTICE_REMINDER_STORAGE_KEY) ?? '{}',
    );

    expect(didSchedule).toBe(true);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(
      service.PRACTICE_REMINDER_SCHEDULED_COUNT,
    );
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({
            type: 'practice_reminder',
          }),
          sound: false,
        }),
        trigger: expect.objectContaining({
          channelId: service.PRACTICE_REMINDER_CHANNEL_ID,
          type: 'date',
        }),
      }),
    );
    expect(persistedState.optInStatus).toBe('accepted');
    expect(persistedState.scheduleStatus).toBe('scheduled');
    expect(persistedState.scheduledReminders).toHaveLength(
      service.PRACTICE_REMINDER_SCHEDULED_COUNT,
    );
    expect(analytics.trackAnalyticsEvent).toHaveBeenCalledWith(
      analytics.ANALYTICS_EVENTS.REMINDER_PERMISSION_RESULT,
      expect.objectContaining({
        permission_status: 'granted',
        result: 'granted',
      }),
    );
    expect(analytics.trackAnalyticsEvent).toHaveBeenCalledWith(
      analytics.ANALYTICS_EVENTS.REMINDER_SCHEDULE_RESULT,
      expect.objectContaining({
        reminder_interval_days: 2,
        reminder_schedule_count: service.PRACTICE_REMINDER_SCHEDULED_COUNT,
        result: 'scheduled',
      }),
    );
  });

  it('schedules an immediate debug notification on the reminder channel', async () => {
    const service = loadPracticeReminders();

    await service.initializePracticeReminders();
    const result = await service.scheduleDebugPracticeReminderNotification({
      delayMinutes: 0,
      source: 'debug_screen',
    });
    const persistedState = JSON.parse(
      mockStorage.get(PRACTICE_REMINDER_STORAGE_KEY) ?? '{}',
    );

    expect(result.notificationId).toContain('debug-practice-reminder');
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({
            debug: true,
            source: 'debug_screen',
            type: 'practice_reminder',
          }),
        }),
        trigger: {
          channelId: service.PRACTICE_REMINDER_CHANNEL_ID,
        },
      }),
    );
    expect(persistedState.optInStatus).not.toBe('accepted');
  });

  it('schedules a delayed debug notification after the requested minutes', async () => {
    const service = loadPracticeReminders();
    const nowMs = Date.now();

    await service.initializePracticeReminders();
    const result = await service.scheduleDebugPracticeReminderNotification({
      delayMinutes: 1,
      source: 'debug_screen',
    });

    expect(result.triggerAtMs).toBe(nowMs + 60 * 1000);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: {
          channelId: service.PRACTICE_REMINDER_CHANNEL_ID,
          date: new Date(nowMs + 60 * 1000),
          type: 'date',
        },
      }),
    );
  });
});
