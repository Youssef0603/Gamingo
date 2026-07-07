import { createPlatformTextToSpeechAdapter } from './textToSpeechAdapter';

import type { LanguageCode } from '../types/language';

export type TextToSpeechRate = 'slow' | 'normal';

export type TextToSpeechRequest = {
  language?: string;
  languageCode?: LanguageCode;
  phraseId?: string;
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
  let isSpeaking = false;
  let stopPromise: Promise<void> | null = null;

  const speakWithState = async (request: TextToSpeechRequest) => {
    if (stopPromise) {
      await stopPromise;
    }

    isSpeaking = true;

    try {
      await adapter.speak(request);
    } finally {
      isSpeaking = false;
    }
  };

  return {
    isAvailable() {
      return adapter.isAvailable();
    },
    async speak(request) {
      if (request.rate) {
        await speakWithState(request);
        return;
      }

      const playbackKey = getPlaybackKey(request);
      const previousPlaybackCount = playbackCountsByPhrase.get(playbackKey) ?? 0;
      const rate: TextToSpeechRate =
        previousPlaybackCount % 2 === 0 ? 'slow' : 'normal';

      playbackCountsByPhrase.set(playbackKey, previousPlaybackCount + 1);
      await speakWithState({ ...request, rate });
    },
    async stop() {
      if (!isSpeaking) {
        return;
      }

      if (!stopPromise) {
        stopPromise = adapter.stop().finally(() => {
          isSpeaking = false;
          stopPromise = null;
        });
      }

      await stopPromise;
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
