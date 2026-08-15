import { useCallback, useEffect, useRef, useState } from 'react';

import { createDefaultPracticeDependencies } from './practiceServices';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  type AnalyticsParams,
  countAnalyticsTokens,
  getErrorAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import {
  type PracticeFeedbackLabel,
  evaluatePracticeAttempt,
  getPracticeFeedbackMessage,
  normalizePracticeText,
} from './practiceUtils';

import type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionPermissionStatus,
  SpeechRecognitionState,
} from '../../services';
import type { PracticeDependencies } from './practiceServices';
import type { PracticeEvaluation } from './practiceUtils';
import type { LanguageCode } from '../../types/language';

const PRACTICE_DEBUG_PREFIX = '[practice]';
const AUDIO_TRANSITION_DELAY_MS = 180;
const EARLY_RESULT_COMMIT_DELAY_MS = 650;
const EMPTY_ANALYTICS_CONTEXT: AnalyticsParams = {};

function logPractice(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`${PRACTICE_DEBUG_PREFIX} ${message}`);
    return;
  }

  console.log(`${PRACTICE_DEBUG_PREFIX} ${message}`, payload);
}

function wait(durationMs: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, durationMs);
  });
}

export type PracticeFeedback = PracticeEvaluation & {
  message: string;
};

type UsePracticeOptions = {
  analyticsContext?: AnalyticsParams;
  dependencies?: Partial<PracticeDependencies>;
  languageCode?: LanguageCode;
  locale?: string;
  onAttemptComplete?: (feedback: PracticeFeedback) => void;
  phraseId?: string;
  phrase: string;
};

export type PracticeStatus =
  | 'idle'
  | 'listening'
  | 'playing'
  | 'requesting-permission';

function toFeedback(evaluation: PracticeEvaluation): PracticeFeedback {
  return {
    ...evaluation,
    message: getPracticeFeedbackMessage(evaluation.label),
  };
}

function mapRecognitionStateToStatus(
  state: SpeechRecognitionState,
): Exclude<PracticeStatus, 'playing'> {
  if (state === 'requesting-permission') {
    return 'requesting-permission';
  }

  if (state === 'listening') {
    return 'listening';
  }

  return 'idle';
}

function getPracticeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Speech recognition failed. Please try again.';
}

function getPermissionStatusFromError(
  code?: SpeechRecognitionErrorCode,
): SpeechRecognitionPermissionStatus | null {
  if (code === 'permission-denied') {
    return 'denied';
  }

  if (code === 'permission-blocked') {
    return 'blocked';
  }

  if (code === 'unavailable') {
    return 'unavailable';
  }

  return null;
}

function getRecognitionErrorCode(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code as SpeechRecognitionErrorCode;
  }

  return null;
}

function shouldRecordFailedAttempt(code: SpeechRecognitionErrorCode | null) {
  return code === 'no-speech';
}

function getSpeechPromptType(phrase: string): 'default' | 'short-utterance' {
  const normalizedPhrase = normalizePracticeText(phrase);

  if (!normalizedPhrase) {
    return 'default';
  }

  return normalizedPhrase.split(' ').length <= 1
    ? 'short-utterance'
    : 'default';
}

function shouldUseEarlyResultCommit(phrase: string) {
  const normalizedPhrase = normalizePracticeText(phrase);

  if (!normalizedPhrase) {
    return false;
  }

  return normalizedPhrase.split(' ').length <= 4;
}

function countNormalizedTokens(value: string) {
  const normalizedValue = normalizePracticeText(value);

  if (!normalizedValue) {
    return 0;
  }

  return normalizedValue.split(' ').filter(Boolean).length;
}

export function usePractice({
  analyticsContext = EMPTY_ANALYTICS_CONTEXT,
  dependencies,
  languageCode,
  locale,
  onAttemptComplete,
  phraseId,
  phrase,
}: UsePracticeOptions) {
  const defaultDependenciesRef = useRef<PracticeDependencies | null>(null);
  const onAttemptCompleteRef = useRef<typeof onAttemptComplete>(onAttemptComplete);
  const playbackRequestIdRef = useRef(0);
  const attemptRequestIdRef = useRef(0);

  if (!defaultDependenciesRef.current) {
    defaultDependenciesRef.current = createDefaultPracticeDependencies();
  }

  onAttemptCompleteRef.current = onAttemptComplete;

  const speechRecognitionRef = useRef(
    dependencies?.speechRecognition ??
      defaultDependenciesRef.current.speechRecognition,
  );
  const textToSpeechRef = useRef(
    dependencies?.textToSpeech ?? defaultDependenciesRef.current.textToSpeech,
  );

  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [heardText, setHeardText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<SpeechRecognitionPermissionStatus>(
      speechRecognitionRef.current.getPermissionStatus(),
    );
  const [recognitionState, setRecognitionState] = useState<SpeechRecognitionState>(
    speechRecognitionRef.current.getState(),
  );

  const isListening = recognitionState === 'listening';
  const isRequestingPermission = recognitionState === 'requesting-permission';
  const status: PracticeStatus = isPlaying
    ? 'playing'
    : mapRecognitionStateToStatus(recognitionState);

  const handleAttemptComplete = useCallback((
    label: PracticeFeedbackLabel,
    feedbackOverride?: PracticeFeedback,
  ) => {
    const nextFeedback =
      feedbackOverride ??
      toFeedback({
        expectedText: phrase,
        label,
        normalizedExpected: '',
        normalizedSpoken: '',
        score: 0,
        spokenText: '',
      });

    onAttemptCompleteRef.current?.(nextFeedback);
  }, [phrase]);

  const applyPracticeError = useCallback((nextError: unknown) => {
    const errorMessage = getPracticeErrorMessage(nextError);
    const evaluation = evaluatePracticeAttempt(phrase, '');
    const errorCode = getRecognitionErrorCode(nextError);
    const nextPermissionStatus =
      nextError &&
      typeof nextError === 'object' &&
      'code' in nextError &&
      typeof nextError.code === 'string'
        ? getPermissionStatusFromError(nextError.code as SpeechRecognitionErrorCode)
        : null;

    if (nextPermissionStatus) {
      setPermissionStatus(nextPermissionStatus);
    }

    logPractice('attempt:error', {
      error: nextError,
      errorCode,
      errorMessage,
      phrase,
    });

    setHeardText('');
    setError(errorMessage);
    const nextFeedback = {
      ...evaluation,
      label: 'Try again',
      message: errorMessage,
    } satisfies PracticeFeedback;

    setFeedback(nextFeedback);

    if (shouldRecordFailedAttempt(errorCode)) {
      handleAttemptComplete(nextFeedback.label, nextFeedback);
    }
  }, [handleAttemptComplete, phrase]);

  const playPhrase = useCallback(async () => {
    const playbackRequestId = playbackRequestIdRef.current + 1;
    const startedAt = Date.now();

    playbackRequestIdRef.current = playbackRequestId;
    logPractice('play:start', { locale, phrase });
    trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_AUDIO_REQUESTED, {
      ...analyticsContext,
      [ANALYTICS_PARAMS.AUDIO_SOURCE]: 'phrase_playback',
      [ANALYTICS_PARAMS.INPUT_LENGTH]: phrase.length,
      [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
      [ANALYTICS_PARAMS.TTS_ENGINE]: 'app_tts',
    }).catch(() => undefined);
    setError(null);
    setIsPlaying(true);

    try {
      await speechRecognitionRef.current.stop();

      if (playbackRequestId !== playbackRequestIdRef.current) {
        return;
      }

      await textToSpeechRef.current.stop();

      if (playbackRequestId !== playbackRequestIdRef.current) {
        return;
      }

      await textToSpeechRef.current.speak({
        language: locale,
        languageCode,
        phraseId,
        text: phrase,
      });

      if (playbackRequestId !== playbackRequestIdRef.current) {
        return;
      }

      logPractice('play:complete', { locale, phrase });
      trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_AUDIO_COMPLETED, {
        ...analyticsContext,
        [ANALYTICS_PARAMS.AUDIO_SOURCE]: 'phrase_playback',
        [ANALYTICS_PARAMS.DURATION_MS]: Date.now() - startedAt,
        [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
        [ANALYTICS_PARAMS.TTS_ENGINE]: 'app_tts',
      }).catch(() => undefined);
    } catch (nextError) {
      if (playbackRequestId !== playbackRequestIdRef.current) {
        return;
      }

      logPractice('play:error', nextError);
      trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_AUDIO_FAILED, {
        ...analyticsContext,
        ...getErrorAnalyticsParams(nextError),
        [ANALYTICS_PARAMS.AUDIO_SOURCE]: 'phrase_playback',
        [ANALYTICS_PARAMS.DURATION_MS]: Date.now() - startedAt,
        [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
        [ANALYTICS_PARAMS.TTS_ENGINE]: 'app_tts',
      }).catch(() => undefined);
      setError(getPracticeErrorMessage(nextError));
    } finally {
      if (playbackRequestId === playbackRequestIdRef.current) {
        setIsPlaying(false);
      }
    }
  }, [analyticsContext, languageCode, locale, phrase, phraseId]);

  const speakPhrase = useCallback(async () => {
    const attemptRequestId = attemptRequestIdRef.current + 1;
    const startedAt = Date.now();

    attemptRequestIdRef.current = attemptRequestId;
    logPractice('attempt:start', { locale, phrase });
    setError(null);
    setFeedback(null);
    setHeardText('');
    const promptType = getSpeechPromptType(phrase);
    const shouldCommitEarly = shouldUseEarlyResultCommit(phrase);
    const normalizedExpectedPhrase = normalizePracticeText(phrase);
    const expectedTokenCount = countNormalizedTokens(phrase);

    trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_LISTEN_STARTED, {
      ...analyticsContext,
      [ANALYTICS_PARAMS.EXPECTED_TOKEN_COUNT]: expectedTokenCount,
      [ANALYTICS_PARAMS.INPUT_LENGTH]: phrase.length,
      [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
      [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
      [ANALYTICS_PARAMS.PROMPT_TYPE]: promptType,
    }).catch(() => undefined);

    await textToSpeechRef.current.stop();

    if (attemptRequestId !== attemptRequestIdRef.current) {
      return;
    }

    await speechRecognitionRef.current.stop();

    if (attemptRequestId !== attemptRequestIdRef.current) {
      return;
    }

    await wait(AUDIO_TRANSITION_DELAY_MS);

    if (attemptRequestId !== attemptRequestIdRef.current) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let earlyCommitTimeout: ReturnType<typeof setTimeout> | null = null;
      let latestTranscript = '';
      let unsubscribeError: () => void = () => undefined;
      let unsubscribeResult: () => void = () => undefined;

      const isAttemptActive = () =>
        attemptRequestId === attemptRequestIdRef.current;

      const clearEarlyCommitTimeout = () => {
        if (!earlyCommitTimeout) {
          return;
        }

        clearTimeout(earlyCommitTimeout);
        earlyCommitTimeout = null;
      };

      const cleanup = () => {
        clearEarlyCommitTimeout();
        unsubscribeError();
        unsubscribeResult();
      };

      const finalizeTranscript = (transcript: string) => {
        if (settled || !isAttemptActive()) {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
          return;
        }

        settled = true;
        cleanup();

        speechRecognitionRef.current.stop().catch(() => undefined);

        const evaluation = evaluatePracticeAttempt(phrase, transcript);
        const spokenTokenCount = countAnalyticsTokens(transcript);

        setPermissionStatus('granted');
        setError(null);
        setHeardText(transcript);
        const nextFeedback = toFeedback(evaluation);

        logPractice('attempt:evaluation', {
          evaluation,
          locale,
          phrase,
          transcript,
        });

        setFeedback(nextFeedback);
        trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_ATTEMPT_COMPLETED, {
          ...analyticsContext,
          [ANALYTICS_PARAMS.ATTEMPT_RESULT]: nextFeedback.label
            .toLowerCase()
            .replace(/\s+/g, '_'),
          [ANALYTICS_PARAMS.ATTEMPT_SCORE]: nextFeedback.score,
          [ANALYTICS_PARAMS.DURATION_MS]: Date.now() - startedAt,
          [ANALYTICS_PARAMS.EXPECTED_TOKEN_COUNT]: expectedTokenCount,
          [ANALYTICS_PARAMS.FEEDBACK_LABEL]: nextFeedback.label,
          [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
          [ANALYTICS_PARAMS.PERMISSION_STATUS]: 'granted',
          [ANALYTICS_PARAMS.SPOKEN_TOKEN_COUNT]: spokenTokenCount,
        }).catch(() => undefined);
        handleAttemptComplete(nextFeedback.label, nextFeedback);
        resolve();
      };

      const finalizeError = (nextError: unknown) => {
        if (settled || !isAttemptActive()) {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
          return;
        }

        settled = true;
        cleanup();
        trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_ATTEMPT_FAILED, {
          ...analyticsContext,
          ...getErrorAnalyticsParams(nextError),
          [ANALYTICS_PARAMS.DURATION_MS]: Date.now() - startedAt,
          [ANALYTICS_PARAMS.EXPECTED_TOKEN_COUNT]: expectedTokenCount,
          [ANALYTICS_PARAMS.LEARNING_LANG]: languageCode,
          [ANALYTICS_PARAMS.PERMISSION_STATUS]: permissionStatus,
          [ANALYTICS_PARAMS.PROMPT_TYPE]: promptType,
        }).catch(() => undefined);
        applyPracticeError(nextError);
        reject(nextError);
      };

      unsubscribeError = speechRecognitionRef.current.onError(nextError => {
        finalizeError(nextError);
      });
      unsubscribeResult = speechRecognitionRef.current.onResult(result => {
        logPractice('attempt:result', result);
        const transcript = result.transcript.trim();

        if (!transcript || settled || !isAttemptActive()) {
          return;
        }

        latestTranscript = transcript;
        const normalizedTranscript = normalizePracticeText(transcript);
        const transcriptTokenCount = countNormalizedTokens(transcript);
        const isExactNormalizedMatch =
          Boolean(normalizedExpectedPhrase) &&
          normalizedTranscript === normalizedExpectedPhrase;
        const shouldAcceptImmediately =
          isExactNormalizedMatch ||
          (promptType === 'short-utterance' && Boolean(transcript));

        if (result.isFinal || shouldAcceptImmediately) {
          finalizeTranscript(transcript);
          return;
        }

        if (
          !shouldCommitEarly ||
          transcriptTokenCount < expectedTokenCount
        ) {
          return;
        }

        clearEarlyCommitTimeout();
        earlyCommitTimeout = setTimeout(() => {
          if (!latestTranscript || settled) {
            return;
          }

          logPractice('attempt:early-commit', {
            latestTranscript,
            locale,
            phrase,
          });
          finalizeTranscript(latestTranscript);
        }, EARLY_RESULT_COMMIT_DELAY_MS);
      });

      if (!isAttemptActive()) {
        settled = true;
        cleanup();
        resolve();
        return;
      }

      speechRecognitionRef.current
        .start({
          contextualStrings: [phrase],
          language: locale,
          promptType,
        })
        .catch(finalizeError);
    });
  }, [
    analyticsContext,
    applyPracticeError,
    handleAttemptComplete,
    languageCode,
    locale,
    permissionStatus,
    phrase,
  ]);

  const invalidatePractice = useCallback(() => {
    playbackRequestIdRef.current += 1;
    attemptRequestIdRef.current += 1;
    setIsPlaying(false);
  }, []);

  const cancelPractice = useCallback(async () => {
    invalidatePractice();

    await Promise.allSettled([
      textToSpeechRef.current.stop(),
      speechRecognitionRef.current.stop(),
    ]);
  }, [invalidatePractice]);

  useEffect(() => {
    const speechRecognition = speechRecognitionRef.current;

    const unsubscribeState = speechRecognition.onStateChange(nextState => {
      logPractice('recognition:state', nextState);
      setRecognitionState(nextState);
    });
    const unsubscribePermission = speechRecognition.onPermissionChange(
      nextPermissionStatus => {
        logPractice('recognition:permission', nextPermissionStatus);
        setPermissionStatus(nextPermissionStatus);
      },
    );

    return () => {
      invalidatePractice();
      unsubscribePermission();
      unsubscribeState();
    };
  }, [invalidatePractice]);

  useEffect(() => {
    invalidatePractice();
    setFeedback(null);
    setHeardText('');
    setError(null);
  }, [invalidatePractice, locale, phrase]);

  return {
    cancelPractice,
    error,
    feedback,
    heardText,
    invalidatePractice,
    isListening,
    isPlaying,
    isRequestingPermission,
    permissionStatus,
    playPhrase,
    speakPhrase,
    status,
  };
}
