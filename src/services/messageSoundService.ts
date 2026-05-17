import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';
import { isVoiceSessionActive } from './voiceService';

const MESSAGE_NOTIFICATION_SOURCE = require('../../assets/sounds/mesajbildirimsesi.m4a');

let messagePlayer: AudioPlayer | null = null;
let playToken = 0;

async function configurePlaybackMode() {
  if (isVoiceSessionActive()) {
    logSafeDebug('[message-sound] playback skipped during active voice session', null, {
      functionName: 'configurePlaybackMode',
      source: 'expo-audio',
    });
    return false;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  } catch (error) {
    logSafeDebug('[message-sound] audio mode skipped', error, {
      functionName: 'configurePlaybackMode',
      source: 'expo-audio',
    });
  }

  return true;
}

function createMessagePlayer() {
  try {
    const player = createAudioPlayer(MESSAGE_NOTIFICATION_SOURCE);
    player.loop = false;
    player.volume = 0.72;
    return player;
  } catch (error) {
    logSafeWarn('[message-sound] player create failed', error, {
      functionName: 'createMessagePlayer',
      source: 'mesajbildirimsesi.m4a',
    });
    return null;
  }
}

function releasePlayer(player: AudioPlayer | null) {
  if (!player) {
    return;
  }

  try {
    player.pause();
  } catch {
    // Ignore native audio teardown races.
  }

  try {
    player.seekTo(0).catch(() => undefined);
  } catch {
    // Ignore native audio teardown races.
  }

  try {
    player.remove();
  } catch {
    // Ignore native audio teardown races.
  }
}

export function preloadMessageNotificationSound() {
  if (messagePlayer) {
    return;
  }

  messagePlayer = createMessagePlayer();
}

export function stopMessageNotificationSound() {
  playToken += 1;
  releasePlayer(messagePlayer);
  messagePlayer = null;
}

export function playMessageNotificationSound() {
  const token = playToken + 1;
  playToken = token;

  void (async () => {
    const configured = await configurePlaybackMode();

    if (!configured) {
      return;
    }

    if (token !== playToken) {
      return;
    }

    if (!messagePlayer) {
      messagePlayer = createMessagePlayer();
    }

    const player = messagePlayer;

    if (!player) {
      return;
    }

    try {
      player.loop = false;
      await player.seekTo(0);
      player.play();
    } catch (error) {
      logSafeDebug('[message-sound] play skipped', error, {
        functionName: 'playMessageNotificationSound',
        source: 'mesajbildirimsesi.m4a',
      });
    }
  })();
}
