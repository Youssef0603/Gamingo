jest.mock('@react-native-firebase/storage', () => {
  return () => ({
    ref: jest.fn(() => ({
      writeToFile: jest.fn(),
    })),
  });
});

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  Directory: jest.fn(),
  File: jest.fn(),
  Paths: {
    cache: {},
    document: {},
  },
}));

jest.mock('../src/services/firebase', () => ({
  ensureFirebaseReady: jest.fn(async () => undefined),
}));

import { createPhraseAudioPlaybackService } from '../src/services/phraseAudioPlayback.native';

import type { LanguageCode } from '../src/types/language';

function createPhraseAudioPlaybackHarness(options?: {
  missingStoragePaths?: string[];
  pendingStoragePaths?: string[];
}) {
  const storedFiles = new Map<string, { size: number }>();
  const downloadCounts = new Map<string, number>();
  const cancelledStoragePaths: string[] = [];
  const playedSources: string[] = [];
  const playbackRates: number[] = [];
  const pendingDownloads = new Map<
    string,
    {
      reject: (error: unknown) => void;
      resolve: () => void;
    }
  >();
  let activeStatusListener:
    | ((status: { didJustFinish: boolean }) => void)
    | null = null;
  let tempFileCounter = 0;

  const missingStoragePaths = new Set(options?.missingStoragePaths ?? []);
  const slowPlaybackRate = 0.78;

  const dependencies = {
    createDownloadTask(storagePath: string, destinationUri: string) {
      downloadCounts.set(storagePath, (downloadCounts.get(storagePath) ?? 0) + 1);

      if (missingStoragePaths.has(storagePath)) {
        return {
          cancel: async () => undefined,
          promise: Promise.reject({ code: 'storage/object-not-found' }),
        };
      }

      if (options?.pendingStoragePaths?.includes(storagePath)) {
        const promise = new Promise<void>((resolve, reject) => {
          pendingDownloads.set(storagePath, { reject, resolve });
        });

        return {
          cancel: async () => {
            cancelledStoragePaths.push(storagePath);
            pendingDownloads.get(storagePath)?.reject(new Error('cancelled'));
            pendingDownloads.delete(storagePath);
          },
          promise,
        };
      }

      return {
        cancel: async () => undefined,
        promise: Promise.resolve().then(() => {
          storedFiles.set(destinationUri, { size: 1024 });
        }),
      };
    },
    createPersistentFileUri(languageCode: LanguageCode, fileName: string) {
      return `/documents/${languageCode}/${fileName}`;
    },
    createPlayer() {
      return {
        addStatusListener(listener: (status: { didJustFinish: boolean }) => void) {
          activeStatusListener = listener;

          return {
            remove() {
              if (activeStatusListener === listener) {
                activeStatusListener = null;
              }
            },
          };
        },
        pause() {
          return;
        },
        play() {
          Promise.resolve().then(() => {
            activeStatusListener?.({ didJustFinish: true });
          });
        },
        replace(sourceUri: string) {
          playedSources.push(sourceUri);
        },
        async reset() {
          return;
        },
        setPlaybackRate(rate: number) {
          playbackRates.push(rate);
        },
      };
    },
    createTemporaryFileUri(languageCode: LanguageCode, fileName: string) {
      tempFileCounter += 1;
      return `/tmp/${languageCode}/${tempFileCounter}-${fileName}`;
    },
    deleteFile(fileUri: string) {
      storedFiles.delete(fileUri);
    },
    async ensureAudioMode() {
      return;
    },
    async ensureFirebaseReady() {
      return;
    },
    ensurePersistentDirectory(_languageCode: LanguageCode) {
      return;
    },
    fileExists(fileUri: string) {
      return storedFiles.has(fileUri);
    },
    getFileSize(fileUri: string) {
      return storedFiles.get(fileUri)?.size ?? 0;
    },
    log() {
      return;
    },
    moveFile(fromUri: string, toUri: string) {
      const file = storedFiles.get(fromUri);

      if (!file) {
        throw new Error(`Missing source file: ${fromUri}`);
      }

      storedFiles.set(toUri, file);
      storedFiles.delete(fromUri);
    },
  };

  return {
    cancelledStoragePaths,
    dependencies,
    downloadCounts,
    playedSources,
    playbackRates,
    service: createPhraseAudioPlaybackService(dependencies),
    slowPlaybackRate,
    storedFiles,
    async waitForDownloadStart(storagePath: string) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if ((downloadCounts.get(storagePath) ?? 0) > 0) {
          return;
        }

        await Promise.resolve();
      }

      throw new Error(`Download did not start for ${storagePath}`);
    },
  };
}

describe('phraseAudioPlaybackService', () => {
  it('downloads a phrase audio file once and reuses the local cached copy', async () => {
    const harness = createPhraseAudioPlaybackHarness();

    await expect(
      harness.service.play({
        languageCode: 'en',
        phraseId: 'callouts-gg',
        rate: 'slow',
      }),
    ).resolves.toBe(true);

    await expect(
      harness.service.play({
        languageCode: 'en',
        phraseId: 'callouts-gg',
        rate: 'normal',
      }),
    ).resolves.toBe(true);

    expect(harness.downloadCounts.get('audios/en/callouts-gg.mp3')).toBe(1);
    expect(harness.playedSources).toEqual([
      '/documents/en/callouts-gg.mp3',
      '/documents/en/callouts-gg.mp3',
    ]);
    expect(harness.playbackRates).toEqual([harness.slowPlaybackRate, 1]);
    expect(harness.storedFiles.has('/documents/en/callouts-gg.mp3')).toBe(true);
  });

  it('falls back cleanly when a remote phrase audio file is missing', async () => {
    const harness = createPhraseAudioPlaybackHarness({
      missingStoragePaths: ['audios/en/callouts-gg.mp3'],
    });

    await expect(
      harness.service.play({
        languageCode: 'en',
        phraseId: 'callouts-gg',
      }),
    ).resolves.toBe(false);

    await expect(
      harness.service.play({
        languageCode: 'en',
        phraseId: 'callouts-gg',
      }),
    ).resolves.toBe(false);

    expect(harness.downloadCounts.get('audios/en/callouts-gg.mp3')).toBe(1);
    expect(harness.playedSources).toEqual([]);
  });

  it('cancels an active download when playback is stopped', async () => {
    const harness = createPhraseAudioPlaybackHarness({
      pendingStoragePaths: ['audios/en/callouts-gg.mp3'],
    });

    const playPromise = harness.service.play({
      languageCode: 'en',
      phraseId: 'callouts-gg',
    });

    await harness.waitForDownloadStart('audios/en/callouts-gg.mp3');
    await harness.service.stop();

    await expect(playPromise).resolves.toBe(true);
    expect(harness.cancelledStoragePaths).toEqual(['audios/en/callouts-gg.mp3']);
  });
});
