import { Platform } from 'react-native';
import Tts from 'react-native-tts';

import { phraseAudioPlaybackService } from './phraseAudioPlayback.native';

import type { TextToSpeechAdapter, TextToSpeechRequest } from './textToSpeech';

const TTS_DEBUG_PREFIX = '[practice][tts]';
const SLOW_TTS_RATE = 0.35;
type TtsEventName = 'tts-cancel' | 'tts-error' | 'tts-finish';
type TtsSubscription = { remove: () => void };
type TtsSpeakOptions = {
  rate?: number;
};

function logTts(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`${TTS_DEBUG_PREFIX} ${message}`);
    return;
  }

  console.log(`${TTS_DEBUG_PREFIX} ${message}`, payload);
}

function addTtsListener(
  eventName: TtsEventName,
  handler: (event: { utteranceId: string | number }) => void,
): TtsSubscription {
  return (
    Tts as unknown as {
      addEventListener: (
        type: TtsEventName,
        listener: (event: { utteranceId: string | number }) => void,
      ) => TtsSubscription;
    }
  ).addEventListener(eventName, handler);
}

async function stopNativeSpeechSafely() {
  await Tts.stop(false);
}

async function configureIosSpeechPlayback() {
  if (Platform.OS !== 'ios') {
    return;
  }

  await Tts.setIgnoreSilentSwitch('ignore');
}

export function createPlatformTextToSpeechAdapter(): TextToSpeechAdapter {
  return {
    isAvailable() {
      return true;
    },
    async speak({
      language,
      languageCode,
      phraseId,
      rate,
      text,
    }: TextToSpeechRequest) {
      const handledByPhraseAudio = await phraseAudioPlaybackService.play({
        languageCode,
        phraseId,
        rate,
      });

      if (handledByPhraseAudio) {
        logTts('speak:phrase-audio', { languageCode, phraseId, rate, text });
        return;
      }

      await Tts.getInitStatus();
      await configureIosSpeechPlayback();

      if (language) {
        try {
          await Tts.setDefaultLanguage(language);
        } catch {
          // Fall back to the system default voice when the requested locale is unavailable.
        }
      }

      await new Promise<void>((resolve, reject) => {
        let activeUtteranceId: string | number | null = null;
        let activeSubscriptions: TtsSubscription[] = [];
        let pendingTerminalEvent:
          | {
              event: { utteranceId: string | number };
              type: 'cancel' | 'error' | 'finish';
            }
          | null = null;

        const cleanup = () => {
          activeSubscriptions.forEach(subscription => {
            subscription.remove();
          });
          activeSubscriptions = [];
        };

        const finalizeSuccess = (
          type: 'cancel' | 'finish',
          event: { utteranceId: string | number },
        ) => {
          cleanup();
          logTts(`speak:${type}`, event);
          resolve();
        };

        const finalizeError = (event: { utteranceId: string | number }) => {
          cleanup();
          logTts('speak:error', event);
          reject(new Error('Text to speech failed.'));
        };

        const isMatchingUtterance = (event: { utteranceId: string | number }) =>
          activeUtteranceId !== null &&
          String(event.utteranceId) === String(activeUtteranceId);

        const queuePendingTerminalEvent = (
          type: 'cancel' | 'error' | 'finish',
          event: { utteranceId: string | number },
        ) => {
          pendingTerminalEvent = { event, type };
        };

        const flushPendingTerminalEvent = () => {
          if (!pendingTerminalEvent) {
            return;
          }

          const { event, type } = pendingTerminalEvent;

          if (!isMatchingUtterance(event)) {
            return;
          }

          pendingTerminalEvent = null;

          if (type === 'error') {
            finalizeError(event);
            return;
          }

          finalizeSuccess(type, event);
        };

        const handleFinish = (event: { utteranceId: string | number }) => {
          if (activeUtteranceId === null) {
            queuePendingTerminalEvent('finish', event);
            return;
          }

          if (!isMatchingUtterance(event)) {
            return;
          }

          finalizeSuccess('finish', event);
        };

        const handleCancel = (event: { utteranceId: string | number }) => {
          if (activeUtteranceId === null) {
            queuePendingTerminalEvent('cancel', event);
            return;
          }

          if (!isMatchingUtterance(event)) {
            return;
          }

          finalizeSuccess('cancel', event);
        };

        const handleError = (event: { utteranceId: string | number }) => {
          if (activeUtteranceId === null) {
            queuePendingTerminalEvent('error', event);
            return;
          }

          if (!isMatchingUtterance(event)) {
            return;
          }

          finalizeError(event);
        };

        activeSubscriptions = [
          addTtsListener('tts-finish', handleFinish),
          addTtsListener('tts-cancel', handleCancel),
          addTtsListener('tts-error', handleError),
        ];

        Promise.resolve(
          Tts.speak(
            text,
            (rate === 'slow'
              ? { rate: SLOW_TTS_RATE }
              : {}) as TtsSpeakOptions as never,
          ),
        )
          .then(utteranceId => {
            activeUtteranceId = utteranceId;
            logTts('speak:start', { language, rate, text, utteranceId });
            flushPendingTerminalEvent();
          })
          .catch(error => {
            cleanup();
            logTts('speak:start-error', error);
            reject(
              error instanceof Error
                ? error
                : new Error('Text to speech failed to start.'),
            );
          });
      });
    },
    async stop() {
      logTts('stop');
      await Promise.allSettled([
        phraseAudioPlaybackService.stop(),
        stopNativeSpeechSafely(),
      ]);
    },
  };
}
