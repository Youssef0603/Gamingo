import {
  createTextToSpeechService,
  type TextToSpeechAdapter,
  type TextToSpeechRequest,
} from '../src/services/textToSpeech';

jest.mock('../src/services/textToSpeechAdapter', () => ({
  createPlatformTextToSpeechAdapter: jest.fn(),
}));

function createMockAdapter() {
  const requests: TextToSpeechRequest[] = [];
  const adapter: TextToSpeechAdapter = {
    isAvailable: () => true,
    speak: jest.fn(async request => {
      requests.push(request);
    }),
    stop: jest.fn(async () => undefined),
  };

  return { adapter, requests };
}

describe('textToSpeechService', () => {
  it('alternates the same phrase between slow and normal playback', async () => {
    const { adapter, requests } = createMockAdapter();
    const service = createTextToSpeechService(adapter);

    await service.speak({ language: 'fr-FR', text: 'Push now' });
    await service.speak({ language: 'fr-FR', text: 'Push now' });
    await service.speak({ language: 'fr-FR', text: 'Push now' });

    expect(requests.map(request => request.rate)).toEqual([
      'slow',
      'normal',
      'slow',
    ]);
  });

  it('starts each distinct phrase at slow playback', async () => {
    const { adapter, requests } = createMockAdapter();
    const service = createTextToSpeechService(adapter);

    await service.speak({ language: 'fr-FR', text: 'Push now' });
    await service.speak({ language: 'fr-FR', text: 'Hold site' });

    expect(requests.map(request => request.rate)).toEqual(['slow', 'slow']);
  });

  it('respects an explicit playback rate', async () => {
    const { adapter, requests } = createMockAdapter();
    const service = createTextToSpeechService(adapter);

    await service.speak({
      language: 'fr-FR',
      rate: 'normal',
      text: 'Push now',
    });

    expect(requests[0].rate).toBe('normal');
  });
});
