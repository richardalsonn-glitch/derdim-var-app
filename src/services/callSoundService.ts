import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';
import { isVoiceSessionActive } from './voiceService';

const OUTGOING_CALL_SOURCE = require('../../assets/sounds/aramasesi.m4a');
const INCOMING_RINGTONE_SOURCE = require('../../assets/sounds/telefonzilsesi.m4a');

type CallSoundKind = 'outgoing' | 'incoming';

let outgoingPlayer: AudioPlayer | null = null;
let incomingPlayer: AudioPlayer | null = null;
let incomingPlayToken = 0;

async function configurePlaybackMode() {
  if (isVoiceSessionActive()) {
    logSafeDebug('[call-sound] playback skipped during active voice session', null, {
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
    logSafeDebug('[call-sound] audio mode skipped', error, {
      functionName: 'configurePlaybackMode',
      source: 'expo-audio',
    });
  }

  return true;
}

function createPlayer(kind: CallSoundKind) {
  try {
    const player = createAudioPlayer(kind === 'outgoing' ? OUTGOING_CALL_SOURCE : INCOMING_RINGTONE_SOURCE);
    player.loop = true;
    player.volume = kind === 'outgoing' ? 0.42 : 0.72;
    return player;
  } catch (error) {
    logSafeWarn('[call-sound] player create failed', error, {
      functionName: 'createPlayer',
      source: kind,
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

async function playIncomingRingtoneLoop(token: number) {
  if (token !== incomingPlayToken) {
    return;
  }

  if (!incomingPlayer) {
    incomingPlayer = createPlayer('incoming');
  }

  const player = incomingPlayer;

  if (!player) {
    return;
  }

  try {
    player.loop = true;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    logSafeDebug('[call-sound] incoming play skipped', error, {
      functionName: 'playIncomingRingtoneLoop',
      source: 'telefonzilsesi.m4a',
    });
  }
}

function stopOutgoingCallToneInternal() {
  releasePlayer(outgoingPlayer);
  outgoingPlayer = null;
}

function stopIncomingRingtoneInternal() {
  incomingPlayToken += 1;
  releasePlayer(incomingPlayer);
  incomingPlayer = null;
}

async function playLooping(kind: CallSoundKind) {
  if (kind === 'incoming') {
    const token = incomingPlayToken + 1;
    incomingPlayToken = token;
    stopOutgoingCallToneInternal();

    const configured = await configurePlaybackMode();

    if (!configured) {
      return;
    }

    if (token !== incomingPlayToken) {
      return;
    }

    void playIncomingRingtoneLoop(token);
    return;
  }

  const configured = await configurePlaybackMode();

  if (!configured) {
    return;
  }

  if (kind === 'outgoing') {
    stopIncomingRingtoneInternal();

    if (!outgoingPlayer) {
      outgoingPlayer = createPlayer('outgoing');
    }

    const player = outgoingPlayer;

    if (!player) {
      return;
    }

    try {
      await player.seekTo(0);
      player.play();
    } catch (error) {
      logSafeDebug('[call-sound] outgoing play skipped', error, {
        functionName: 'playOutgoingCallTone',
        source: 'aramasesi.m4a',
      });
    }

    return;
  }
}

export function playOutgoingCallTone() {
  void playLooping('outgoing');
}

export function stopOutgoingCallTone() {
  stopOutgoingCallToneInternal();
}

export function playIncomingRingtone() {
  void playLooping('incoming');
}

export function stopIncomingRingtone() {
  stopIncomingRingtoneInternal();
}

export function stopAllCallSounds() {
  stopOutgoingCallToneInternal();
  stopIncomingRingtoneInternal();
}

export function isAnyCallSoundPlaying() {
  return Boolean(outgoingPlayer || incomingPlayer);
}
