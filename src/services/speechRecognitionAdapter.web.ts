import {
  SpeechRecognitionError,
  type SpeechRecognitionAdapter,
  type SpeechRecognitionPermissionStatus,
  type SpeechRecognitionState,
} from './speechRecognition';

type WebSpeechRecognitionAlternative = {
  transcript?: string;
};

type WebSpeechRecognitionResultList = ArrayLike<
  ArrayLike<WebSpeechRecognitionAlternative>
>;

type WebSpeechRecognitionResultEvent = {
  results: WebSpeechRecognitionResultList;
};

type WebSpeechRecognitionErrorEvent = {
  error?: string;
};

type WebSpeechRecognition = {
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang?: string;
  maxAlternatives: number;
  onend: null | (() => void);
  onerror: null | ((event: WebSpeechRecognitionErrorEvent) => void);
  onnomatch: null | (() => void);
  onresult: null | ((event: WebSpeechRecognitionResultEvent) => void);
  onstart: null | (() => void);
  start: () => void;
};

type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

function getWebSpeechRecognitionConstructor() {
  const scope = globalThis as {
    SpeechRecognition?: WebSpeechRecognitionConstructor;
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function mapBrowserErrorCode(code?: string) {
  switch (code) {
    case 'aborted':
      return new SpeechRecognitionError(
        'aborted',
        'Speech listening was cancelled.',
      );
    case 'audio-capture':
      return new SpeechRecognitionError(
        'audio-capture',
        'Microphone audio could not be captured.',
      );
    case 'network':
      return new SpeechRecognitionError(
        'network',
        'A speech service network error occurred.',
      );
    case 'not-allowed':
      return new SpeechRecognitionError(
        'permission-denied',
        'Microphone permission was denied.',
      );
    case 'service-not-allowed':
      return new SpeechRecognitionError(
        'permission-blocked',
        'Microphone access is blocked. Enable it in system settings.',
      );
    default:
      return new SpeechRecognitionError(
        'unknown',
        code
          ? `Speech recognition failed with "${code}".`
          : 'Speech recognition failed.',
      );
  }
}

export function createPlatformSpeechRecognitionAdapter(): SpeechRecognitionAdapter {
  const Recognition = getWebSpeechRecognitionConstructor();
  let activeRecognition: WebSpeechRecognition | null = null;

  return {
    isAvailable() {
      return Boolean(Recognition);
    },
    async requestPermission(): Promise<SpeechRecognitionPermissionStatus> {
      return Recognition ? 'granted' : 'unavailable';
    },
    async start({ emitError, emitResult, emitStateChange, language }) {
      if (!Recognition) {
        throw new SpeechRecognitionError(
          'unavailable',
          'Speech recognition is unavailable in this environment.',
        );
      }

      await this.stop();

      return new Promise<void>((resolve, reject) => {
        const recognition = new Recognition();
        let transcript = '';
        let settled = false;

        activeRecognition = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        if (language) {
          recognition.lang = language;
        }

        const cleanup = () => {
          recognition.onend = null;
          recognition.onerror = null;
          recognition.onnomatch = null;
          recognition.onresult = null;
          recognition.onstart = null;

          if (activeRecognition === recognition) {
            activeRecognition = null;
          }
        };

        const finishListening = () => {
          emitStateChange('idle');
          cleanup();
        };

        recognition.onstart = () => {
          emitStateChange('listening' satisfies SpeechRecognitionState);
          resolve();
        };

        recognition.onresult = (event: WebSpeechRecognitionResultEvent) => {
          const lastResult = event.results[event.results.length - 1];
          const nextTranscript = lastResult?.[0]?.transcript?.trim() ?? '';

          if (!nextTranscript || settled) {
            return;
          }

          transcript = nextTranscript;
          settled = true;
          finishListening();
          emitResult({ isFinal: true, transcript: nextTranscript });
        };

        recognition.onnomatch = () => {
          if (settled) {
            return;
          }

          settled = true;
          finishListening();
          emitError(
            new SpeechRecognitionError(
              'no-speech',
              'No close speech match was detected.',
            ),
          );
        };

        recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
          if (settled) {
            return;
          }

          settled = true;
          finishListening();
          emitError(mapBrowserErrorCode(event.error));
        };

        recognition.onend = () => {
          if (settled) {
            return;
          }

          settled = true;
          finishListening();

          if (!transcript) {
            emitError(
              new SpeechRecognitionError(
                'no-speech',
                'No speech was detected.',
              ),
            );
          }
        };

        try {
          recognition.start();
        } catch (error) {
          finishListening();
          reject(error);
        }
      });
    },
    async stop() {
      activeRecognition?.abort();
      activeRecognition = null;
    },
  };
}
