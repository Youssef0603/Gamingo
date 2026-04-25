import type {
  TextToSpeechAdapter,
  TextToSpeechRequest,
} from './textToSpeech';

type WebSpeechSynthesisUtterance = {
  lang?: string;
  onend: null | (() => void);
  onerror: null | (() => void);
};

type WebSpeechSynthesis = {
  cancel: () => void;
  speak: (utterance: WebSpeechSynthesisUtterance) => void;
};

function getWebSpeechSynthesis() {
  const candidate = (globalThis as {
    speechSynthesis?: WebSpeechSynthesis | undefined;
  }).speechSynthesis;

  if (
    !candidate ||
    typeof (
      globalThis as {
        SpeechSynthesisUtterance?: unknown;
      }
    ).SpeechSynthesisUtterance === 'undefined'
  ) {
    return null;
  }

  return candidate;
}

export function createPlatformTextToSpeechAdapter(): TextToSpeechAdapter {
  return {
    isAvailable() {
      return Boolean(getWebSpeechSynthesis());
    },
    async speak({ language, text }: TextToSpeechRequest) {
      const speechSynthesis = getWebSpeechSynthesis();
      const SpeechUtterance = (
        globalThis as {
          SpeechSynthesisUtterance?: new (
            value: string,
          ) => WebSpeechSynthesisUtterance;
        }
      ).SpeechSynthesisUtterance;

      if (!speechSynthesis || !SpeechUtterance) {
        return;
      }

      speechSynthesis.cancel();

      await new Promise<void>(resolve => {
        const utterance = new SpeechUtterance(text);

        if (language) {
          utterance.lang = language;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        speechSynthesis.speak(utterance);
      });
    },
    async stop() {
      getWebSpeechSynthesis()?.cancel();
    },
  };
}
