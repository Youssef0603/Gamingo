import { createPlatformSpeechRecognitionAdapter } from './speechRecognitionAdapter';

export type SpeechRecognitionPermissionStatus =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export type SpeechRecognitionState =
  | 'idle'
  | 'requesting-permission'
  | 'listening';

export type SpeechRecognitionStartOptions = {
  contextualStrings?: string[];
  language?: string;
  promptType?: 'default' | 'short-utterance';
};

export type SpeechRecognitionResult = {
  isFinal: boolean;
  transcript: string;
};

export type SpeechRecognitionErrorCode =
  | 'permission-denied'
  | 'permission-blocked'
  | 'unavailable'
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'busy'
  | 'language-not-supported'
  | 'unknown';

export class SpeechRecognitionError extends Error {
  code: SpeechRecognitionErrorCode;

  constructor(code: SpeechRecognitionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'SpeechRecognitionError';
  }
}

export interface SpeechRecognitionAdapter {
  isAvailable: () => boolean;
  requestPermission: (
    options?: SpeechRecognitionStartOptions,
  ) => Promise<SpeechRecognitionPermissionStatus>;
  start: (options: {
    emitError: (error: SpeechRecognitionError) => void;
    emitResult: (result: SpeechRecognitionResult) => void;
    emitStateChange: (state: SpeechRecognitionState) => void;
    startOptions?: SpeechRecognitionStartOptions;
  }) => Promise<void>;
  stop: () => Promise<void>;
}

type SpeechRecognitionListener<TValue> = (value: TValue) => void;

export interface SpeechRecognitionService {
  getPermissionStatus: () => SpeechRecognitionPermissionStatus;
  getState: () => SpeechRecognitionState;
  isAvailable: () => boolean;
  onError: (
    listener: SpeechRecognitionListener<SpeechRecognitionError>,
  ) => () => void;
  onPermissionChange: (
    listener: SpeechRecognitionListener<SpeechRecognitionPermissionStatus>,
  ) => () => void;
  onResult: (
    listener: SpeechRecognitionListener<SpeechRecognitionResult>,
  ) => () => void;
  onStateChange: (
    listener: SpeechRecognitionListener<SpeechRecognitionState>,
  ) => () => void;
  start: (options?: SpeechRecognitionStartOptions) => Promise<void>;
  stop: () => Promise<void>;
}

function addListener<TValue>(
  listeners: Set<SpeechRecognitionListener<TValue>>,
  listener: SpeechRecognitionListener<TValue>,
) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emitToListeners<TValue>(
  listeners: Set<SpeechRecognitionListener<TValue>>,
  value: TValue,
) {
  listeners.forEach(listener => {
    listener(value);
  });
}

export function toSpeechRecognitionError(error: unknown) {
  if (error instanceof SpeechRecognitionError) {
    return error;
  }

  if (error instanceof Error) {
    return new SpeechRecognitionError('unknown', error.message);
  }

  return new SpeechRecognitionError(
    'unknown',
    'Speech recognition failed. Please try again.',
  );
}

export function createSpeechRecognitionService(
  adapter: SpeechRecognitionAdapter = createPlatformSpeechRecognitionAdapter(),
): SpeechRecognitionService {
  const errorListeners = new Set<
    SpeechRecognitionListener<SpeechRecognitionError>
  >();
  const permissionListeners = new Set<
    SpeechRecognitionListener<SpeechRecognitionPermissionStatus>
  >();
  const resultListeners = new Set<
    SpeechRecognitionListener<SpeechRecognitionResult>
  >();
  const stateListeners = new Set<SpeechRecognitionListener<SpeechRecognitionState>>();

  let permissionStatus: SpeechRecognitionPermissionStatus = adapter.isAvailable()
    ? 'unknown'
    : 'unavailable';
  let state: SpeechRecognitionState = 'idle';

  const setPermissionStatus = (
    nextPermissionStatus: SpeechRecognitionPermissionStatus,
  ) => {
    if (permissionStatus === nextPermissionStatus) {
      return;
    }

    permissionStatus = nextPermissionStatus;
    emitToListeners(permissionListeners, nextPermissionStatus);
  };

  const setState = (nextState: SpeechRecognitionState) => {
    if (state === nextState) {
      return;
    }

    state = nextState;
    emitToListeners(stateListeners, nextState);
  };

  const emitError = (error: unknown) => {
    const nextError = toSpeechRecognitionError(error);

    if (nextError.code === 'permission-denied') {
      setPermissionStatus('denied');
    }

    if (nextError.code === 'permission-blocked') {
      setPermissionStatus('blocked');
    }

    if (nextError.code === 'unavailable') {
      setPermissionStatus('unavailable');
    }

    setState('idle');
    emitToListeners(errorListeners, nextError);

    return nextError;
  };

  return {
    getPermissionStatus() {
      return permissionStatus;
    },
    getState() {
      return state;
    },
    isAvailable() {
      return adapter.isAvailable();
    },
    onError(listener) {
      return addListener(errorListeners, listener);
    },
    onPermissionChange(listener) {
      return addListener(permissionListeners, listener);
    },
    onResult(listener) {
      return addListener(resultListeners, listener);
    },
    onStateChange(listener) {
      return addListener(stateListeners, listener);
    },
    async start(options) {
      if (!adapter.isAvailable()) {
        throw emitError(
          new SpeechRecognitionError(
            'unavailable',
            'Speech recognition is unavailable in this build.',
          ),
        );
      }

      await adapter.stop().catch(() => undefined);
      setState('requesting-permission');

      let nextPermissionStatus: SpeechRecognitionPermissionStatus;

      try {
        nextPermissionStatus = await adapter.requestPermission(options);
      } catch (error) {
        throw emitError(error);
      }

      setPermissionStatus(nextPermissionStatus);

      if (nextPermissionStatus === 'denied') {
        throw emitError(
          new SpeechRecognitionError(
            'permission-denied',
            'Microphone permission was denied.',
          ),
        );
      }

      if (nextPermissionStatus === 'blocked') {
        throw emitError(
          new SpeechRecognitionError(
            'permission-blocked',
            'Microphone access is blocked. Enable it in system settings.',
          ),
        );
      }

      if (nextPermissionStatus === 'unavailable') {
        throw emitError(
          new SpeechRecognitionError(
            'unavailable',
            'Speech recognition is unavailable in this build.',
          ),
        );
      }

      try {
        await adapter.start({
          emitError,
          emitResult(result) {
            if (result.isFinal) {
              setState('idle');
            } else {
              setState('listening');
            }

            setPermissionStatus('granted');
            emitToListeners(resultListeners, result);
          },
          emitStateChange: setState,
          startOptions: options,
        });

        if (state === 'requesting-permission') {
          setState('listening');
        }
      } catch (error) {
        throw emitError(error);
      }
    },
    async stop() {
      await adapter.stop();
      setState('idle');
    },
  };
}

export const speechRecognitionService = createSpeechRecognitionService();

export async function start(options?: SpeechRecognitionStartOptions) {
  await speechRecognitionService.start(options);
}

export async function stop() {
  await speechRecognitionService.stop();
}

export function onResult(
  listener: SpeechRecognitionListener<SpeechRecognitionResult>,
) {
  return speechRecognitionService.onResult(listener);
}

export function onError(
  listener: SpeechRecognitionListener<SpeechRecognitionError>,
) {
  return speechRecognitionService.onError(listener);
}

export function onPermissionChange(
  listener: SpeechRecognitionListener<SpeechRecognitionPermissionStatus>,
) {
  return speechRecognitionService.onPermissionChange(listener);
}

export function onStateChange(
  listener: SpeechRecognitionListener<SpeechRecognitionState>,
) {
  return speechRecognitionService.onStateChange(listener);
}
