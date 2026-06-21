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
});
