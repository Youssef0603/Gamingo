import { Platform } from 'react-native';

import { createPlatformTextToSpeechAdapter as createNativeTextToSpeechAdapter } from './textToSpeechAdapter.native';
import { createPlatformTextToSpeechAdapter as createWebTextToSpeechAdapter } from './textToSpeechAdapter.web';

export function createPlatformTextToSpeechAdapter() {
  return Platform.OS === 'web'
    ? createWebTextToSpeechAdapter()
    : createNativeTextToSpeechAdapter();
}
