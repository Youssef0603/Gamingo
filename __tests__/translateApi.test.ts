import { translateTextWithDetectedSource } from '../src/services/translateApi';

describe('translateApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('translates text through MyMemory using the app source language', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          quotaFinished: false,
          responseData: {
            translatedText: 'hola',
          },
          responseStatus: 200,
        }),
      ok: true,
    } as Response);

    const result = await translateTextWithDetectedSource({
      destinationLanguage: 'es',
      sourceLanguage: 'en',
      text: 'hello',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.mymemory.translated.net/get?langpair=en%7Ces&q=hello',
    );
    expect(result).toEqual({
      destinationText: 'hola',
      sourceLanguage: 'en',
      sourceText: 'hello',
    });
  });

  it('surfaces quota failures', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          quotaFinished: true,
          responseData: {
            translatedText: '',
          },
          responseStatus: 200,
        }),
      ok: true,
    } as Response);

    await expect(
      translateTextWithDetectedSource({
        destinationLanguage: 'es',
        sourceLanguage: 'en',
        text: 'hello',
      }),
    ).rejects.toThrow('Translation service daily quota is finished.');
  });

  it('blocks obvious wrong-script text before calling the API', async () => {
    await expect(
      translateTextWithDetectedSource({
        destinationLanguage: 'ru',
        sourceLanguage: 'en',
        text: 'مرحبا',
      }),
    ).rejects.toThrow('This does not look like English.');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('blocks Latin transliteration for non-Latin source languages', async () => {
    await expect(
      translateTextWithDetectedSource({
        destinationLanguage: 'ru',
        sourceLanguage: 'ar',
        text: 'marhaban',
      }),
    ).rejects.toThrow('This does not look like Arabic.');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('blocks common Spanish phrases when native language is English', async () => {
    await expect(
      translateTextWithDetectedSource({
        destinationLanguage: 'ru',
        sourceLanguage: 'en',
        text: 'hola amigo',
      }),
    ).rejects.toThrow('This looks like Spanish');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('blocks English phrases when native language is Spanish', async () => {
    await expect(
      translateTextWithDetectedSource({
        destinationLanguage: 'ru',
        sourceLanguage: 'es',
        text: 'hello friend',
      }),
    ).rejects.toThrow('This looks like English');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows English phrases despite weak local detector noise', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          quotaFinished: false,
          responseData: {
            translatedText: 'привет, друг',
          },
          responseStatus: 200,
        }),
      ok: true,
    } as Response);

    await translateTextWithDetectedSource({
      destinationLanguage: 'ru',
      sourceLanguage: 'en',
      text: 'hello my friend',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('allows accented Latin text for Latin-script source languages', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue({
      json: () =>
        Promise.resolve({
          quotaFinished: false,
          responseData: {
            translatedText: 'student',
          },
          responseStatus: 200,
        }),
      ok: true,
    } as Response);

    await translateTextWithDetectedSource({
      destinationLanguage: 'en',
      sourceLanguage: 'fr',
      text: 'élève',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
