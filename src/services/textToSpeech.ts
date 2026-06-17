import { createPlatformTextToSpeechAdapter } from './textToSpeechAdapter';

export type TextToSpeechRate = 'slow' | 'normal';

export type TextToSpeechRequest = {
  language?: string;
  rate?: TextToSpeechRate;
  text: string;
};

export interface TextToSpeechAdapter {
  isAvailable: () => boolean;
  speak: (request: TextToSpeechRequest) => Promise<void>;
  stop: () => Promise<void>;
}

export interface TextToSpeechService extends TextToSpeechAdapter {}

function getPlaybackKey({ language, text }: TextToSpeechRequest) {
  return `${language ?? ''}:${text.trim().toLocaleLowerCase()}`;
}

export function createTextToSpeechService(
  adapter: TextToSpeechAdapter = createPlatformTextToSpeechAdapter(),
): TextToSpeechService {
  const playbackCountsByPhrase = new Map<string, number>();

  return {
    isAvailable() {
      return adapter.isAvailable();
    },
    async speak(request) {
      if (request.rate) {
        await adapter.speak(request);
        return;
      }

      const playbackKey = getPlaybackKey(request);
      const previousPlaybackCount = playbackCountsByPhrase.get(playbackKey) ?? 0;
      const rate: TextToSpeechRate =
        previousPlaybackCount % 2 === 0 ? 'slow' : 'normal';

      playbackCountsByPhrase.set(playbackKey, previousPlaybackCount + 1);
      await adapter.speak({ ...request, rate });
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
