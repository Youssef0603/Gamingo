import {
  SpeechRecognitionError,
  speechRecognitionService,
} from '../../services/speechRecognition';
import { textToSpeechService } from '../../services/textToSpeech';

import type {
  SpeechRecognitionStartOptions,
  SpeechRecognitionService,
  TextToSpeechService,
} from '../../services';

export type PracticeDependencies = {
  speechRecognition: SpeechRecognitionService;
  textToSpeech: TextToSpeechService;
};

type TranscriptFactory = string | (() => string | Promise<string>);

export function createDefaultPracticeDependencies(): PracticeDependencies {
  return {
    speechRecognition: speechRecognitionService,
    textToSpeech: textToSpeechService,
  };
}

export function createUnavailableSpeechRecognitionService(
  message = 'Speech recognition is not configured on this build.',
): SpeechRecognitionService {
  return {
    getPermissionStatus() {
      return 'unavailable';
    },
    getState() {
      return 'idle';
    },
    isAvailable() {
      return false;
    },
    onError() {
      return () => undefined;
    },
    onPermissionChange() {
      return () => undefined;
    },
    onResult() {
      return () => undefined;
    },
    onStateChange() {
      return () => undefined;
    },
    async start(_options?: SpeechRecognitionStartOptions) {
      throw new SpeechRecognitionError('unavailable', message);
    },
    async stop() {
      return;
    },
  };
}

export function createStaticSpeechRecognitionService(
  transcriptFactory: TranscriptFactory,
): SpeechRecognitionService {
  const resultListeners = new Set<
    Parameters<SpeechRecognitionService['onResult']>[0]
  >();
  const stateListeners = new Set<
    Parameters<SpeechRecognitionService['onStateChange']>[0]
  >();
  let state: 'idle' | 'listening' = 'idle';

  const emitState = (nextState: typeof state) => {
    state = nextState;
    stateListeners.forEach(listener => {
      listener(nextState);
    });
  };

  const emitResult = async () => {
    const transcript =
      typeof transcriptFactory === 'function'
        ? await transcriptFactory()
        : transcriptFactory;

    resultListeners.forEach(listener => {
      listener({ isFinal: true, transcript });
    });
    emitState('idle');
  };

  return {
    getPermissionStatus() {
      return 'granted';
    },
    getState() {
      return state;
    },
    isAvailable() {
      return true;
    },
    onError() {
      return () => undefined;
    },
    onPermissionChange() {
      return () => undefined;
    },
    onResult(listener) {
      resultListeners.add(listener);

      return () => {
        resultListeners.delete(listener);
      };
    },
    onStateChange(listener) {
      stateListeners.add(listener);

      return () => {
        stateListeners.delete(listener);
      };
    },
    async start(_options?: SpeechRecognitionStartOptions) {
      emitState('listening');
      await emitResult();
    },
    async stop() {
      emitState('idle');
    },
  };
}
