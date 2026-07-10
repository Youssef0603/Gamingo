export {};

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import SpeakingCard from '../src/features/practice/SpeakingCard';

jest.mock('lottie-react-native', () => 'LottieView');

const mockPlaySuccessSound = jest.fn(() => Promise.resolve());
const mockPlayPhrase = jest.fn(() => Promise.resolve());
const mockSpeakPhrase = jest.fn(() => Promise.resolve());
const mockCancelPractice = jest.fn(() => Promise.resolve());
const mockInvalidatePractice = jest.fn();

jest.mock('../src/services', () => ({
  playSuccessSound: mockPlaySuccessSound,
}));

jest.mock('../src/features/reviews/appReview', () => ({
  trackReviewMilestone: jest.fn(),
}));

jest.mock('../src/features/practice/usePractice', () => ({
  usePractice: jest.fn(() => ({
    cancelPractice: mockCancelPractice,
    error: null,
    feedback: null,
    heardText: '',
    invalidatePractice: mockInvalidatePractice,
    isListening: false,
    isPlaying: false,
    isRequestingPermission: false,
    permissionStatus: 'granted',
    playPhrase: mockPlayPhrase,
    speakPhrase: mockSpeakPhrase,
    status: 'idle',
  })),
}));

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('SpeakingCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('automatically starts listening after playback in auto mode', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <SpeakingCard
          autoStartListeningAfterPlayback
          helperLabel="English"
          helperText="Wait for the team next time"
          isFavorite={false}
          onClose={jest.fn()}
          onToggleFavorite={jest.fn()}
          phrase="Bir dahaki sefere takımı bekle"
        />,
      );

      await flushMicrotasks();
    });

    expect(mockPlayPhrase).toHaveBeenCalledTimes(1);
    expect(mockSpeakPhrase).toHaveBeenCalledTimes(1);
    expect(
      mockPlayPhrase.mock.invocationCallOrder[0],
    ).toBeLessThan(mockSpeakPhrase.mock.invocationCallOrder[0]);
  });

  it('keeps the default card manual after playback', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <SpeakingCard
          helperLabel="English"
          helperText="Wait for the team next time"
          isFavorite={false}
          onClose={jest.fn()}
          onToggleFavorite={jest.fn()}
          phrase="Bir dahaki sefere takımı bekle"
        />,
      );

      await flushMicrotasks();
    });

    expect(mockPlayPhrase).toHaveBeenCalledTimes(1);
    expect(mockSpeakPhrase).not.toHaveBeenCalled();
  });
});
