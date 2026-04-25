import { AccessibilityInfo, NativeModules } from 'react-native';

import type {
  TextToSpeechAdapter,
  TextToSpeechRequest,
} from './textToSpeech';

type ExpoSpeechModule = {
  speak: (
    text: string,
    options?: {
      language?: string;
      onDone?: () => void;
      onError?: () => void;
      onStopped?: () => void;
    },
  ) => void;
  stop: () => Promise<void> | void;
};

function getExpoSpeechModule(): ExpoSpeechModule | null {
  const moduleCandidate = (NativeModules as { ExpoSpeech?: ExpoSpeechModule })
    .ExpoSpeech;

  if (
    !moduleCandidate ||
    typeof moduleCandidate.speak !== 'function' ||
    typeof moduleCandidate.stop !== 'function'
  ) {
    return null;
  }

  return moduleCandidate;
}

export function createPlatformTextToSpeechAdapter(): TextToSpeechAdapter {
  return {
    isAvailable() {
      return true;
    },
    async speak({ language, text }: TextToSpeechRequest) {
      const expoSpeech = getExpoSpeechModule();

      if (expoSpeech) {
        await new Promise<void>(resolve => {
          expoSpeech.speak(text, {
            language,
            onDone: () => resolve(),
            onError: () => resolve(),
            onStopped: () => resolve(),
          });
        });

        return;
      }

      AccessibilityInfo.announceForAccessibility(text);
    },
    async stop() {
      await getExpoSpeechModule()?.stop?.();
    },
  };
}
