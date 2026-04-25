import { useEffect, useRef, useState } from 'react';

import { createDefaultPracticeDependencies } from './practiceServices';
import {
  type PracticeFeedbackLabel,
  evaluatePracticeAttempt,
  getPracticeFeedbackMessage,
} from './practiceUtils';

import type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionPermissionStatus,
  SpeechRecognitionState,
} from '../../services';
import type { PracticeDependencies } from './practiceServices';
import type { PracticeEvaluation } from './practiceUtils';

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

  const handleAttemptComplete = (
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
  };

  const applyPracticeError = (nextError: unknown) => {
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
  };

  async function playPhrase() {
    setError(null);
    setIsPlaying(true);

    try {
      await speechRecognitionRef.current.stop();
      await textToSpeechRef.current.stop();
      await textToSpeechRef.current.speak({ language: locale, text: phrase });
    } catch (nextError) {
      setError(getPracticeErrorMessage(nextError));
    } finally {
      setIsPlaying(false);
    }
  }

  async function speakPhrase() {
    setError(null);
    setFeedback(null);
    setHeardText('');

    await textToSpeechRef.current.stop();
    await speechRecognitionRef.current.stop();

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        unsubscribeError();
        unsubscribeResult();
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
        if (!result.isFinal || settled) {
          return;
        }

        settled = true;
        cleanup();

        const transcript = result.transcript.trim();
        const evaluation = evaluatePracticeAttempt(phrase, transcript);

        setPermissionStatus('granted');
        setError(null);
        setHeardText(transcript);
        const nextFeedback = toFeedback(evaluation);

        setFeedback(nextFeedback);
        handleAttemptComplete(nextFeedback.label, nextFeedback);
        resolve();
      });

      speechRecognitionRef.current.start(locale).catch(finalizeError);
    });
  }

  useEffect(() => {
    const speechRecognition = speechRecognitionRef.current;

    const unsubscribeState = speechRecognition.onStateChange(nextState => {
      setRecognitionState(nextState);
    });
    const unsubscribePermission = speechRecognition.onPermissionChange(
      nextPermissionStatus => {
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
