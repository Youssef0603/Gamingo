import Tts from 'react-native-tts';

import type { TextToSpeechAdapter, TextToSpeechRequest } from './textToSpeech';

export function createPlatformTextToSpeechAdapter(): TextToSpeechAdapter {
  return {
    isAvailable() {
      return true;
    },
    async speak({ language, text }: TextToSpeechRequest) {
      if (language) {
        try {
          await Tts.setDefaultLanguage(language);
        } catch {
          // Fall back to the system default voice when the requested locale is unavailable.
        }
      }

      Tts.speak(text);
    },
    async stop() {},
  };
}
