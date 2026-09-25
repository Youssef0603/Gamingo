import { Platform } from 'react-native';

import type { AdsPolicy } from '../features/ads/adsPolicy';
import type { LanguageCode } from '../types/language';
import type { Phrase } from '../types/phrase';

type AnalyticsPrimitive = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsPrimitive>;

const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_NAME_LENGTH = 40;
const MAX_STRING_VALUE_LENGTH = 100;
const MAX_EVENT_PARAM_COUNT = 25;
const CUSTOM_PHRASE_ID_VALUE = 'custom_phrase';

export const ANALYTICS_EVENTS = {
  AD_CLOSED: 'ad_closed',
  AD_FAILED: 'ad_failed',
  AD_GATE_EVALUATED: 'ad_gate_evaluated',
  AD_IMPRESSION_RECORDED: 'ad_impression_recorded',
  AD_LOAD_STARTED: 'ad_load_started',
  AD_LOADED: 'ad_loaded',
  AD_OPENED: 'ad_opened',
  AD_SKIPPED: 'ad_skipped',
  AD_SHOWN: 'ad_shown',
  ANALYTICS_ERROR: 'analytics_error',
  APP_CONTEXT_UPDATED: 'app_context_updated',
  APP_HYDRATED: 'app_hydrated',
  APP_PERSIST_FAILED: 'app_persist_failed',
  APP_STARTED: 'app_started',
  APP_STATE_CHANGED: 'app_state_changed',
  BOTTOM_SHEET_DISMISSED: 'bottom_sheet_dismissed',
  BOTTOM_SHEET_OPENED: 'bottom_sheet_opened',
  CATEGORY_SELECTED: 'category_selected',
  CUSTOM_PHRASE_BLOCKED: 'custom_phrase_blocked',
  CUSTOM_PHRASE_CREATED: 'custom_phrase_created',
  CUSTOM_PHRASE_DELETED: 'custom_phrase_deleted',
  CUSTOM_PHRASE_EXISTING_OPENED: 'custom_phrase_existing_opened',
  CUSTOM_PHRASE_FAILED: 'custom_phrase_failed',
  CUSTOM_PHRASE_INPUT_CHANGED: 'custom_phrase_input_changed',
  CUSTOM_PHRASE_LOOKUP_COMPLETED: 'custom_phrase_lookup_completed',
  CUSTOM_PHRASE_MODAL_CLOSED: 'custom_phrase_modal_closed',
  CUSTOM_PHRASE_MODAL_OPENED: 'custom_phrase_modal_opened',
  CUSTOM_PHRASE_SUBMITTED: 'custom_phrase_submitted',
  DEBUG_STORAGE_REFRESHED: 'debug_storage_refreshed',
  EMPTY_STATE_VIEWED: 'empty_state_viewed',
  FAVORITE_TOGGLED: 'favorite_toggled',
  LANGUAGE_CHANGED: 'language_changed',
  LANGUAGE_PICKER_OPENED: 'language_picker_opened',
  LANGUAGE_PICKER_OPTION_SELECTED: 'language_picker_option_selected',
  LANGUAGE_PICKER_SEARCH_CHANGED: 'language_search_changed',
  PHRASE_MODAL_CLOSED: 'phrase_modal_closed',
  PHRASE_MODAL_OPENED: 'phrase_modal_opened',
  PHRASE_SELECTED: 'phrase_selected',
  PRACTICE_ATTEMPT_COMPLETED: 'practice_attempt_completed',
  PRACTICE_ATTEMPT_FAILED: 'practice_attempt_failed',
  PRACTICE_AUDIO_COMPLETED: 'practice_audio_completed',
  PRACTICE_AUDIO_FAILED: 'practice_audio_failed',
  PRACTICE_AUDIO_REQUESTED: 'practice_audio_requested',
  PRACTICE_CANCELED: 'practice_canceled',
  PRACTICE_LISTEN_STARTED: 'practice_listen_started',
  RANDOM_PRACTICE_CLOSED: 'random_practice_closed',
  RANDOM_PRACTICE_COMPLETED: 'random_practice_completed',
  RANDOM_PRACTICE_REQUESTED: 'random_practice_requested',
  RANDOM_PRACTICE_RESTARTED: 'random_practice_restarted',
  RANDOM_PRACTICE_STARTED: 'random_practice_started',
  RANDOM_PRACTICE_WORD_SKIPPED: 'random_practice_word_skipped',
  REMINDER_CHANNEL_RESULT: 'reminder_channel_result',
  REMINDER_ELIGIBILITY_EVALUATED: 'reminder_eligibility_evaluated',
  REMINDER_MILESTONE: 'reminder_milestone',
  REMINDER_NOTIFICATION_OPENED: 'reminder_notification_opened',
  REMINDER_NOTIFICATION_RECEIVED: 'reminder_notification_received',
  REMINDER_PERMISSION_RESULT: 'reminder_permission_result',
  REMINDER_PROMPT_ACTION: 'reminder_prompt_action',
  REMINDER_PROMPT_SHOWN: 'reminder_prompt_shown',
  REMINDER_SCHEDULE_RESULT: 'reminder_schedule_result',
  REMOTE_CONFIG_FAILED: 'remote_config_failed',
  REMOTE_CONFIG_INITIALIZED: 'remote_config_initialized',
  REMOTE_CONFIG_UPDATED: 'remote_config_updated',
  REVIEW_MILESTONE: 'review_milestone',
  REVIEW_PROMPT_RESULT: 'review_prompt_result',
  SCREEN_VIEWED: 'screen_viewed',
  SCROLL_DEPTH_REACHED: 'scroll_depth_reached',
  SCROLL_TO_TOP_PRESSED: 'scroll_to_top_pressed',
  SEARCH_CHANGED: 'search_changed',
  SEARCH_CLEARED: 'search_cleared',
  SEARCH_CLOSED: 'search_closed',
  SEARCH_OPENED: 'search_opened',
  TAB_PRESSED: 'tab_pressed',
  TOXIC_DISCLOSURE_ACCEPTED: 'toxic_disclosure_accepted',
  TOXIC_DISCLOSURE_VIEWED: 'toxic_disclosure_viewed',
} as const;

export const ANALYTICS_PARAMS = {
  AD_FORMAT: 'ad_format',
  AD_FREQUENCY: 'ad_frequency',
  AD_GATE_REASON: 'ad_gate_reason',
  AD_PLACEMENT: 'ad_placement',
  AD_RESULT: 'ad_result',
  APP_STATE: 'app_state',
  ATTEMPT_SCORE: 'attempt_score',
  ATTEMPT_RESULT: 'attempt_result',
  AUDIO_SOURCE: 'audio_source',
  AUTO_LISTEN: 'auto_listen',
  AVAILABLE_COUNT: 'available_count',
  CATEGORY: 'category',
  CUSTOM_PHRASE_COUNT: 'custom_phrase_count',
  DEVICE_LOCALE: 'device_locale',
  DURATION_MS: 'duration_ms',
  ELAPSED_MS: 'elapsed_ms',
  ERROR_CODE: 'error_code',
  ERROR_COUNT: 'error_count',
  ERROR_NAME: 'error_name',
  EXPECTED_TOKEN_COUNT: 'expected_token_count',
  FAVORITE_COUNT: 'favorite_count',
  FAVORITE_LANG: 'favorite_lang',
  FEEDBACK_LABEL: 'feedback_label',
  FIRST_LAUNCH_USED_MS: 'first_launch_used_ms',
  FLOW: 'flow',
  GRACE_REMAINING_MS: 'grace_remaining_ms',
  HAS_QUERY: 'has_query',
  HAS_SAFER_ALT: 'has_safer_alt',
  HELPER_LANG: 'helper_lang',
  INPUT_LENGTH: 'input_length',
  IS_CUSTOM: 'is_custom',
  IS_FAVORITE: 'is_favorite',
  IS_TOXIC: 'is_toxic',
  ITEM_INDEX: 'item_index',
  LANGUAGE_TARGET: 'language_target',
  LEARNING_LANG: 'learning_lang',
  METHOD: 'method',
  MODAL: 'modal',
  NATIVE_LANG: 'native_lang',
  NEXT_LANG: 'next_lang',
  ORIGIN: 'origin',
  PERMISSION_CAN_ASK_AGAIN: 'permission_can_ask_again',
  PERMISSION_STATUS: 'permission_status',
  PHRASE_CATEGORY: 'phrase_category',
  PHRASE_COUNT: 'phrase_count',
  PHRASE_ID: 'phrase_id',
  PHRASE_SOURCE: 'phrase_source',
  PHRASE_TAGS: 'phrase_tags',
  PHRASE_TYPE: 'phrase_type',
  PLAYBACK_RATE: 'playback_rate',
  POLICY_VERSION: 'policy_version',
  PREVIOUS_LANG: 'previous_lang',
  PREVIOUS_SCREEN: 'previous_screen',
  PREVIOUS_STATUS: 'previous_status',
  PRACTICE_MODE: 'practice_mode',
  PROGRESS_PCT: 'progress_pct',
  PROMPT_TYPE: 'prompt_type',
  QUERY_LENGTH: 'query_length',
  REASON: 'reason',
  RECOGNITION_STATE: 'recognition_state',
  REMINDER_COPY_ID: 'reminder_copy_id',
  REMINDER_INTERVAL_DAYS: 'reminder_interval_days',
  REMINDER_PROMPT_COUNT: 'reminder_prompt_count',
  REMINDER_SCHEDULE_COUNT: 'reminder_schedule_count',
  REMINDER_TRIGGER_HOUR: 'reminder_trigger_hour',
  REMINDER_TRIGGER_MINUTE: 'reminder_trigger_minute',
  REMOTE_CONFIG_KEY: 'remote_config_key',
  RESULT: 'result',
  RESULT_COUNT: 'result_count',
  SCHEDULED_FOR_MS: 'scheduled_for_ms',
  SCREEN: 'screen',
  SEARCH_CONTEXT: 'search_context',
  SKIPPED_COUNT: 'skipped_count',
  SOURCE: 'source',
  SPOKEN_TOKEN_COUNT: 'spoken_token_count',
  STATUS: 'status',
  SUCCESSFUL_COUNT: 'successful_count',
  TOTAL_COUNT: 'total_count',
  TRANSLATED_LENGTH: 'translated_length',
  TTS_ENGINE: 'tts_engine',
  UI_ACTION: 'ui_action',
  UI_ELEMENT: 'ui_element',
} as const;

export const ANALYTICS_USER_PROPERTIES = {
  USER_ADS_ENABLED: 'user_ads_enabled',
  USER_ADS_POLICY_VERSION: 'user_ads_policy_version',
  USER_BANNER_ENABLED: 'user_banner_enabled',
  USER_CUSTOM_COUNT_BUCKET: 'user_custom_count_bucket',
  USER_FAVORITE_COUNT_BUCKET: 'user_fav_count_bucket',
  USER_FAVORITE_LANG: 'user_favorite_lang',
  USER_HAS_CUSTOM_PHRASES: 'user_has_custom_phrases',
  USER_HAS_FAVORITES: 'user_has_favorites',
  USER_INTERSTITIAL_ENABLED: 'user_interstitial_on',
  USER_LEARNING_LANG: 'user_learning_lang',
  USER_NATIVE_LANG: 'user_native_lang',
  USER_PLATFORM: 'user_platform',
  USER_TOXIC_ACK: 'user_toxic_ack',
} as const;

export const ANALYTICS_CUSTOM_DIMENSIONS = [
  'screen',
  'previous_screen',
  'origin',
  'ui_element',
  'ui_action',
  'flow',
  'status',
  'result',
  'reason',
  'source',
  'method',
  'modal',
  'app_state',
  'device_locale',
  'native_lang',
  'learning_lang',
  'helper_lang',
  'favorite_lang',
  'language_target',
  'previous_lang',
  'next_lang',
  'previous_status',
  'category',
  'phrase_id',
  'phrase_category',
  'phrase_type',
  'phrase_source',
  'phrase_tags',
  'is_custom',
  'is_favorite',
  'is_toxic',
  'has_safer_alt',
  'practice_mode',
  'attempt_result',
  'feedback_label',
  'permission_can_ask_again',
  'permission_status',
  'recognition_state',
  'prompt_type',
  'playback_rate',
  'audio_source',
  'tts_engine',
  'auto_listen',
  'reminder_copy_id',
  'search_context',
  'has_query',
  'ad_placement',
  'ad_format',
  'ad_result',
  'ad_gate_reason',
  'remote_config_key',
  'error_code',
  'error_name',
] as const;

export const ANALYTICS_CUSTOM_METRICS = [
  'elapsed_ms',
  'duration_ms',
  'query_length',
  'result_count',
  'phrase_count',
  'favorite_count',
  'custom_phrase_count',
  'available_count',
  'item_index',
  'total_count',
  'attempt_score',
  'expected_token_count',
  'spoken_token_count',
  'progress_pct',
  'ad_frequency',
  'policy_version',
  'input_length',
  'translated_length',
  'successful_count',
  'skipped_count',
  'error_count',
  'grace_remaining_ms',
  'first_launch_used_ms',
  'reminder_interval_days',
  'reminder_prompt_count',
  'reminder_schedule_count',
  'reminder_trigger_hour',
  'reminder_trigger_minute',
  'scheduled_for_ms',
] as const;

export const ANALYTICS_USER_PROPERTY_DEFINITIONS = Object.values(
  ANALYTICS_USER_PROPERTIES,
);

type AnalyticsBridge = typeof import('./firebase');

function getAnalyticsBridge(): AnalyticsBridge | null {
  try {
    return require('./firebase') as AnalyticsBridge;
  } catch {
    return null;
  }
}

function truncateAnalyticsString(value: string) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  return normalizedValue.length > MAX_STRING_VALUE_LENGTH
    ? normalizedValue.slice(0, MAX_STRING_VALUE_LENGTH)
    : normalizedValue;
}

function normalizeAnalyticsValue(value: AnalyticsPrimitive) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const nextValue = truncateAnalyticsString(value);

  return nextValue.length > 0 ? nextValue : undefined;
}

function validateAnalyticsName(name: string, kind: 'event' | 'param') {
  const maxLength =
    kind === 'event' ? MAX_EVENT_NAME_LENGTH : MAX_PARAM_NAME_LENGTH;

  return (
    name.length > 0 &&
    name.length <= maxLength &&
    /^[A-Za-z][A-Za-z0-9_]*$/.test(name) &&
    !name.startsWith('firebase_') &&
    !name.startsWith('ga_') &&
    !name.startsWith('google_') &&
    !name.startsWith('gtag.')
  );
}

function toAnalyticsParams(params: AnalyticsParams = {}) {
  const nextParams: Record<string, string | number> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (!validateAnalyticsName(key, 'param')) {
      if (__DEV__) {
        console.warn(`Invalid analytics parameter skipped: ${key}`);
      }

      return;
    }

    const normalizedValue = normalizeAnalyticsValue(value);

    if (normalizedValue !== undefined) {
      nextParams[key] = normalizedValue;
    }
  });

  const paramEntries = Object.entries(nextParams);

  if (paramEntries.length <= MAX_EVENT_PARAM_COUNT) {
    return nextParams;
  }

  if (__DEV__) {
    console.warn(
      `Analytics event exceeded ${MAX_EVENT_PARAM_COUNT} params. Extra params were skipped.`,
      paramEntries.map(([key]) => key),
    );
  }

  return Object.fromEntries(paramEntries.slice(0, MAX_EVENT_PARAM_COUNT));
}

export function toAnalyticsBoolean(value: boolean) {
  return value ? 'true' : 'false';
}

export function countAnalyticsTokens(value: string) {
  const normalizedValue = value
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return 0;
  }

  return normalizedValue.split(' ').filter(Boolean).length;
}

export function getAnalyticsCountBucket(count: number) {
  if (count <= 0) {
    return '0';
  }

  if (count <= 2) {
    return '1_2';
  }

  if (count <= 5) {
    return '3_5';
  }

  if (count <= 10) {
    return '6_10';
  }

  if (count <= 25) {
    return '11_25';
  }

  return '26_plus';
}

export function getErrorAnalyticsParams(error: unknown): AnalyticsParams {
  if (!error || typeof error !== 'object') {
    return {
      [ANALYTICS_PARAMS.ERROR_CODE]: 'unknown',
      [ANALYTICS_PARAMS.ERROR_NAME]: 'unknown',
    };
  }

  const candidate = error as {
    code?: unknown;
    name?: unknown;
  };

  return {
    [ANALYTICS_PARAMS.ERROR_CODE]:
      typeof candidate.code === 'string' ? candidate.code : 'unknown',
    [ANALYTICS_PARAMS.ERROR_NAME]:
      typeof candidate.name === 'string' ? candidate.name : 'Error',
  };
}

export function getPhraseAnalyticsParams(
  phrase: Phrase | null | undefined,
  nativeLanguage?: LanguageCode,
  learningLanguage?: LanguageCode,
): AnalyticsParams {
  if (!phrase) {
    return {};
  }

  const translation = learningLanguage
    ? phrase.translations[learningLanguage] ?? phrase.translations.en
    : phrase.translations.en;
  const phraseTags = (phrase.tags ?? []).slice(0, 6).join('|');
  const isCustom = phrase.category === 'custom';

  return {
    [ANALYTICS_PARAMS.HAS_SAFER_ALT]: toAnalyticsBoolean(
      Boolean(phrase.saferAlternative),
    ),
    [ANALYTICS_PARAMS.HELPER_LANG]: nativeLanguage,
    [ANALYTICS_PARAMS.IS_CUSTOM]: toAnalyticsBoolean(isCustom),
    [ANALYTICS_PARAMS.IS_TOXIC]: toAnalyticsBoolean(
      Boolean(phrase.isToxic || phrase.category === 'toxic'),
    ),
    [ANALYTICS_PARAMS.LEARNING_LANG]:
      phrase.customLanguages?.learning ?? learningLanguage,
    [ANALYTICS_PARAMS.NATIVE_LANG]:
      phrase.customLanguages?.native ?? nativeLanguage,
    [ANALYTICS_PARAMS.PHRASE_CATEGORY]: phrase.category,
    [ANALYTICS_PARAMS.PHRASE_ID]: isCustom ? CUSTOM_PHRASE_ID_VALUE : phrase.id,
    [ANALYTICS_PARAMS.PHRASE_SOURCE]: isCustom ? 'custom' : 'catalog',
    [ANALYTICS_PARAMS.PHRASE_TAGS]: phraseTags || undefined,
    [ANALYTICS_PARAMS.PHRASE_TYPE]: isCustom ? 'custom' : 'catalog',
    [ANALYTICS_PARAMS.INPUT_LENGTH]: translation.text.length,
    [ANALYTICS_PARAMS.EXPECTED_TOKEN_COUNT]: countAnalyticsTokens(
      translation.text,
    ),
  };
}

export async function trackAnalyticsEvent(
  eventName: string,
  params: AnalyticsParams = {},
) {
  if (!validateAnalyticsName(eventName, 'event')) {
    if (__DEV__) {
      console.warn(`Invalid analytics event skipped: ${eventName}`);
    }

    return;
  }

  try {
    const bridge = getAnalyticsBridge();

    if (!bridge?.logAnalyticsEvent) {
      return;
    }

    await bridge.logAnalyticsEvent(eventName, toAnalyticsParams(params));
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to log analytics event.', eventName, error);
    }
  }
}

export function trackScreenView(
  screenName: string,
  previousScreenName?: string,
) {
  const screenViewPromise = getAnalyticsBridge()?.logScreenView?.(screenName);

  screenViewPromise?.catch(() => undefined);

  trackAnalyticsEvent(ANALYTICS_EVENTS.SCREEN_VIEWED, {
    [ANALYTICS_PARAMS.PREVIOUS_SCREEN]: previousScreenName,
    [ANALYTICS_PARAMS.SCREEN]: screenName,
  }).catch(() => undefined);
}

export function setAnalyticsContext({
  adsPolicy,
  customPhraseCount,
  deviceLocale,
  favoriteCount,
  favoriteFilterLanguage,
  hasAcknowledgedToxicCategoryDisclosure,
  nativeLanguage,
  selectedLanguage,
}: {
  adsPolicy: AdsPolicy;
  customPhraseCount: number;
  deviceLocale: string | null | undefined;
  favoriteCount: number;
  favoriteFilterLanguage: LanguageCode;
  hasAcknowledgedToxicCategoryDisclosure: boolean;
  nativeLanguage: LanguageCode;
  selectedLanguage: LanguageCode;
}) {
  const defaultParams = toAnalyticsParams({
    [ANALYTICS_PARAMS.DEVICE_LOCALE]: deviceLocale ?? undefined,
    [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
    [ANALYTICS_PARAMS.LEARNING_LANG]: selectedLanguage,
    [ANALYTICS_PARAMS.NATIVE_LANG]: nativeLanguage,
  });
  const userProperties = {
    [ANALYTICS_USER_PROPERTIES.USER_ADS_ENABLED]: toAnalyticsBoolean(
      adsPolicy.adsEnabled,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_ADS_POLICY_VERSION]: String(
      adsPolicy.version,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_BANNER_ENABLED]: toAnalyticsBoolean(
      adsPolicy.bannerEnabled,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_CUSTOM_COUNT_BUCKET]:
      getAnalyticsCountBucket(customPhraseCount),
    [ANALYTICS_USER_PROPERTIES.USER_FAVORITE_COUNT_BUCKET]:
      getAnalyticsCountBucket(favoriteCount),
    [ANALYTICS_USER_PROPERTIES.USER_FAVORITE_LANG]: favoriteFilterLanguage,
    [ANALYTICS_USER_PROPERTIES.USER_HAS_CUSTOM_PHRASES]: toAnalyticsBoolean(
      customPhraseCount > 0,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_HAS_FAVORITES]: toAnalyticsBoolean(
      favoriteCount > 0,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_INTERSTITIAL_ENABLED]: toAnalyticsBoolean(
      adsPolicy.interstitialsEnabled,
    ),
    [ANALYTICS_USER_PROPERTIES.USER_LEARNING_LANG]: selectedLanguage,
    [ANALYTICS_USER_PROPERTIES.USER_NATIVE_LANG]: nativeLanguage,
    [ANALYTICS_USER_PROPERTIES.USER_PLATFORM]: Platform.OS,
    [ANALYTICS_USER_PROPERTIES.USER_TOXIC_ACK]: toAnalyticsBoolean(
      hasAcknowledgedToxicCategoryDisclosure,
    ),
  };

  const bridge = getAnalyticsBridge();
  const defaultParamsPromise =
    bridge?.setAnalyticsDefaultEventParameters?.(defaultParams);
  const userPropertiesPromise =
    bridge?.setAnalyticsUserProperties?.(userProperties);

  defaultParamsPromise?.catch(() => undefined);
  userPropertiesPromise?.catch(() => undefined);

  trackAnalyticsEvent(ANALYTICS_EVENTS.APP_CONTEXT_UPDATED, {
    [ANALYTICS_PARAMS.CUSTOM_PHRASE_COUNT]: customPhraseCount,
    [ANALYTICS_PARAMS.FAVORITE_COUNT]: favoriteCount,
    [ANALYTICS_PARAMS.FAVORITE_LANG]: favoriteFilterLanguage,
    [ANALYTICS_PARAMS.LEARNING_LANG]: selectedLanguage,
    [ANALYTICS_PARAMS.NATIVE_LANG]: nativeLanguage,
    [ANALYTICS_PARAMS.POLICY_VERSION]: adsPolicy.version,
  }).catch(() => undefined);
}
