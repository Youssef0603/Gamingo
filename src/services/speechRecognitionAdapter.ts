import { Platform } from 'react-native';

import { createPlatformSpeechRecognitionAdapter as createNativeSpeechRecognitionAdapter } from './speechRecognitionAdapter.native';
import { createPlatformSpeechRecognitionAdapter as createWebSpeechRecognitionAdapter } from './speechRecognitionAdapter.web';

export function createPlatformSpeechRecognitionAdapter() {
  return Platform.OS === 'web'
    ? createWebSpeechRecognitionAdapter()
    : createNativeSpeechRecognitionAdapter();
}
