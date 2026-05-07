import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';

const OUTGOING_CALL_SOURCE = require('../../assets/sounds/aramasesi.m4a');
const INCOMING_RINGTONE_SOURCE = require('../../assets/sounds/telefonzilsesi.m4a');

type CallSoundKind = 'outgoing' | 'incoming';

let outgoingPlayer: AudioPlayer | null = null;
let incomingPlayer: AudioPlayer | null = null;
let incomingReplayTimer: ReturnType<typeof setTimeout> | null = null;
let incomingPlayToken = 0;

const INCOMING_MANUAL_REPLAY_MS = 1100;

async function configurePlaybackMode() {
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

function stopIncomingReplayTimer() {
  if (incomingReplayTimer) {
    clearTimeout(incomingReplayTimer);
    incomingReplayTimer = null;
  }
}

function scheduleIncomingManualReplay(token: number) {
  stopIncomingReplayTimer();
  incomingReplayTimer = setTimeout(() => {
    incomingReplayTimer = null;

    if (token !== incomingPlayToken) {
      return;
    }

    void playIncomingRingtoneOnce(token);
  }, INCOMING_MANUAL_REPLAY_MS);
}

async function playIncomingRingtoneOnce(token: number) {
  if (token !== incomingPlayToken) {
    return;
  }

  releasePlayer(incomingPlayer);
  incomingPlayer = null;

  const player = createPlayer('incoming');

  if (!player) {
    scheduleIncomingManualReplay(token);
    return;
  }

  incomingPlayer = player;

  try {
    player.loop = false;
    await player.seekTo(0);

    if (token !== incomingPlayToken || incomingPlayer !== player) {
      releasePlayer(player);
      if (incomingPlayer === player) {
        incomingPlayer = null;
      }
      return;
    }

    player.play();
  } catch (error) {
    logSafeDebug('[call-sound] incoming replay skipped', error, {
      functionName: 'playIncomingRingtoneOnce',
      source: 'telefonzilsesi.m4a',
    });
  }

  if (token === incomingPlayToken) {
    scheduleIncomingManualReplay(token);
  }
}

function stopOutgoingCallToneInternal() {
  releasePlayer(outgoingPlayer);
  outgoingPlayer = null;
}

function stopIncomingRingtoneInternal() {
  incomingPlayToken += 1;
  stopIncomingReplayTimer();
  releasePlayer(incomingPlayer);
  incomingPlayer = null;
}

async function playLooping(kind: CallSoundKind) {
  if (kind === 'incoming') {
    const token = incomingPlayToken + 1;
    incomingPlayToken = token;
    stopIncomingReplayTimer();
    stopOutgoingCallToneInternal();

    await configurePlaybackMode();

    if (token !== incomingPlayToken) {
      return;
    }

    void playIncomingRingtoneOnce(token);
    return;
  }

  await configurePlaybackMode();

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
