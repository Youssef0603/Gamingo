import storage from '@react-native-firebase/storage';
import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { ensureFirebaseReady } from './firebase';

import type { LanguageCode } from '../types/language';
import type { TextToSpeechRate } from './textToSpeech';

const PHRASE_AUDIO_DEBUG_PREFIX = '[phrase-audio]';
const PHRASE_AUDIO_STORAGE_ROOT = 'audios';
const PHRASE_AUDIO_CACHE_ROOT_SEGMENTS = ['gamingo', 'phrase-audio-cache', 'v1'];
const PHRASE_AUDIO_TEMP_ROOT_SEGMENTS = ['gamingo', 'phrase-audio-temp'];
const SLOW_PLAYBACK_RATE = 0.78;
const RESERVED_FILE_SEGMENT_CHARACTERS = new Set([
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '|',
  '?',
  '*',
]);

type PhraseAudioPlaybackRequest = {
  languageCode?: LanguageCode;
  phraseId?: string;
  rate?: TextToSpeechRate;
};

type PhraseAudioPlaybackStatus = {
  didJustFinish: boolean;
};

type PhraseAudioSubscription = {
  remove: () => void;
};

type PhraseAudioPlayer = {
  addStatusListener: (
    listener: (status: PhraseAudioPlaybackStatus) => void,
  ) => PhraseAudioSubscription;
  pause: () => void;
  play: () => void;
  replace: (sourceUri: string) => void;
  reset: () => Promise<void>;
  setPlaybackRate: (rate: number) => void;
};

type PhraseAudioDownloadTask = {
  cancel: () => Promise<void>;
  promise: Promise<void>;
};

type PhraseAudioPlaybackDependencies = {
  createDownloadTask: (
    storagePath: string,
    destinationUri: string,
  ) => PhraseAudioDownloadTask;
  createPersistentFileUri: (
    languageCode: LanguageCode,
    fileName: string,
  ) => string;
  createPlayer: () => PhraseAudioPlayer;
  createTemporaryFileUri: (
    languageCode: LanguageCode,
    fileName: string,
  ) => string;
  deleteFile: (fileUri: string) => void;
  ensureAudioMode: () => Promise<void>;
  ensureFirebaseReady: () => Promise<void>;
  ensurePersistentDirectory: (languageCode: LanguageCode) => void;
  fileExists: (fileUri: string) => boolean;
  getFileSize: (fileUri: string) => number;
  moveFile: (fromUri: string, toUri: string) => void;
};

export interface PhraseAudioPlaybackService {
  isAvailable: () => boolean;
  play: (request: PhraseAudioPlaybackRequest) => Promise<boolean>;
  stop: () => Promise<void>;
}

class PhraseAudioCancelledError extends Error {
  constructor() {
    super('Phrase audio playback was cancelled.');
  }
}

function warnPhraseAudio(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.warn(`${PHRASE_AUDIO_DEBUG_PREFIX} ${message}`);
    return;
  }

  console.warn(`${PHRASE_AUDIO_DEBUG_PREFIX} ${message}`, payload);
}

function sanitizePhraseAudioFileSegment(value: string, fallback = 'audio') {
  const sanitizedValue = value
    .trim()
    .split('')
    .filter(character => {
      const codePoint = character.charCodeAt(0);

      return codePoint > 31 && !RESERVED_FILE_SEGMENT_CHARACTERS.has(character);
    })
    .join('')
    .replace(/\s+/g, '-')
    .replace(/\.+$/g, '')
    .slice(0, 60);

  return sanitizedValue || fallback;
}

function buildPhraseAudioFileName(phraseId: string) {
  return `${sanitizePhraseAudioFileSegment(phraseId, 'audio')}.mp3`;
}

function buildPhraseAudioStoragePath(
  languageCode: LanguageCode,
  phraseId: string,
) {
  return `${PHRASE_AUDIO_STORAGE_ROOT}/${languageCode}/${buildPhraseAudioFileName(phraseId)}`;
}

function buildPhraseAudioCacheKey(
  languageCode: LanguageCode,
  phraseId: string,
) {
  return `${languageCode}:${phraseId}`;
}

function getPlaybackRate(rate?: TextToSpeechRate) {
  return rate === 'slow' ? SLOW_PLAYBACK_RATE : 1;
}

function isFirebaseObjectNotFoundError(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'storage/object-not-found'
  );
}

function createFileFromUri(fileUri: string) {
  return new File(fileUri);
}

function createDirectoryFromSegments(
  root: Directory,
  pathSegments: string[],
) {
  return new Directory(root, ...pathSegments);
}

function createDefaultPhraseAudioPlaybackDependencies(): PhraseAudioPlaybackDependencies {
  let hasConfiguredAudioMode = false;

  return {
    createDownloadTask(storagePath, destinationUri) {
      const task = storage().ref(storagePath).writeToFile(destinationUri);

      return {
        cancel: async () => {
          try {
            await task.cancel();
          } catch {
            // Ignore cancellation errors because the task may already be complete.
          }
        },
        promise: task.then(() => undefined),
      };
    },
    createPersistentFileUri(languageCode, fileName) {
      const directory = createDirectoryFromSegments(
        Paths.document,
        [...PHRASE_AUDIO_CACHE_ROOT_SEGMENTS, languageCode],
      );

      return new File(directory, fileName).uri;
    },
    createPlayer() {
      const player = createAudioPlayer(null, { updateInterval: 200 });

      return {
        addStatusListener(listener) {
          return player.addListener('playbackStatusUpdate', listener);
        },
        pause() {
          player.pause();
        },
        play() {
          player.play();
        },
        replace(sourceUri) {
          player.replace({ uri: sourceUri });
        },
        async reset() {
          try {
            await player.seekTo(0);
          } catch {
            // Ignore reset errors when nothing has been loaded yet.
          }
        },
        setPlaybackRate(rate) {
          player.shouldCorrectPitch = true;
          player.playbackRate = rate;
        },
      };
    },
    createTemporaryFileUri(languageCode, fileName) {
      const directory = createDirectoryFromSegments(
        Paths.cache,
        [...PHRASE_AUDIO_TEMP_ROOT_SEGMENTS, languageCode],
      );

      directory.create({ idempotent: true, intermediates: true });

      return new File(
        directory,
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}.download`,
      ).uri;
    },
    deleteFile(fileUri) {
      const file = createFileFromUri(fileUri);

      if (!file.exists) {
        return;
      }

      file.delete();
    },
    async ensureAudioMode() {
      if (hasConfiguredAudioMode) {
        return;
      }

      await setAudioModeAsync({
        allowsRecording: false,
        interruptionMode: 'mixWithOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      hasConfiguredAudioMode = true;
    },
    ensureFirebaseReady,
    ensurePersistentDirectory(languageCode) {
      const directory = createDirectoryFromSegments(
        Paths.document,
        [...PHRASE_AUDIO_CACHE_ROOT_SEGMENTS, languageCode],
      );

      directory.create({ idempotent: true, intermediates: true });
    },
    fileExists(fileUri) {
      return createFileFromUri(fileUri).exists;
    },
    getFileSize(fileUri) {
      return createFileFromUri(fileUri).size;
    },
    moveFile(fromUri, toUri) {
      const sourceFile = createFileFromUri(fromUri);
      const destinationFile = createFileFromUri(toUri);

      if (destinationFile.exists) {
        destinationFile.delete();
      }

      sourceFile.move(destinationFile);
    },
  };
}

function isUsableCachedFile(
  dependencies: PhraseAudioPlaybackDependencies,
  fileUri: string,
) {
  return dependencies.fileExists(fileUri) && dependencies.getFileSize(fileUri) > 0;
}

export function createPhraseAudioPlaybackService(
  dependencies: PhraseAudioPlaybackDependencies = createDefaultPhraseAudioPlaybackDependencies(),
): PhraseAudioPlaybackService {
  const player = dependencies.createPlayer();
  const missingRemoteAudioKeys = new Set<string>();
  const inFlightDownloads = new Map<string, Promise<string>>();
  let activeOperationId = 0;
  let activeDownloadTask: PhraseAudioDownloadTask | null = null;
  let finalizeActivePlayback: (() => void) | null = null;

  async function stop() {
    activeOperationId += 1;
    const downloadTask = activeDownloadTask;
    const finalizePlayback = finalizeActivePlayback;

    activeDownloadTask = null;
    finalizeActivePlayback = null;

    await downloadTask?.cancel();

    try {
      player.pause();
    } catch {
      // Ignore pause errors because playback may not have started yet.
    }

    await player.reset().catch(() => undefined);
    finalizePlayback?.();
  }

  async function downloadPhraseAudioFile(
    cacheKey: string,
    languageCode: LanguageCode,
    phraseId: string,
    finalFileUri: string,
  ) {
    const storagePath = buildPhraseAudioStoragePath(languageCode, phraseId);
    const fileName = buildPhraseAudioFileName(phraseId);
    const temporaryFileUri = dependencies.createTemporaryFileUri(
      languageCode,
      fileName,
    );

    await dependencies.ensureFirebaseReady();
    dependencies.ensurePersistentDirectory(languageCode);

    const downloadTask = dependencies.createDownloadTask(
      storagePath,
      temporaryFileUri,
    );

    activeDownloadTask = downloadTask;

    try {
      await downloadTask.promise;

      if (!isUsableCachedFile(dependencies, temporaryFileUri)) {
        throw new Error(`Downloaded phrase audio is empty: ${storagePath}`);
      }

      if (isUsableCachedFile(dependencies, finalFileUri)) {
        dependencies.deleteFile(temporaryFileUri);
        return finalFileUri;
      }

      dependencies.moveFile(temporaryFileUri, finalFileUri);
      return finalFileUri;
    } catch (error) {
      dependencies.deleteFile(temporaryFileUri);

      if (isFirebaseObjectNotFoundError(error)) {
        missingRemoteAudioKeys.add(cacheKey);
      }

      throw error;
    } finally {
      if (activeDownloadTask === downloadTask) {
        activeDownloadTask = null;
      }
    }
  }

  async function ensureLocalPhraseAudioFile(
    languageCode: LanguageCode,
    phraseId: string,
  ) {
    const fileName = buildPhraseAudioFileName(phraseId);
    const finalFileUri = dependencies.createPersistentFileUri(
      languageCode,
      fileName,
    );
    const cacheKey = buildPhraseAudioCacheKey(languageCode, phraseId);

    if (missingRemoteAudioKeys.has(cacheKey)) {
      throw new Error('missing-remote-audio');
    }

    if (isUsableCachedFile(dependencies, finalFileUri)) {
      return finalFileUri;
    }

    let inFlightDownload = inFlightDownloads.get(cacheKey);

    if (!inFlightDownload) {
      inFlightDownload = downloadPhraseAudioFile(
        cacheKey,
        languageCode,
        phraseId,
        finalFileUri,
      ).finally(() => {
        if (inFlightDownloads.get(cacheKey) === inFlightDownload) {
          inFlightDownloads.delete(cacheKey);
        }
      });
      inFlightDownloads.set(cacheKey, inFlightDownload);
    }

    return inFlightDownload;
  }

  async function playLocalPhraseAudio(
    fileUri: string,
    rate: TextToSpeechRate | undefined,
    operationId: number,
  ) {
    if (operationId !== activeOperationId) {
      throw new PhraseAudioCancelledError();
    }

    await new Promise<void>((resolve, reject) => {
      let hasSettled = false;

      const cleanup = () => {
        subscription.remove();

        if (finalizeActivePlayback === finalize) {
          finalizeActivePlayback = null;
        }
      };

      const finalize = () => {
        if (hasSettled) {
          return;
        }

        hasSettled = true;
        cleanup();
        resolve();
      };

      const subscription = player.addStatusListener(status => {
        if (status.didJustFinish) {
          finalize();
        }
      });

      finalizeActivePlayback = finalize;

      try {
        player.setPlaybackRate(getPlaybackRate(rate));
        player.replace(fileUri);
        player.play();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  return {
    isAvailable() {
      return true;
    },
    async play({ languageCode, phraseId, rate }) {
      if (!languageCode || !phraseId) {
        return false;
      }

      const operationId = activeOperationId + 1;

      activeOperationId = operationId;

      try {
        await dependencies.ensureAudioMode();
        const localFileUri = await ensureLocalPhraseAudioFile(
          languageCode,
          phraseId,
        );

        if (operationId !== activeOperationId) {
          throw new PhraseAudioCancelledError();
        }

        await player.reset();
        await playLocalPhraseAudio(localFileUri, rate, operationId);
        return true;
      } catch (error) {
        if (error instanceof PhraseAudioCancelledError) {
          return true;
        }

        if (operationId !== activeOperationId) {
          return true;
        }

        if (
          (error instanceof Error && error.message === 'missing-remote-audio') ||
          isFirebaseObjectNotFoundError(error)
        ) {
          return false;
        }

        warnPhraseAudio('Falling back to native TTS after phrase audio failure.', {
          error,
          languageCode,
          phraseId,
        });
        return false;
      } finally {
        if (operationId === activeOperationId) {
          finalizeActivePlayback = null;
        }
      }
    },
    stop,
  };
}

export const phraseAudioPlaybackService = createPhraseAudioPlaybackService();
