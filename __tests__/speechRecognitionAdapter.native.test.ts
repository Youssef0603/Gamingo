export {};

const listeners = new Map<string, (event?: unknown) => void>();

const mockSpeechRecognitionModule = {
  abort: jest.fn(),
  addListener: jest.fn((eventName: string, listener: (event?: unknown) => void) => {
    listeners.set(eventName, listener);

    return {
      remove: jest.fn(() => {
        listeners.delete(eventName);
      }),
    };
  }),
  isRecognitionAvailable: jest.fn(() => true),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      canAskAgain: true,
      granted: true,
      restricted: false,
      status: 'granted',
    })),
  stop: jest.fn(),
  start: jest.fn(),
  supportsRecording: jest.fn(() => true),
};

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

jest.mock('expo-speech-recognition', () => ({
  AVAudioSessionCategory: {
    playAndRecord: 'playAndRecord',
  },
  AVAudioSessionCategoryOptions: {
    allowBluetooth: 'allowBluetooth',
    defaultToSpeaker: 'defaultToSpeaker',
  },
  AVAudioSessionMode: {
    measurement: 'measurement',
  },
  ExpoSpeechRecognitionModule: mockSpeechRecognitionModule,
}));

describe('speechRecognitionAdapter.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.clear();
  });

  it('uses the Android beep workaround when recording support is available', async () => {
    const {
      createPlatformSpeechRecognitionAdapter,
    } = require('../src/services/speechRecognitionAdapter.native');

    const adapter = createPlatformSpeechRecognitionAdapter();
    const startPromise = adapter.start({
      emitError: jest.fn(),
      emitResult: jest.fn(),
      emitStateChange: jest.fn(),
      startOptions: {
        language: 'en-US',
        promptType: 'short-utterance',
      },
    });

    expect(mockSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        continuous: true,
        lang: 'en-US',
      }),
    );

    listeners.get('start')?.();
    await startPromise;

    await adapter.stop();

    expect(mockSpeechRecognitionModule.abort).toHaveBeenCalledTimes(1);
    expect(mockSpeechRecognitionModule.stop).not.toHaveBeenCalled();
  });

  it('falls back to the default stop path when the workaround is unavailable', async () => {
    mockSpeechRecognitionModule.supportsRecording.mockReturnValue(false);

    const {
      createPlatformSpeechRecognitionAdapter,
    } = require('../src/services/speechRecognitionAdapter.native');

    const adapter = createPlatformSpeechRecognitionAdapter();
    const startPromise = adapter.start({
      emitError: jest.fn(),
      emitResult: jest.fn(),
      emitStateChange: jest.fn(),
      startOptions: {
        language: 'en-US',
      },
    });

    expect(mockSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        continuous: false,
      }),
    );

    listeners.get('start')?.();
    await startPromise;

    await adapter.stop();

    expect(mockSpeechRecognitionModule.stop).toHaveBeenCalledTimes(1);
    expect(mockSpeechRecognitionModule.abort).not.toHaveBeenCalled();
  });
});
