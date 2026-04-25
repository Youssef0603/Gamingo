import type {
  SpeechRecognitionAdapter,
  SpeechRecognitionPermissionStatus,
} from './speechRecognition';

export function createPlatformSpeechRecognitionAdapter(): SpeechRecognitionAdapter {
  return {
    isAvailable() {
      return false;
    },
    async requestPermission(): Promise<SpeechRecognitionPermissionStatus> {
      return 'unavailable';
    },
    async start() {
      throw new Error(
        'Speech recognition is not configured for native builds yet. Add a native recognizer module to enable live speaking checks.',
      );
    },
    async stop() {
      return;
    },
  };
}
