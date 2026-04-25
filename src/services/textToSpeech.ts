import { createPlatformTextToSpeechAdapter } from './textToSpeechAdapter';

export type TextToSpeechRequest = {
  language?: string;
  text: string;
};

export interface TextToSpeechAdapter {
  isAvailable: () => boolean;
  speak: (request: TextToSpeechRequest) => Promise<void>;
  stop: () => Promise<void>;
}

export interface TextToSpeechService extends TextToSpeechAdapter {}

export function createTextToSpeechService(
  adapter: TextToSpeechAdapter = createPlatformTextToSpeechAdapter(),
): TextToSpeechService {
  return {
    isAvailable() {
      return adapter.isAvailable();
    },
    async speak(request) {
      await adapter.speak(request);
    },
    async stop() {
      await adapter.stop();
    },
  };
}

export const textToSpeechService = createTextToSpeechService();

export async function speak(request: TextToSpeechRequest) {
  await textToSpeechService.speak(request);
}

export async function stopSpeaking() {
  await textToSpeechService.stop();
}

export function isTextToSpeechAvailable() {
  return textToSpeechService.isAvailable();
}
