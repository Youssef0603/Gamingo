import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const successSoundSource = require('../assets/sounds/success.mp3');
const successPlayer = createAudioPlayer(successSoundSource);

let hasConfiguredAudioMode = false;

async function ensureSoundEffectAudioMode() {
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
}

export async function playSuccessSound() {
  await ensureSoundEffectAudioMode();

  try {
    await successPlayer.seekTo(0);
  } catch {
    // Ignore seek errors on the very first play while the asset is still preparing.
  }

  successPlayer.play();
}
