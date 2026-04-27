import {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

import {
  SpeechRecognitionError,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionPermissionStatus,
  type SpeechRecognitionStartOptions,
} from './speechRecognition';

const SPEECH_RECOGNITION_DEBUG_PREFIX = '[practice][speech]';

function logSpeech(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`${SPEECH_RECOGNITION_DEBUG_PREFIX} ${message}`);
    return;
  }

  console.log(`${SPEECH_RECOGNITION_DEBUG_PREFIX} ${message}`, payload);
}

function mapPermissionStatus(
  response: Awaited<
    ReturnType<typeof ExpoSpeechRecognitionModule.requestPermissionsAsync>
  >,
): SpeechRecognitionPermissionStatus {
  if (response.granted) {
    return 'granted';
  }

  if (response.restricted) {
    return 'blocked';
  }

  if (response.status === 'denied') {
    return response.canAskAgain ? 'denied' : 'blocked';
  }

  return 'unknown';
}

function mapNativeError(
  event: ExpoSpeechRecognitionErrorEvent,
): SpeechRecognitionError {
  switch (event.error) {
    case 'aborted':
      return new SpeechRecognitionError('aborted', 'Speech listening was cancelled.');
    case 'audio-capture':
      return new SpeechRecognitionError(
        'audio-capture',
        event.message || 'Microphone audio could not be captured.',
      );
    case 'busy':
      return new SpeechRecognitionError(
        'busy',
        event.message || 'Speech recognition is already in use.',
      );
    case 'language-not-supported':
      return new SpeechRecognitionError(
        'language-not-supported',
        event.message || 'This language is not supported by speech recognition.',
      );
    case 'network':
      return new SpeechRecognitionError(
        'network',
        event.message || 'A speech service network error occurred.',
      );
    case 'no-speech':
    case 'speech-timeout':
      return new SpeechRecognitionError(
        'no-speech',
        event.message || 'No speech was detected.',
      );
    case 'not-allowed':
      return new SpeechRecognitionError(
        'permission-denied',
        event.message || 'Microphone permission was denied.',
      );
    case 'service-not-allowed':
      return new SpeechRecognitionError(
        'unavailable',
        event.message || 'Speech recognition is unavailable on this device.',
      );
    default:
      return new SpeechRecognitionError(
        'unknown',
        event.message || `Speech recognition failed with "${event.error}".`,
      );
  }
}

function toNativeStartOptions(startOptions?: SpeechRecognitionStartOptions) {
  const isShortUtterance = startOptions?.promptType === 'short-utterance';

  return {
    androidIntentOptions: isShortUtterance
      ? {
          EXTRA_LANGUAGE_MODEL: 'web_search' as const,
        }
      : undefined,
    contextualStrings: startOptions?.contextualStrings,
    continuous: false,
    interimResults: true,
    iosCategory: {
      category: AVAudioSessionCategory.playAndRecord,
      categoryOptions: [
        AVAudioSessionCategoryOptions.defaultToSpeaker,
        AVAudioSessionCategoryOptions.allowBluetooth,
      ],
      mode: AVAudioSessionMode.measurement,
    },
    iosTaskHint: isShortUtterance ? ('confirmation' as const) : undefined,
    iosVoiceProcessingEnabled: true,
    lang: startOptions?.language,
    maxAlternatives: 1,
    volumeChangeEventOptions: {
      enabled: true,
      intervalMillis: 150,
    },
  };
}

export function createPlatformSpeechRecognitionAdapter(): SpeechRecognitionAdapter {
  let activeSubscriptions: Array<{ remove: () => void }> = [];

  const clearSubscriptions = () => {
    activeSubscriptions.forEach(subscription => {
      subscription.remove();
    });
    activeSubscriptions = [];
  };

  return {
    isAvailable() {
      try {
        return ExpoSpeechRecognitionModule.isRecognitionAvailable();
      } catch {
        return false;
      }
    },
    async requestPermission(
      _options,
    ): Promise<SpeechRecognitionPermissionStatus> {
      try {
        const response = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        logSpeech('permission:response', response);
        const permissionStatus = mapPermissionStatus(response);

        if (permissionStatus !== 'granted') {
          return permissionStatus;
        }

        return ExpoSpeechRecognitionModule.isRecognitionAvailable()
          ? 'granted'
          : 'unavailable';
      } catch (error) {
        throw error instanceof Error
          ? new SpeechRecognitionError('unknown', error.message)
          : new SpeechRecognitionError(
              'unknown',
              'Speech recognition permissions could not be requested.',
            );
      }
    },
    async start({ emitError, emitResult, emitStateChange, startOptions }) {
      return new Promise<void>((resolve, reject) => {
        let hasResolved = false;
        let hasRequestedEarlyStop = false;
        let hasStarted = false;
        let isSettled = false;
        let lastTranscript = '';
        const isShortUtterance = startOptions?.promptType === 'short-utterance';
        const nativeStartOptions = toNativeStartOptions(startOptions);

        const finalizeError = (event: ExpoSpeechRecognitionErrorEvent) => {
          if (isSettled) {
            return;
          }

          if (
            !hasStarted &&
            (event.error === 'aborted' ||
              event.error === 'no-speech' ||
              event.error === 'speech-timeout')
          ) {
            logSpeech('event:error:ignored-before-start', event);
            return;
          }

          isSettled = true;
          clearSubscriptions();
          emitStateChange('idle');
          const nextError = mapNativeError(event);
          logSpeech('event:error', event);
          emitError(nextError);

          if (!hasResolved) {
            reject(nextError);
          }
        };

        const finalizeNoSpeech = (message: string) => {
          finalizeError({
            error: 'no-speech',
            message,
          });
        };

        logSpeech('start:requested', {
          nativeStartOptions,
          startOptions,
        });

        activeSubscriptions = [
          ExpoSpeechRecognitionModule.addListener('start', () => {
            hasStarted = true;
            logSpeech('event:start');
            emitStateChange('listening');

            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }
          }),
          ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
            logSpeech('event:result', event);
            const transcript = event.results[0]?.transcript?.trim() ?? '';

            if (!transcript) {
              if (event.isFinal) {
                finalizeNoSpeech('No speech was detected.');
              }
              return;
            }

            lastTranscript = transcript;
            emitResult({
              isFinal: event.isFinal,
              transcript,
            });

            if (
              !event.isFinal &&
              isShortUtterance &&
              !hasRequestedEarlyStop
            ) {
              hasRequestedEarlyStop = true;
              logSpeech('result:auto-stop-short-utterance', { transcript });

              try {
                ExpoSpeechRecognitionModule.stop();
              } catch (error) {
                logSpeech('result:auto-stop-short-utterance:error', error);
              }
            }
          }),
          ExpoSpeechRecognitionModule.addListener('nomatch', () => {
            logSpeech('event:nomatch');
            finalizeNoSpeech('No close speech match was detected.');
          }),
          ExpoSpeechRecognitionModule.addListener('audiostart', event => {
            logSpeech('event:audiostart', event);
          }),
          ExpoSpeechRecognitionModule.addListener('audioend', event => {
            logSpeech('event:audioend', event);
          }),
          ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => {
            finalizeError(event);
          }),
          ExpoSpeechRecognitionModule.addListener('speechstart', event => {
            logSpeech('event:speechstart', event);
          }),
          ExpoSpeechRecognitionModule.addListener('speechend', event => {
            logSpeech('event:speechend', event);
          }),
          ExpoSpeechRecognitionModule.addListener('volumechange', event => {
            logSpeech('event:volumechange', event);
          }),
          ExpoSpeechRecognitionModule.addListener('end', () => {
            if (!hasStarted && !lastTranscript) {
              logSpeech('event:end:ignored-before-start');
              return;
            }

            logSpeech('event:end', { hasStarted, lastTranscript });
            clearSubscriptions();
            emitStateChange('idle');

            if (!hasResolved) {
              hasResolved = true;
              resolve();
            }

            if (!isSettled && !lastTranscript) {
              finalizeNoSpeech('No speech was detected.');
            }
          }),
        ];

        try {
          ExpoSpeechRecognitionModule.start(nativeStartOptions);
        } catch (error) {
          clearSubscriptions();
          logSpeech('start:throw', error);
          reject(
            error instanceof Error
              ? error
              : new SpeechRecognitionError(
                  'unknown',
                  'Speech recognition failed to start.',
                ),
          );
        }
      });
    },
    async stop() {
      clearSubscriptions();

      try {
        logSpeech('stop');
        ExpoSpeechRecognitionModule.stop();
      } catch {
        return;
      }
    },
  };
}
