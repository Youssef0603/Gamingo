import { useCallback, useEffect, useRef, useState } from 'react';

import { createDefaultPracticeDependencies } from './practiceServices';
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

const PRACTICE_DEBUG_PREFIX = '[practice]';
const AUDIO_TRANSITION_DELAY_MS = 180;
const EARLY_RESULT_COMMIT_DELAY_MS = 650;

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
  autoPlay?: boolean;
  dependencies?: Partial<PracticeDependencies>;
  locale?: string;
  onAttemptComplete?: (feedback: PracticeFeedback) => void;
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
  autoPlay = true,
  dependencies,
  locale,
  onAttemptComplete,
  phrase,
}: UsePracticeOptions) {
  const defaultDependenciesRef = useRef<PracticeDependencies | null>(null);
  const onAttemptCompleteRef = useRef<typeof onAttemptComplete>(onAttemptComplete);

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
    logPractice('play:start', { locale, phrase });
    setError(null);
    setIsPlaying(true);

    try {
      await speechRecognitionRef.current.stop();
      await textToSpeechRef.current.stop();
      await textToSpeechRef.current.speak({ language: locale, text: phrase });
      logPractice('play:complete', { locale, phrase });
    } catch (nextError) {
      logPractice('play:error', nextError);
      setError(getPracticeErrorMessage(nextError));
    } finally {
      setIsPlaying(false);
    }
  }, [locale, phrase]);

  const speakPhrase = useCallback(async () => {
    logPractice('attempt:start', { locale, phrase });
    setError(null);
    setFeedback(null);
    setHeardText('');
    const promptType = getSpeechPromptType(phrase);
    const shouldCommitEarly = shouldUseEarlyResultCommit(phrase);
    const normalizedExpectedPhrase = normalizePracticeText(phrase);
    const expectedTokenCount = countNormalizedTokens(phrase);

    await textToSpeechRef.current.stop();
    await speechRecognitionRef.current.stop();
    await wait(AUDIO_TRANSITION_DELAY_MS);

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let earlyCommitTimeout: ReturnType<typeof setTimeout> | null = null;
      let latestTranscript = '';

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
        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        speechRecognitionRef.current.stop().catch(() => undefined);

        const evaluation = evaluatePracticeAttempt(phrase, transcript);

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
        handleAttemptComplete(nextFeedback.label, nextFeedback);
        resolve();
      };

      const finalizeError = (nextError: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        applyPracticeError(nextError);
        reject(nextError);
      };

      const unsubscribeError = speechRecognitionRef.current.onError(nextError => {
        finalizeError(nextError);
      });
      const unsubscribeResult = speechRecognitionRef.current.onResult(result => {
        logPractice('attempt:result', result);
        const transcript = result.transcript.trim();

        if (!transcript || settled) {
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

      speechRecognitionRef.current
        .start({
          contextualStrings: [phrase],
          language: locale,
          promptType,
        })
        .catch(finalizeError);
    });
  }, [applyPracticeError, handleAttemptComplete, locale, phrase]);

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
      unsubscribePermission();
      unsubscribeState();
    };
  }, []);

  useEffect(() => {
    const speechRecognition = speechRecognitionRef.current;
    const textToSpeech = textToSpeechRef.current;
    let active = true;

    setFeedback(null);
    setHeardText('');
    setError(null);

    if (autoPlay) {
      (async () => {
        setIsPlaying(true);

        try {
          await speechRecognition.stop();
          await textToSpeech.stop();

          if (!active) {
            return;
          }

          await textToSpeech.speak({ language: locale, text: phrase });
        } catch (nextError) {
          if (active) {
            setError(getPracticeErrorMessage(nextError));
          }
        } finally {
          if (active) {
            setIsPlaying(false);
          }
        }
      })().catch(() => {
        if (active) {
          setIsPlaying(false);
        }
      });
    }

    return () => {
      active = false;
      textToSpeech.stop().catch(() => undefined);
      speechRecognition.stop().catch(() => undefined);
    };
  }, [autoPlay, locale, phrase]);

  return {
    error,
    feedback,
    heardText,
    isListening,
    isPlaying,
    isRequestingPermission,
    permissionStatus,
    playPhrase,
    speakPhrase,
    status,
  };
}
