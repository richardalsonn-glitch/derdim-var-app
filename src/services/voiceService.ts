import { isLiveKitEnabled } from '../config/features';
import { getSession } from './authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { logSafeDebug } from '../lib/safeLogger';

type VoiceServiceError = {
  message: string;
};

type VoiceServiceResult<T> = {
  data: T | null;
  error: VoiceServiceError | null;
};

type CreateTokenPayload = {
  roomName?: string;
  token: string;
  wsUrl: string;
};

type VoiceRoomState = {
  muted: boolean;
  speakerEnabled: boolean;
  remoteMuted: boolean;
};

type VoiceConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnecting';

type LeaveRoomOptions = {
  reason?: string;
  connectionSeq?: number;
  force?: boolean;
};

type AppleAudioConfiguration = {
  audioCategory?: 'soloAmbient' | 'playback' | 'record' | 'playAndRecord' | 'multiRoute';
  audioCategoryOptions?: (
    | 'mixWithOthers'
    | 'duckOthers'
    | 'interruptSpokenAudioAndMixWithOthers'
    | 'allowBluetooth'
    | 'allowBluetoothA2DP'
    | 'allowAirPlay'
    | 'defaultToSpeaker'
  )[];
  audioMode?: 'default' | 'gameChat' | 'measurement' | 'moviePlayback' | 'spokenAudio' | 'videoChat' | 'videoRecording' | 'voiceChat' | 'voicePrompt';
};

type LiveKitAudioSessionModule = {
  getAudioOutputs: () => Promise<string[]>;
  selectAudioOutput: (output: string) => Promise<void>;
  configureAudio: (config: Record<string, unknown>) => Promise<void>;
  startAudioSession: () => Promise<void>;
  stopAudioSession: () => Promise<void>;
  setDefaultRemoteAudioTrackVolume?: (volume: number) => Promise<void>;
  setAppleAudioConfiguration?: (config: AppleAudioConfiguration) => Promise<void>;
};

type LiveKitModules = {
  AudioSession: LiveKitAudioSessionModule;
  AndroidAudioTypePresets: {
    communication: unknown;
  };
  Room: new (options: Record<string, unknown>) => LiveKitRoomInstance;
  RoomEvent: {
    Connected?: string;
    Disconnected: string;
    Reconnecting?: string;
    Reconnected?: string;
    ConnectionStateChanged?: string;
    ParticipantConnected: string;
    TrackSubscribed: string;
    TrackUnsubscribed?: string;
  };
  Track: {
    Kind: {
      Audio: string;
    };
  };
};

type LiveKitTrack = {
  kind?: string;
  isMuted?: boolean;
  sid?: string;
  source?: string;
  mediaStreamTrack?: {
    enabled?: boolean;
    muted?: boolean;
    id?: string;
    readyState?: string;
  };
  setVolume?: (volume: number) => void;
};

type LiveKitRoomInstance = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  connect: (wsUrl: string, token: string, options: Record<string, unknown>) => Promise<void>;
  disconnect: () => void | Promise<void>;
  removeAllListeners: () => void;
  state?: string;
  connectionState?: string;
  remoteParticipants?: Map<string, LiveKitParticipant>;
  localParticipant: {
    isMicrophoneEnabled: boolean;
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
    audioLevel?: number;
    isSpeaking?: boolean;
  };
};

type LiveKitParticipant = {
  identity?: string;
  audioLevel?: number;
  isSpeaking?: boolean;
};

type ManagedRoomMeta = {
  roomName: string;
  roomId: string | null;
  connectionSeq: number;
  listenersAttached: boolean;
  connectionState: string;
};

let livekitModulesCache: LiveKitModules | null = null;
let activeRoom: LiveKitRoomInstance | null = null;
let activeRoomName: string | null = null;
let activeRoomId: string | null = null;
let lastKnownRoom: LiveKitRoomInstance | null = null;
let lastKnownRoomName: string | null = null;
let lastKnownRoomId: string | null = null;
const managedRooms = new Map<LiveKitRoomInstance, ManagedRoomMeta>();
let activeJoinPromise: Promise<VoiceServiceResult<VoiceRoomState>> | null = null;
let activeDisconnectPromise: Promise<VoiceServiceResult<true>> | null = null;
let activeConnectionSeq = 0;
let isMicrophonePublished = false;
let isDisconnecting = false;
let voiceConnectionState: VoiceConnectionState = 'idle';
let activeRoomListenersAttached = false;
let activeProcessedRemoteTrackSids = new Set<string>();
let audioLevelInterval: ReturnType<typeof setInterval> | null = null;
let lastRemoteAudioTrackDebug = {
  muted: false,
  enabled: false,
};
let audioSessionStarted = false;
let activeSpeakerEnabled = true;
let activeRemoteMuted = false;
const activeRemoteAudioTracks = new Map<string, LiveKitTrack>();
let mockLiveKitLogged = false;
let mockRoomId: string | null = null;
let mockMicEnabled = true;

type AuthHeaderPayload = {
  currentUserId: string;
  headers: Record<string, string>;
};

function formatLiveKitValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || 'empty';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  return String(value);
}

type SelectAudioOutputOptions = {
  allowFailure?: boolean;
};

function logLiveKit(event: Record<string, unknown>, functionName = 'voiceService') {
  const message = Object.entries(event)
    .map(([key, value]) => `${key}:${formatLiveKitValue(value)}`)
    .join(' ');

  logSafeDebug('[livekit]', message, { functionName });
}

function logAudioSession(event: Record<string, unknown>) {
  logLiveKit(event, 'audioSession');
}

function logAudioOutput(event: Record<string, unknown>) {
  logLiveKit(event, 'audioOutput');
}

function logRemoteMute(event: Record<string, unknown>) {
  logLiveKit(event, 'remoteMute');
}

function logSafeDisconnect(event: Record<string, unknown>) {
  logLiveKit(event, 'voiceService.safeDisconnect');
}

function readRecordValue(source: unknown, key: string) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  return (source as Record<string, unknown>)[key];
}

function buildRoomKey(roomId?: string | null, fallbackRoomName?: string | null) {
  return normalizeRoomName(roomId) || fallbackRoomName || (typeof roomId === 'string' && roomId.trim() ? roomId.trim() : '');
}

function getConnectedVoiceState(): VoiceRoomState {
  return {
    muted: getActiveMuteState(),
    speakerEnabled: activeSpeakerEnabled,
    remoteMuted: activeRemoteMuted,
  };
}

function getRoomMeta(room: LiveKitRoomInstance | null) {
  return room ? managedRooms.get(room) : undefined;
}

function setRoomConnectionState(room: LiveKitRoomInstance | null, connectionState: string) {
  const meta = getRoomMeta(room);

  if (meta) {
    meta.connectionState = connectionState;
  }
}

function rememberRoom(room: LiveKitRoomInstance, roomName: string, roomId: string | null, connectionSeq: number) {
  managedRooms.set(room, {
    roomName,
    roomId,
    connectionSeq,
    listenersAttached: false,
    connectionState: 'created',
  });
  lastKnownRoom = room;
  lastKnownRoomName = roomName;
  lastKnownRoomId = roomId;
}

function forgetRoom(room: LiveKitRoomInstance) {
  managedRooms.delete(room);

  if (activeRoom === room) {
    activeRoom = null;
  }

  if (lastKnownRoom === room) {
    lastKnownRoom = null;
    lastKnownRoomName = null;
    lastKnownRoomId = null;
  }
}

function getKnownRooms() {
  const rooms = new Set<LiveKitRoomInstance>();

  managedRooms.forEach((_meta, room) => rooms.add(room));

  if (activeRoom) {
    rooms.add(activeRoom);
  }

  if (lastKnownRoom) {
    rooms.add(lastKnownRoom);
  }

  return Array.from(rooms);
}

function resetRemoteAudioRefs() {
  activeRemoteMuted = false;
  activeRemoteAudioTracks.clear();
}

function resetRoomRefs() {
  activeRoom = null;
  activeRoomName = null;
  activeRoomId = null;
  lastKnownRoom = null;
  lastKnownRoomName = null;
  lastKnownRoomId = null;
}

function getFunctionUrl() {
  const explicitEndpoint = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT?.trim();

  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return supabaseUrl ? `${supabaseUrl}/functions/v1/livekit-token` : '';
}

function getLivekitUrl() {
  return process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim() ?? '';
}

function getMockRoomId(peerUserId: string) {
  const normalizedPeerUserId = peerUserId.trim() || 'mock-peer';
  return `mock-room-${normalizedPeerUserId}`;
}

function normalizeRoomName(roomId?: string | null) {
  const normalized = typeof roomId === 'string' ? roomId.trim() : '';

  if (!normalized || normalized.length > 160) {
    return '';
  }

  const safeRoomId = normalized.replace(/[^a-zA-Z0-9:_-]/g, '-').replace(/-+/g, '-');
  return safeRoomId ? `voice-${safeRoomId}` : '';
}

function logMockMode() {
  if (mockLiveKitLogged) {
    return;
  }

  logSafeDebug('[livekit]', 'LiveKit disabled - using local call fallback', { functionName: 'voiceService' });
  mockLiveKitLogged = true;
}

async function getLiveKitModules(): Promise<LiveKitModules | null> {
  if (!isLiveKitEnabled) {
    return null;
  }

  if (livekitModulesCache) {
    return livekitModulesCache;
  }

  const livekitReactNativeModule = require('@livekit/react-native') as {
    AudioSession: LiveKitAudioSessionModule;
    AndroidAudioTypePresets: {
      communication: unknown;
    };
  };
  const livekitClientModule = require('livekit-client') as {
    Room: new (options: Record<string, unknown>) => LiveKitRoomInstance;
    RoomEvent: {
      Connected?: string;
      Disconnected: string;
      Reconnecting?: string;
      Reconnected?: string;
      ConnectionStateChanged?: string;
      ParticipantConnected: string;
      TrackSubscribed: string;
      TrackUnsubscribed?: string;
    };
    Track: {
      Kind: {
        Audio: string;
      };
    };
  };

  livekitModulesCache = {
    AudioSession: livekitReactNativeModule.AudioSession,
    AndroidAudioTypePresets: livekitReactNativeModule.AndroidAudioTypePresets,
    Room: livekitClientModule.Room,
    RoomEvent: livekitClientModule.RoomEvent,
    Track: livekitClientModule.Track,
  };

  return livekitModulesCache;
}

async function selectAudioOutput(enableSpeaker: boolean, options: SelectAudioOutputOptions = {}) {
  const target = enableSpeaker ? 'speaker' : 'earpiece';

  logAudioOutput({
    speakerToggleStart: true,
    target,
  });

  if (!isLiveKitEnabled) {
    activeSpeakerEnabled = enableSpeaker;
    logAudioOutput({
      speakerToggleSuccess: true,
      selectedOutput: target,
      speakerEnabled: activeSpeakerEnabled,
      mockCall: true,
    });
    return activeSpeakerEnabled;
  }

  const modules = await getLiveKitModules();

  if (!modules) {
    activeSpeakerEnabled = enableSpeaker;
    logAudioOutput({
      speakerToggleSuccess: true,
      selectedOutput: target,
      speakerEnabled: activeSpeakerEnabled,
      modulesMissing: true,
    });
    return activeSpeakerEnabled;
  }

  let outputs: string[] = [];

  try {
    if (modules.AudioSession.setAppleAudioConfiguration) {
      await modules.AudioSession.setAppleAudioConfiguration({
        audioCategory: 'playAndRecord',
        audioCategoryOptions: enableSpeaker ? ['allowBluetooth', 'defaultToSpeaker'] : ['allowBluetooth'],
        audioMode: enableSpeaker ? 'videoChat' : 'voiceChat',
      });
    }

    outputs = await modules.AudioSession.getAudioOutputs();
    logAudioSession({
      audioOutputs: outputs.length > 0 ? outputs.join(',') : 'none',
      speakerRequested: enableSpeaker,
    });
  } catch (error) {
    logAudioOutput({
      speakerToggleError: getFriendlyErrorMessage(error, 'audio output preparation failed'),
      target,
    });
    logAudioSession({
      audioOutputError: getFriendlyErrorMessage(error, 'get audio outputs failed'),
      speakerRequested: enableSpeaker,
    });

    if (!options.allowFailure) {
      throw error;
    }

    return activeSpeakerEnabled;
  }

  if (outputs.length === 0) {
    activeSpeakerEnabled = enableSpeaker;
    logAudioOutput({
      speakerToggleSuccess: true,
      selectedOutput: target,
      speakerEnabled: activeSpeakerEnabled,
      audioOutputs: 'none',
    });
    return activeSpeakerEnabled;
  }

  const preferredOutput = enableSpeaker
    ? outputs.includes('force_speaker')
      ? 'force_speaker'
      : outputs.includes('speaker')
        ? 'speaker'
        : outputs.includes('default')
          ? 'default'
          : outputs[0]
    : outputs.includes('earpiece')
      ? 'earpiece'
      : outputs.includes('default')
        ? 'default'
        : outputs[0];

  try {
    logAudioSession({
      selectAudioOutputStart: true,
      preferredOutput,
      speakerRequested: enableSpeaker,
    });
    await modules.AudioSession.selectAudioOutput(preferredOutput);
    activeSpeakerEnabled = enableSpeaker;
    logAudioOutput({
      speakerToggleSuccess: true,
      selectedOutput: preferredOutput,
      speakerEnabled: activeSpeakerEnabled,
    });
    logAudioSession({
      selectAudioOutputSuccess: true,
      selectedOutput: preferredOutput,
      speakerEnabled: activeSpeakerEnabled,
    });
  } catch (error) {
    logAudioOutput({
      speakerToggleError: getFriendlyErrorMessage(error, 'select audio output failed'),
      target,
      preferredOutput,
    });
    logAudioSession({
      selectAudioOutputError: getFriendlyErrorMessage(error, 'select audio output failed'),
      preferredOutput,
      speakerRequested: enableSpeaker,
    });

    if (!options.allowFailure) {
      throw error;
    }
  }

  return activeSpeakerEnabled;
}

async function applyLiveKitCallAudioConfiguration(modules: LiveKitModules, reason: string) {
  const defaultOutput = activeSpeakerEnabled ? 'speaker' : 'default';
  const preferredOutputList = activeSpeakerEnabled
    ? ['speaker', 'bluetooth', 'headset', 'earpiece']
    : ['earpiece', 'bluetooth', 'headset', 'speaker'];

  await modules.AudioSession.configureAudio({
    android: {
      preferredOutputList,
      audioTypeOptions: modules.AndroidAudioTypePresets.communication,
    },
    ios: {
      defaultOutput,
    },
  });
  logAudioSession({ configureAudioSuccess: true, defaultOutput, reason });

  if (modules.AudioSession.setAppleAudioConfiguration) {
    await modules.AudioSession.setAppleAudioConfiguration({
      audioCategory: 'playAndRecord',
      audioCategoryOptions: activeSpeakerEnabled ? ['allowBluetooth', 'defaultToSpeaker'] : ['allowBluetooth'],
      audioMode: activeSpeakerEnabled ? 'videoChat' : 'voiceChat',
    });
    logAudioSession({
      appleAudioConfigurationSuccess: true,
      appleAudioCategory: 'playAndRecord',
      appleAudioMode: activeSpeakerEnabled ? 'videoChat' : 'voiceChat',
      appleDefaultToSpeaker: activeSpeakerEnabled,
      reason,
    });
  }

  if (modules.AudioSession.setDefaultRemoteAudioTrackVolume) {
    const remoteVolume = activeRemoteMuted ? 0 : 1;
    await modules.AudioSession.setDefaultRemoteAudioTrackVolume(remoteVolume);
    logAudioSession({ defaultRemoteAudioTrackVolume: remoteVolume, reason });
  }
}

async function startLiveKitAudioSession(modules: LiveKitModules) {
  try {
    logAudioSession({ startAudioSessionStart: true });
    await applyLiveKitCallAudioConfiguration(modules, 'start-audio-session');
    await modules.AudioSession.startAudioSession();
    audioSessionStarted = true;
    logAudioSession({ startAudioSessionSuccess: true, audioSessionStarted: true });
  } catch (error) {
    logAudioSession({
      startAudioSessionError: getFriendlyErrorMessage(error, 'start audio session failed'),
      audioSessionStarted: false,
    });
    throw error;
  }
}

async function restoreLiveKitAudioRoute(modules: LiveKitModules, reason: string) {
  try {
    logAudioSession({ restoreAudioRouteStart: true, reason, speakerEnabled: activeSpeakerEnabled });
    await applyLiveKitCallAudioConfiguration(modules, reason);
    await modules.AudioSession.startAudioSession();
    audioSessionStarted = true;
    await selectAudioOutput(activeSpeakerEnabled, { allowFailure: true });
    logAudioSession({ restoreAudioRouteSuccess: true, reason, speakerEnabled: activeSpeakerEnabled });
  } catch (error) {
    logAudioSession({
      restoreAudioRouteError: getFriendlyErrorMessage(error, 'restore audio route failed'),
      reason,
      speakerEnabled: activeSpeakerEnabled,
    });
  }
}

async function stopLiveKitAudioSession(modules: LiveKitModules | null) {
  if (!modules) {
    logAudioSession({ stopAudioSession: true, audioSessionStopped: false, reason: 'modules-missing' });
    return;
  }

  try {
    logAudioSession({ stopAudioSession: true });
    await modules.AudioSession.stopAudioSession();
    audioSessionStarted = false;
    logAudioSession({ stopAudioSessionSuccess: true, audioSessionStarted: false });
  } catch (error) {
    logAudioSession({
      stopAudioSessionError: getFriendlyErrorMessage(error, 'stop audio session failed'),
    });

    try {
      await modules.AudioSession.stopAudioSession();
      logAudioSession({ stopAudioSessionRetrySuccess: true, audioSessionStarted: false });
    } catch (retryError) {
      logAudioSession({
        stopAudioSessionRetryError: getFriendlyErrorMessage(retryError, 'stop audio session retry failed'),
      });
    } finally {
      audioSessionStarted = false;
    }
  }
}

function stopAudioLevelDebug(reason: string) {
  if (!audioLevelInterval) {
    return;
  }

  clearInterval(audioLevelInterval);
  audioLevelInterval = null;
  logLiveKit({ audioLevelDebugStop: true, reason });
}

function startAudioLevelDebug(room: LiveKitRoomInstance, roomName: string, connectionSeq: number) {
  stopAudioLevelDebug('restart');

  audioLevelInterval = setInterval(() => {
    if (!isCurrentRoomEvent(room, connectionSeq)) {
      logLiveKit({
        staleRoomEventIgnored: true,
        event: 'audio-level',
        eventRoomName: roomName,
        activeRoomName: activeRoomName ?? 'none',
        connectionSeq,
        activeConnectionSeq,
      });
      stopAudioLevelDebug('stale-room');
      return;
    }

    const remoteParticipants = Array.from(room.remoteParticipants?.values() ?? []);
    const firstRemote = remoteParticipants[0];

    logLiveKit({
      audioLevelDebug: true,
      roomName,
      localAudioLevel: room.localParticipant.audioLevel ?? 0,
      localIsSpeaking: room.localParticipant.isSpeaking ?? false,
      remoteParticipantIdentity: firstRemote?.identity ?? 'none',
      remoteAudioLevel: firstRemote?.audioLevel ?? 0,
      remoteIsSpeaking: firstRemote?.isSpeaking ?? false,
      remoteTrackMuted: lastRemoteAudioTrackDebug.muted,
      remoteTrackEnabled: lastRemoteAudioTrackDebug.enabled,
      remoteParticipantCount: remoteParticipants.length,
      outputSelected: activeSpeakerEnabled ? 'force_speaker' : 'default',
    });
  }, 2000);
}

function detachRoomListeners(room: LiveKitRoomInstance | null, reason: string, connectionSeq: number) {
  const roomMeta = getRoomMeta(room);
  if (!room || (!activeRoomListenersAttached && !roomMeta?.listenersAttached)) {
    return;
  }

  logLiveKit({
    detachRoomListeners: true,
    reason,
    connectionSeq,
    activeConnectionSeq,
    roomName: roomMeta?.roomName ?? activeRoomName ?? 'missing',
  });
  room.removeAllListeners();
  if (roomMeta) {
    roomMeta.listenersAttached = false;
  }
  activeRoomListenersAttached = false;
  activeProcessedRemoteTrackSids = new Set<string>();
}

function isCurrentRoomEvent(room: LiveKitRoomInstance, connectionSeq: number) {
  return room === activeRoom && connectionSeq === activeConnectionSeq && voiceConnectionState !== 'disconnecting';
}

function isParticipantStillPresent(room: LiveKitRoomInstance, participant: unknown) {
  const identity = readRecordValue(participant, 'identity');

  if (typeof identity !== 'string' || !room.remoteParticipants) {
    return true;
  }

  return room.remoteParticipants.has(identity);
}

function normalizeRoomState(state: unknown) {
  const normalized = typeof state === 'string'
    ? state.trim().toLowerCase()
    : state === null || state === undefined
      ? ''
      : String(state).trim().toLowerCase();

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('reconnect')) {
    return 'reconnecting';
  }

  if (normalized.includes('disconnect')) {
    return 'disconnected';
  }

  if (normalized.includes('connecting')) {
    return 'connecting';
  }

  if (normalized.includes('connected')) {
    return 'connected';
  }

  if (normalized.includes('disposing')) {
    return 'disposing';
  }

  if (normalized.includes('created')) {
    return 'created';
  }

  return normalized;
}

function getRoomStateSnapshot(room: LiveKitRoomInstance) {
  const meta = getRoomMeta(room);
  const sdkState = readRecordValue(room, 'state') ?? readRecordValue(room, 'connectionState');
  const fallbackState = activeRoom === room && voiceConnectionState === 'connecting'
    ? 'connecting'
    : activeRoom === room && voiceConnectionState === 'connected'
      ? 'connected'
      : meta?.connectionState ?? 'unknown';
  const roomState = normalizeRoomState(typeof sdkState === 'string' ? sdkState : fallbackState);

  return {
    roomName: meta?.roomName ?? (room === activeRoom ? activeRoomName : null) ?? lastKnownRoomName ?? 'unknown',
    roomId: meta?.roomId ?? (room === activeRoom ? activeRoomId : null) ?? lastKnownRoomId ?? null,
    roomState,
    connectionSeq: meta?.connectionSeq ?? -1,
    isConnected: roomState === 'connected',
    isConnecting: roomState === 'connecting' || roomState === 'created',
    isReconnecting: roomState === 'reconnecting',
    isDisconnected: roomState === 'disconnected' || roomState === 'disposing',
  };
}

function isLeaveBeforeConnectedError(error: unknown) {
  const message = getFriendlyErrorMessage(error, 'disconnect failed').toLowerCase();
  return message.includes('cannot send signal request before connected')
    || (message.includes('before connected') && message.includes('leave'));
}

function getRemoteAudioTrackKey(track: LiveKitTrack, publication: unknown, participant?: unknown) {
  const publicationTrackSid = readRecordValue(publication, 'trackSid');
  const participantIdentity = readRecordValue(participant, 'identity');
  return track.sid
    ?? (typeof publicationTrackSid === 'string' ? publicationTrackSid : null)
    ?? track.mediaStreamTrack?.id
    ?? (typeof participantIdentity === 'string' ? `${participantIdentity}:audio` : 'remote-audio');
}

function applyRemoteAudioVolume(track: LiveKitTrack, key: string, muted = activeRemoteMuted) {
  const volume = muted ? 0 : 1;

  try {
    if (typeof track.setVolume === 'function') {
      track.setVolume(volume);
    }
  } catch (error) {
    logRemoteMute({
      remoteAudioVolumeError: getFriendlyErrorMessage(error, 'remote audio volume failed'),
      muted,
      volume,
      trackSid: key,
    });
  }

  logRemoteMute({
    remoteAudioVolumeApplied: true,
    muted,
    volume,
    trackSid: key,
    setVolumeAvailable: typeof track.setVolume === 'function',
  });
}

function applyRemoteMuteToKnownTracks(muted = activeRemoteMuted) {
  activeRemoteAudioTracks.forEach((track, trackSid) => {
    applyRemoteAudioVolume(track, trackSid, muted);
  });
}

async function disableLocalAudio(room: LiveKitRoomInstance, roomName: string, reason: string) {
  try {
    if (room.localParticipant.isMicrophoneEnabled) {
      await room.localParticipant.setMicrophoneEnabled(false);
    }
  } catch (error) {
    logLiveKit({
      staleRoomLocalAudioStopError: getFriendlyErrorMessage(error, 'local audio stop failed'),
      reason,
      roomName,
    }, 'voiceService.cleanup');
  }
}

async function safeDisconnectRoom(room: LiveKitRoomInstance, reason: string, disconnectSeq: number) {
  const snapshot = getRoomStateSnapshot(room);
  const shouldSkipLeave = snapshot.isConnecting || snapshot.isReconnecting || snapshot.isDisconnected;

  logSafeDisconnect({
    safeDisconnectStart: true,
    reason,
    roomName: snapshot.roomName,
    roomId: snapshot.roomId ?? 'none',
    roomState: snapshot.roomState,
    isConnected: snapshot.isConnected,
    isConnecting: snapshot.isConnecting,
    isReconnecting: snapshot.isReconnecting,
    activeRoomName: activeRoomName ?? 'none',
    managedRoomCount: managedRooms.size,
    connectionSeq: snapshot.connectionSeq,
    activeConnectionSeq,
    disconnectSeq,
  });

  if (snapshot.isConnecting || snapshot.isReconnecting) {
    logSafeDisconnect({
      pendingConnectCancelled: true,
      reason,
      roomName: snapshot.roomName,
      roomState: snapshot.roomState,
      connectionSeq: snapshot.connectionSeq,
      activeConnectionSeq,
    });
  }

  try {
    setRoomConnectionState(room, 'disposing');

    if (!snapshot.isDisconnected) {
      await disableLocalAudio(room, snapshot.roomName, reason);
    }

    detachRoomListeners(room, reason, disconnectSeq);

    if (snapshot.isConnected) {
      logSafeDisconnect({
        safeDisconnectConnectedLeave: true,
        reason,
        roomName: snapshot.roomName,
        roomState: snapshot.roomState,
      });
      await Promise.resolve(room.disconnect());
    } else if (snapshot.isDisconnected) {
      logSafeDisconnect({
        safeDisconnectAlreadyDisconnected: true,
        reason,
        roomName: snapshot.roomName,
        roomState: snapshot.roomState,
      });
    } else if (shouldSkipLeave || snapshot.roomState === 'unknown') {
      logSafeDisconnect({
        safeDisconnectSkipLeave: true,
        reason,
        roomName: snapshot.roomName,
        roomState: snapshot.roomState,
      });
    }
  } catch (error) {
    logSafeDisconnect({
      safeDisconnectError: getFriendlyErrorMessage(error, 'room disconnect failed'),
      expectedCleanupError: isLeaveBeforeConnectedError(error),
      reason,
      roomName: snapshot.roomName,
      roomState: snapshot.roomState,
    });
  } finally {
    setRoomConnectionState(room, 'disconnected');
    forgetRoom(room);
    logSafeDisconnect({
      safeDisconnectComplete: true,
      reason,
      roomName: snapshot.roomName,
      roomState: snapshot.roomState,
      remainingManagedRoomCount: managedRooms.size,
    });
  }
}

async function hardCleanupStaleRooms(reason: string, nextRoomName?: string | null) {
  if (!isLiveKitEnabled) {
    return;
  }

  const rooms = getKnownRooms();
  const previousRoomName = activeRoomName ?? rooms.map((room) => getRoomMeta(room)?.roomName).find(Boolean) ?? 'none';

  logLiveKit({
    hardCleanupStart: true,
    reason,
    previousRoomName,
    nextRoomName: nextRoomName ?? 'none',
    managedRoomCount: rooms.length,
    activeRoomExists: Boolean(activeRoom),
    lastKnownRoomExists: Boolean(lastKnownRoom),
    audioSessionStarted,
  }, 'voiceService.cleanup');

  for (const room of rooms) {
    const roomMeta = getRoomMeta(room);
    const roomName = roomMeta?.roomName ?? (room === activeRoom ? activeRoomName : null) ?? 'unknown';

    if (nextRoomName && room === activeRoom && roomName === nextRoomName) {
      continue;
    }

    logLiveKit({
      staleRoomListenersDetached: true,
      reason,
      roomName,
    }, 'voiceService.cleanup');
    await safeDisconnectRoom(room, reason, activeConnectionSeq);
  }

  if (!nextRoomName || activeRoomName !== nextRoomName) {
    resetRoomRefs();
    activeJoinPromise = null;
    isMicrophonePublished = false;
    activeRoomListenersAttached = false;
    activeProcessedRemoteTrackSids = new Set<string>();
    resetRemoteAudioRefs();
    lastRemoteAudioTrackDebug = { muted: false, enabled: false };
  }

  logLiveKit({
    staleRoomCleanupComplete: true,
    reason,
    nextRoomName: nextRoomName ?? 'none',
    remainingManagedRoomCount: managedRooms.size,
  }, 'voiceService.cleanup');
}

async function forceDisconnectAllRooms(reason: string, disconnectSeq: number) {
  const rooms = getKnownRooms();

  logLiveKit({
    forceDisconnectAllRooms: true,
    reason,
    activeRoomExists: Boolean(activeRoom),
    activeRoomName: activeRoomName ?? 'none',
    managedRoomCount: managedRooms.size,
    knownRoomCount: rooms.length,
    lastKnownRoomExists: Boolean(lastKnownRoom),
    lastKnownRoomName: lastKnownRoomName ?? 'none',
    lastKnownRoomId: lastKnownRoomId ?? 'none',
    audioSessionStarted,
    disconnectSeq,
  });

  for (const room of rooms) {
    await safeDisconnectRoom(room, reason, disconnectSeq);
  }

  managedRooms.clear();
  resetRoomRefs();
  activeRoomListenersAttached = false;
  activeProcessedRemoteTrackSids = new Set<string>();
  resetRemoteAudioRefs();
  lastRemoteAudioTrackDebug = { muted: false, enabled: false };
}

function attachRoomListeners(
  room: LiveKitRoomInstance,
  modules: LiveKitModules,
  roomName: string,
  connectionSeq: number,
) {
  if (activeRoomListenersAttached) {
    logLiveKit({
      duplicateRoomListenersIgnored: true,
      connectionSeq,
      activeConnectionSeq,
      roomName,
    });
    return;
  }

  activeRoomListenersAttached = true;
  const roomMeta = getRoomMeta(room);
  if (roomMeta) {
    roomMeta.listenersAttached = true;
  }
  logLiveKit({
    attachRoomListeners: true,
    connectionSeq,
    activeConnectionSeq,
    roomName,
  });

  if (modules.RoomEvent.Connected) {
    room.on(modules.RoomEvent.Connected, () => {
      const meta = getRoomMeta(room);
      const previousState = meta?.connectionState ?? 'unknown';

      if (meta) {
        meta.connectionState = 'connected';
      }

      logLiveKit({
        connectionStateChanged: true,
        from: previousState,
        to: 'connected',
        shouldCloseScreen: false,
        event: 'connected',
        roomName,
        connectionSeq,
        activeConnectionSeq,
      });
    });
  }

  if (modules.RoomEvent.ConnectionStateChanged) {
    room.on(modules.RoomEvent.ConnectionStateChanged, (state: unknown) => {
      const meta = getRoomMeta(room);
      const previousState = meta?.connectionState ?? 'unknown';
      const nextState = typeof state === 'string' ? state : String(state ?? 'unknown');

      if (meta) {
        meta.connectionState = nextState;
      }

      logLiveKit({
        connectionStateChanged: true,
        from: previousState,
        to: nextState,
        shouldCloseScreen: false,
        roomName,
        connectionSeq,
        activeConnectionSeq,
      });
    });
  }

  if (modules.RoomEvent.Reconnecting) {
    room.on(modules.RoomEvent.Reconnecting, () => {
      const meta = getRoomMeta(room);
      const previousState = meta?.connectionState ?? 'unknown';

      if (meta) {
        meta.connectionState = 'reconnecting';
      }

      logLiveKit({
        connectionStateChanged: true,
        from: previousState,
        to: 'reconnecting',
        shouldCloseScreen: false,
        event: 'reconnecting',
        roomName,
        connectionSeq,
        activeConnectionSeq,
      });
    });
  }

  if (modules.RoomEvent.Reconnected) {
    room.on(modules.RoomEvent.Reconnected, () => {
      const meta = getRoomMeta(room);
      const previousState = meta?.connectionState ?? 'unknown';

      if (meta) {
        meta.connectionState = 'connected';
      }

      logLiveKit({
        connectionStateChanged: true,
        from: previousState,
        to: 'connected',
        shouldCloseScreen: false,
        event: 'reconnected',
        roomName,
        connectionSeq,
        activeConnectionSeq,
      });
      void restoreLiveKitAudioRoute(modules, 'room-reconnected');
    });
  }

  room.on(modules.RoomEvent.Disconnected, () => {
    const meta = getRoomMeta(room);
    const previousState = meta?.connectionState ?? 'unknown';

    if (!isCurrentRoomEvent(room, connectionSeq)) {
      if (meta) {
        meta.connectionState = 'disconnected';
      }

      logLiveKit({
        staleRoomEventIgnored: true,
        event: 'disconnected',
        eventRoomName: roomName,
        activeRoomName: activeRoomName ?? 'none',
        previousState,
        staleRoomRegistryCleanup: Boolean(meta),
        managedRoomCount: managedRooms.size,
        connectionSeq,
        activeConnectionSeq,
      });
      forgetRoom(room);
      return;
    }

    if (meta) {
      meta.connectionState = 'disconnected';
    }

    logLiveKit({
      connectionStateChanged: true,
      from: previousState,
      to: 'disconnected',
      shouldCloseScreen: false,
      event: 'disconnected',
      roomDisconnected: true,
      connectionSeq,
      activeConnectionSeq,
      roomName,
      normalizedRoomName: roomName,
    });
  });

  room.on(modules.RoomEvent.ParticipantConnected, (participant: unknown) => {
    if (!isCurrentRoomEvent(room, connectionSeq)) {
      logLiveKit({
        staleRoomEventIgnored: true,
        event: 'participant-connected',
        eventRoomName: roomName,
        activeRoomName: activeRoomName ?? 'none',
        staleRemoteParticipantIgnored: true,
        connectionSeq,
        activeConnectionSeq,
      });
      return;
    }

    logLiveKit({
      remoteParticipantConnected: true,
      remoteParticipantIdentity: readRecordValue(participant, 'identity') ?? 'unknown',
      connectionSeq,
      activeConnectionSeq,
      roomName,
      normalizedRoomName: roomName,
    });
  });

  room.on(modules.RoomEvent.TrackSubscribed, (track: unknown, publication: unknown, participant: unknown) => {
    if (!isCurrentRoomEvent(room, connectionSeq)) {
      logLiveKit({
        staleRoomEventIgnored: true,
        event: 'track-subscribed',
        eventRoomName: roomName,
        activeRoomName: activeRoomName ?? 'none',
        staleRemoteTrackIgnored: true,
        reason: 'stale-connection',
        connectionSeq,
        activeConnectionSeq,
        participantStillPresent: false,
      });
      return;
    }

    const participantStillPresent = isParticipantStillPresent(room, participant);

    if (!participantStillPresent) {
      logLiveKit({
        staleRemoteTrackIgnored: true,
        reason: 'participant-not-present',
        participantStillPresent,
        connectionSeq,
        activeConnectionSeq,
        remoteParticipantIdentity: readRecordValue(participant, 'identity') ?? 'unknown',
        roomName,
      });
      return;
    }

    const nextTrack = track as LiveKitTrack;

    if (nextTrack.kind !== modules.Track.Kind.Audio) {
      return;
    }

    const trackSid = getRemoteAudioTrackKey(nextTrack, publication, participant);

    if (trackSid && activeProcessedRemoteTrackSids.has(trackSid)) {
      logLiveKit({
        duplicateRemoteTrackIgnored: true,
        remoteTrackSid: trackSid,
        connectionSeq,
        activeConnectionSeq,
        roomName,
      });
      return;
    }

    if (trackSid) {
      activeProcessedRemoteTrackSids.add(trackSid);
    }

    activeRemoteAudioTracks.set(trackSid, nextTrack);
    applyRemoteAudioVolume(nextTrack, trackSid);

    const publicationMuted = readRecordValue(publication, 'isMuted');
    const publicationSubscribed = readRecordValue(publication, 'isSubscribed');
    const publicationSource = readRecordValue(publication, 'source');
    const participantIdentity = readRecordValue(participant, 'identity');
    const remoteTrackMuted = Boolean(nextTrack.isMuted ?? publicationMuted ?? nextTrack.mediaStreamTrack?.muted);
    const remoteTrackEnabled = nextTrack.mediaStreamTrack?.enabled ?? true;
    lastRemoteAudioTrackDebug = {
      muted: remoteTrackMuted,
      enabled: remoteTrackEnabled,
    };

    logLiveKit({
      remoteAudioTrackSubscribed: true,
      remoteAudioTrackMuted: remoteTrackMuted,
      remoteAudioTrackEnabled: remoteTrackEnabled,
      remotePublicationSubscribed: publicationSubscribed ?? true,
      remoteParticipantIdentity: typeof participantIdentity === 'string' ? participantIdentity : 'unknown',
      remoteTrackSid: trackSid ?? 'unknown',
      remoteTrackSource: nextTrack.source ?? (typeof publicationSource === 'string' ? publicationSource : 'unknown'),
      remoteMediaStreamTrackId: nextTrack.mediaStreamTrack?.id ?? 'unknown',
      remoteMediaStreamTrackState: nextTrack.mediaStreamTrack?.readyState ?? 'unknown',
      remoteAudioVolumeSet: typeof nextTrack.setVolume === 'function',
      participantStillPresent,
      connectionSeq,
      activeConnectionSeq,
      roomName,
      normalizedRoomName: roomName,
    });
    void restoreLiveKitAudioRoute(modules, `remote-track-subscribed:${trackSid ?? 'unknown'}`);
  });

  if (modules.RoomEvent.TrackUnsubscribed) {
    room.on(modules.RoomEvent.TrackUnsubscribed, (track: unknown, publication: unknown, participant: unknown) => {
      const nextTrack = track as LiveKitTrack;
      const trackSid = getRemoteAudioTrackKey(nextTrack, publication, participant);
      activeRemoteAudioTracks.delete(trackSid);
      activeProcessedRemoteTrackSids.delete(trackSid);
      logRemoteMute({
        remoteAudioTrackUnsubscribed: true,
        trackSid,
        connectionSeq,
        activeConnectionSeq,
      });
    });
  }
}

function getActiveMuteState() {
  if (!isLiveKitEnabled) {
    return !mockMicEnabled;
  }

  return !(activeRoom?.localParticipant.isMicrophoneEnabled ?? false);
}

export function isVoiceSessionActive() {
  return voiceConnectionState === 'connecting'
    || voiceConnectionState === 'connected'
    || isDisconnecting
    || Boolean(activeRoom)
    || Boolean(lastKnownRoom)
    || audioSessionStarted;
}

export async function restoreVoiceAudioSession(reason = 'manual'): Promise<VoiceServiceResult<true>> {
  if (!isLiveKitEnabled || !isVoiceSessionActive()) {
    return { data: true, error: null };
  }

  const modules = await getLiveKitModules();

  if (!modules) {
    return { data: null, error: { message: 'LiveKit modulleri yuklenemedi.' } };
  }

  await restoreLiveKitAudioRoute(modules, reason);
  return { data: true, error: null };
}

async function buildAuthHeaders(): Promise<VoiceServiceResult<AuthHeaderPayload>> {
  const sessionResult = await getSession();
  const sessionToken = sessionResult.data?.access_token;
  const currentUserId = sessionResult.data?.user?.id;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (sessionResult.error) {
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(sessionResult.error, 'Oturumun sona ermiş olabilir. Lütfen tekrar giriş yap.') },
    };
  }

  if (!sessionToken) {
    return {
      data: null,
      error: { message: 'Sesli gorusme icin aktif kullanici oturumu gerekli.' },
    };
  }

  if (!currentUserId) {
    return {
      data: null,
      error: { message: 'Sesli gorusme icin aktif kullanici oturumu gerekli.' },
    };
  }

  return {
    data: {
      currentUserId,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
    },
    error: null,
  };
}

async function releaseTokenSession() {
  if (!isLiveKitEnabled) {
    mockRoomId = null;
    mockMicEnabled = true;
    return;
  }

  const endpoint = getFunctionUrl();

  if (!endpoint) {
    return;
  }

  const headerResult = await buildAuthHeaders();

  if (headerResult.error || !headerResult.data) {
    return;
  }

  try {
    await fetch(endpoint, {
      method: 'DELETE',
      headers: headerResult.data.headers,
    });
  } catch {
    // Release failures should not block local disconnect cleanup.
  }
}

export async function createToken(
  peerUserId: string,
  roomId?: string | null,
): Promise<VoiceServiceResult<CreateTokenPayload>> {
  const endpoint = getFunctionUrl();
  const wsUrl = getLivekitUrl();
  const normalizedRoomName = normalizeRoomName(roomId);

  logLiveKit({
    livekitEnabled: isLiveKitEnabled,
    livekitUrlExists: Boolean(wsUrl),
    tokenEndpointExists: Boolean(endpoint),
    tokenEndpoint: endpoint || 'missing',
    roomId: roomId ?? null,
    normalizedRoomName: normalizedRoomName || 'server-private-room',
    peerUserId,
    tokenReceived: false,
  });

  if (!isLiveKitEnabled) {
    logMockMode();
    logLiveKit({
      mockCall: true,
      reason: 'livekit-disabled',
      roomId: roomId ?? null,
      normalizedRoomName: normalizedRoomName || getMockRoomId(peerUserId),
      peerUserId,
    });
    return {
      data: {
        roomName: normalizedRoomName || getMockRoomId(peerUserId),
        token: `mock-token-${peerUserId.trim() || 'peer'}`,
        wsUrl: 'mock://livekit-disabled',
      },
      error: null,
    };
  }

  if (!endpoint) {
    logLiveKit({ tokenError: true, errorCode: 'missing_token_endpoint', tokenErrorMessage: 'token endpoint missing' });
    return {
      data: null,
      error: { message: 'LiveKit token endpoint tanimli degil. EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT ayarla.' },
    };
  }

  if (!wsUrl) {
    logLiveKit({ tokenError: true, errorCode: 'missing_livekit_url', tokenErrorMessage: 'livekit url missing' });
    return {
      data: null,
      error: { message: 'LiveKit URL tanimli degil. EXPO_PUBLIC_LIVEKIT_URL ayarla.' },
    };
  }

  try {
    const headerResult = await buildAuthHeaders();

    if (headerResult.error || !headerResult.data) {
      logLiveKit({
        tokenError: true,
        errorCode: 'missing_auth_session',
        tokenErrorMessage: headerResult.error?.message ?? 'auth header unavailable',
      });
      return { data: null, error: headerResult.error };
    }

    logLiveKit({
      currentUserId: headerResult.data.currentUserId,
      peerUserId,
      roomId: roomId ?? null,
      normalizedRoomName: normalizedRoomName || 'server-private-room',
      tokenRequestStart: true,
      authorizationHeader: true,
      tokenEndpoint: endpoint,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headerResult.data.headers,
      body: JSON.stringify({
        peerUserId,
        roomId,
      }),
    });

    const payload = await response.json().catch(() => null);

    logLiveKit({
      tokenResponseStatus: response.status,
      tokenReceived: typeof payload?.token === 'string' && payload.token.length > 0,
      roomName: typeof payload?.roomName === 'string' ? payload.roomName : normalizedRoomName || 'missing',
      normalizedRoomName: typeof payload?.roomName === 'string' ? payload.roomName : normalizedRoomName || 'missing',
    });

    if (!response.ok) {
      logLiveKit({
        tokenError: true,
        errorCode: typeof payload?.code === 'string' ? payload.code : `http_${response.status}`,
        tokenErrorMessage: typeof payload?.error === 'string' ? payload.error : 'token request failed',
      });
      return {
        data: null,
        error: { message: typeof payload?.error === 'string' ? payload.error : 'LiveKit token olusturulamadi.' },
      };
    }

    if (typeof payload?.token !== 'string' || payload.token.length === 0) {
      logLiveKit({ tokenError: true, errorCode: 'missing_token', tokenErrorMessage: 'token missing in response', tokenReceived: false });
      return {
        data: null,
        error: { message: 'LiveKit token endpoint gecerli bir token donmedi.' },
      };
    }

    return {
      data: {
        roomName: typeof payload?.roomName === 'string' && payload.roomName.length > 0 ? payload.roomName : normalizedRoomName,
        token: payload.token,
        wsUrl: typeof payload?.wsUrl === 'string' && payload.wsUrl.length > 0
          ? payload.wsUrl
          : typeof payload?.livekitUrl === 'string' && payload.livekitUrl.length > 0
            ? payload.livekitUrl
            : typeof payload?.url === 'string' && payload.url.length > 0
              ? payload.url
              : wsUrl,
      },
      error: null,
    };
  } catch (error) {
    logLiveKit({
      tokenError: true,
      errorCode: 'token_request_exception',
      tokenErrorMessage: getFriendlyErrorMessage(error, 'token request exception'),
    });
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Sesli görüşme başlatılamadı. Lütfen tekrar deneyin.') },
    };
  }
}

export async function joinRoom(
  peerUserId: string,
  roomId?: string | null,
): Promise<VoiceServiceResult<VoiceRoomState>> {
  const normalizedRoomName = normalizeRoomName(roomId);
  const requestedRoomName = buildRoomKey(roomId, normalizedRoomName || getMockRoomId(peerUserId));
  const endpoint = getFunctionUrl();
  const wsUrl = getLivekitUrl();

  logLiveKit({
    joinRoomStart: true,
    connectionState: voiceConnectionState,
    livekitEnabled: isLiveKitEnabled,
    livekitUrlExists: Boolean(wsUrl),
    tokenEndpointExists: Boolean(endpoint),
    tokenEndpoint: endpoint || 'missing',
    peerUserId,
    roomId: roomId ?? null,
    normalizedRoomName: normalizedRoomName || 'server-private-room',
    requestedRoomName,
    activeRoomName: activeRoomName ?? 'none',
    activeRoomId: activeRoomId ?? 'none',
    microphonePermission: isLiveKitEnabled ? 'granted-before-join' : 'mock-not-required',
  });

  if (!isLiveKitEnabled) {
    if (voiceConnectionState === 'connected' && mockRoomId === requestedRoomName) {
      logLiveKit({
        duplicateJoinIgnored: true,
        connectionState: voiceConnectionState,
        requestedRoomName,
      });
      return { data: getConnectedVoiceState(), error: null };
    }

    logMockMode();
    mockRoomId = roomId?.trim() || getMockRoomId(peerUserId);
    mockMicEnabled = true;
    activeSpeakerEnabled = true;
    resetRemoteAudioRefs();
    activeRoomName = requestedRoomName;
    activeRoomId = roomId ?? requestedRoomName;
    voiceConnectionState = 'connected';
    logLiveKit({
      mockCall: true,
      reason: 'livekit-disabled',
      peerUserId,
      roomId: roomId ?? null,
      normalizedRoomName: mockRoomId,
      roomConnected: true,
      microphonePublishSuccess: true,
    });

    return {
      data: {
        muted: false,
        speakerEnabled: true,
        remoteMuted: activeRemoteMuted,
      },
      error: null,
    };
  }

  if (isDisconnecting && activeDisconnectPromise) {
    await activeDisconnectPromise;
  }

  if (voiceConnectionState === 'connecting' && activeJoinPromise && activeRoomName === requestedRoomName) {
    logLiveKit({
      duplicateJoinIgnored: true,
      connectionState: voiceConnectionState,
      requestedRoomName,
      activeRoomName,
    });
    return activeJoinPromise;
  }

  if (voiceConnectionState === 'connected' && activeRoom && activeRoomName === requestedRoomName) {
    logLiveKit({
      duplicateJoinIgnored: true,
      connectionState: voiceConnectionState,
      requestedRoomName,
      activeRoomName,
    });
    return { data: getConnectedVoiceState(), error: null };
  }

  if (voiceConnectionState !== 'idle' || activeRoom) {
    await leaveRoom({ reason: 'new-room-replace' });
  }

  await hardCleanupStaleRooms('before-new-join', requestedRoomName);

  const connectionSeq = activeConnectionSeq + 1;
  activeConnectionSeq = connectionSeq;
  voiceConnectionState = 'connecting';
  activeRoomName = requestedRoomName;
  activeRoomId = roomId ?? requestedRoomName;
  isMicrophonePublished = false;
  activeProcessedRemoteTrackSids = new Set<string>();
  resetRemoteAudioRefs();

  activeJoinPromise = (async () => {
  const tokenResult = await createToken(peerUserId, roomId);

  if (tokenResult.error || !tokenResult.data) {
    voiceConnectionState = 'idle';
    activeRoomName = null;
    activeRoomId = null;
    logLiveKit({
      tokenReceived: false,
      tokenError: true,
      errorCode: 'token_unavailable',
      tokenErrorMessage: tokenResult.error?.message ?? 'token unavailable',
      peerUserId,
      roomId: roomId ?? null,
      normalizedRoomName: normalizedRoomName || 'missing',
    });
    return { data: null, error: tokenResult.error };
  }

  let connectionStep: 'modules' | 'audio-session' | 'connect' | 'microphone' | 'speaker' = 'modules';
  let room: LiveKitRoomInstance | null = null;

  try {
    const modules = await getLiveKitModules();

    if (!modules) {
      logLiveKit({ nativeModuleMissing: true, errorCode: 'native_module_missing', peerUserId, roomId: roomId ?? null, normalizedRoomName: normalizedRoomName || 'missing' });
      return {
        data: null,
        error: { message: 'LiveKit modulleri yuklenemedi.' },
      };
    }

    connectionStep = 'audio-session';
    await startLiveKitAudioSession(modules);

    connectionStep = 'connect';
    room = new modules.Room({
      adaptiveStream: true,
      dynacast: true,
    });
    const resolvedRoomName = tokenResult.data.roomName || normalizedRoomName || requestedRoomName;
    rememberRoom(room, resolvedRoomName, roomId ?? null, connectionSeq);
    activeRoom = room;
    activeRoomName = resolvedRoomName;
    attachRoomListeners(room, modules, resolvedRoomName, connectionSeq);
    setRoomConnectionState(room, 'connecting');

    logLiveKit({
      roomConnectStart: true,
      peerUserId,
      roomId: roomId ?? null,
      roomName: resolvedRoomName,
      normalizedRoomName: resolvedRoomName,
      connectionSeq,
      activeConnectionSeq,
    });
    await room.connect(tokenResult.data.wsUrl, tokenResult.data.token, {
      autoSubscribe: true,
    });

    if (connectionSeq !== activeConnectionSeq || activeRoom !== room || voiceConnectionState !== 'connecting') {
      logLiveKit({
        staleJoinResultIgnored: true,
        staleConnectResultIgnored: true,
        stage: 'connect',
        connectionSeq,
        activeConnectionSeq,
        requestedRoomName,
      });
      await safeDisconnectRoom(room, 'stale-connect-result', connectionSeq);
      return { data: null, error: { message: 'Sesli gorusme baglantisi yenilendi.' } };
    }

    voiceConnectionState = 'connected';
    setRoomConnectionState(room, 'connected');
    logLiveKit({
      roomConnected: true,
      peerUserId,
      roomName: resolvedRoomName,
      normalizedRoomName: resolvedRoomName,
      connectionSeq,
      activeConnectionSeq,
    });

    if (room.localParticipant.isMicrophoneEnabled || isMicrophonePublished) {
      isMicrophonePublished = true;
      logLiveKit({
        microphoneAlreadyPublished: true,
        roomName: resolvedRoomName,
        normalizedRoomName: resolvedRoomName,
        connectionSeq,
        activeConnectionSeq,
      });
    } else {
      logLiveKit({
        microphonePublishStart: true,
        roomName: resolvedRoomName,
        normalizedRoomName: resolvedRoomName,
        connectionSeq,
        activeConnectionSeq,
      });
      connectionStep = 'microphone';
      await room.localParticipant.setMicrophoneEnabled(true);
      isMicrophonePublished = true;
      logLiveKit({
        microphonePublishSuccess: true,
        roomName: resolvedRoomName,
        normalizedRoomName: resolvedRoomName,
        connectionSeq,
        activeConnectionSeq,
      });
    }
    await applyLiveKitCallAudioConfiguration(modules, 'post-microphone-publish');
    connectionStep = 'speaker';
    await selectAudioOutput(true, { allowFailure: true });
    startAudioLevelDebug(room, resolvedRoomName, connectionSeq);

    return {
      data: {
        muted: getActiveMuteState(),
        speakerEnabled: activeSpeakerEnabled,
        remoteMuted: activeRemoteMuted,
      },
      error: null,
    };
  } catch (error) {
    if (connectionSeq !== activeConnectionSeq) {
      logLiveKit({
        staleJoinResultIgnored: true,
        staleConnectResultIgnored: true,
        stage: connectionStep,
        connectionSeq,
        activeConnectionSeq,
        requestedRoomName,
        staleConnectErrorMessage: getFriendlyErrorMessage(error, 'stale room connection failed'),
      });

      if (room) {
        await safeDisconnectRoom(room, `stale-join-error-${connectionStep}`, connectionSeq);
      }

      return { data: null, error: { message: 'Sesli gorusme baglantisi yenilendi.' } };
    }

    logLiveKit({
      connectionStep,
      roomConnected: false,
      errorCode: `room_${connectionStep}_failed`,
      connectionErrorMessage: getFriendlyErrorMessage(error, 'room connection failed'),
      microphonePublishError: connectionStep === 'microphone',
      roomId: roomId ?? null,
      normalizedRoomName: normalizedRoomName || 'missing',
    });
    await leaveRoom({ reason: `join-error-${connectionStep}`, connectionSeq });
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Sesli görüşme odasına bağlanılamadı. Lütfen tekrar deneyin.') },
    };
  }

  })();

  const result = await activeJoinPromise;

  if (connectionSeq === activeConnectionSeq) {
    activeJoinPromise = null;
    if (result.error && voiceConnectionState === 'connecting') {
      voiceConnectionState = 'idle';
      activeRoomName = null;
      activeRoomId = null;
    }
  }

  return result;
}

export async function leaveRoom(options: LeaveRoomOptions = {}): Promise<VoiceServiceResult<true>> {
  const reason = options.reason ?? 'unspecified';
  const force = options.force ?? false;

  if (isDisconnecting && activeDisconnectPromise) {
    logLiveKit({
      duplicateDisconnectIgnored: true,
      reason,
      force,
      connectionState: voiceConnectionState,
      activeRoomName: activeRoomName ?? 'none',
      activeConnectionSeq,
    });
    return activeDisconnectPromise;
  }

  isDisconnecting = true;
  voiceConnectionState = 'disconnecting';
  activeConnectionSeq += 1;
  const disconnectSeq = activeConnectionSeq;

  activeDisconnectPromise = (async () => {
  try {
    if (!isLiveKitEnabled) {
      mockRoomId = null;
      mockMicEnabled = true;
      activeSpeakerEnabled = true;
      resetRemoteAudioRefs();
      activeRoomName = null;
      activeRoomId = null;
      isMicrophonePublished = false;
      lastRemoteAudioTrackDebug = { muted: false, enabled: false };
      voiceConnectionState = 'idle';
      logLiveKit({ disconnect: true, reason, livekitEnabled: false, roomConnected: false, mockCall: true, disconnectSeq });
      return { data: true, error: null };
    }

    const modules = await getLiveKitModules();
    logLiveKit({
      disconnect: true,
      reason,
      force,
      livekitEnabled: true,
      activeRoomExists: Boolean(activeRoom),
      activeRoomName: activeRoomName ?? 'none',
      managedRoomCount: managedRooms.size,
      lastKnownRoomExists: Boolean(lastKnownRoom),
      audioSessionStarted,
      disconnectSeq,
    });

    stopAudioLevelDebug(reason);
    await forceDisconnectAllRooms(reason, disconnectSeq);
    await stopLiveKitAudioSession(modules);

    await releaseTokenSession();
    resetRoomRefs();
    activeJoinPromise = null;
    isMicrophonePublished = false;
    activeRoomListenersAttached = false;
    activeProcessedRemoteTrackSids = new Set<string>();
    resetRemoteAudioRefs();
    lastRemoteAudioTrackDebug = { muted: false, enabled: false };
    voiceConnectionState = 'idle';

    return { data: true, error: null };
  } catch (error) {
    voiceConnectionState = activeRoom ? 'connected' : 'idle';
    logLiveKit({
      disconnect: true,
      reason,
      errorCode: 'disconnect_failed',
      disconnectErrorMessage: getFriendlyErrorMessage(error, 'disconnect failed'),
      disconnectSeq,
    });
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Sesli görüşme kapatılamadı. Lütfen tekrar deneyin.') },
    };
  } finally {
    isDisconnecting = false;
    activeDisconnectPromise = null;
  }

  })();

  return activeDisconnectPromise;
}

export async function toggleMute(): Promise<VoiceServiceResult<VoiceRoomState>> {
  if (!isLiveKitEnabled) {
    mockMicEnabled = !mockMicEnabled;
    return {
      data: {
        muted: !mockMicEnabled,
        speakerEnabled: activeSpeakerEnabled,
        remoteMuted: activeRemoteMuted,
      },
      error: null,
    };
  }

  if (!activeRoom) {
    return { data: null, error: { message: 'Aktif sesli gorusme baglantisi yok.' } };
  }

  try {
    const nextEnabled = !activeRoom.localParticipant.isMicrophoneEnabled;
    logLiveKit({ microphonePublishStart: nextEnabled, microphoneDisableStart: !nextEnabled });
    await activeRoom.localParticipant.setMicrophoneEnabled(nextEnabled);
    if (nextEnabled) {
      const modules = await getLiveKitModules();
      if (modules) {
        await restoreLiveKitAudioRoute(modules, 'microphone-toggle-enabled');
      }
    }
    logLiveKit({ microphonePublishSuccess: nextEnabled, microphoneDisableSuccess: !nextEnabled });

    return {
      data: {
        muted: !nextEnabled,
        speakerEnabled: activeSpeakerEnabled,
        remoteMuted: activeRemoteMuted,
      },
      error: null,
    };
  } catch (error) {
    logLiveKit({
      microphonePublishError: true,
      tokenErrorMessage: getFriendlyErrorMessage(error, 'microphone toggle failed'),
    });
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Mikrofon durumu güncellenemedi.') },
    };
  }
}

export async function toggleSpeaker(): Promise<VoiceServiceResult<VoiceRoomState>> {
  try {
    const speakerEnabled = await selectAudioOutput(!activeSpeakerEnabled);

    return {
      data: {
        muted: getActiveMuteState(),
        speakerEnabled,
        remoteMuted: activeRemoteMuted,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Hoparlör durumu güncellenemedi.') },
    };
  }
}

export async function toggleRemoteMute(): Promise<VoiceServiceResult<VoiceRoomState>> {
  const muted = !activeRemoteMuted;
  const volume = muted ? 0 : 1;

  logRemoteMute({
    remoteMuteStart: true,
    muted,
    knownTrackCount: activeRemoteAudioTracks.size,
  });

  if (!isLiveKitEnabled) {
    activeRemoteMuted = muted;
    logRemoteMute({
      remoteMuteSuccess: true,
      muted: activeRemoteMuted,
      volume,
      mockCall: true,
    });
    return { data: getConnectedVoiceState(), error: null };
  }

  if (!activeRoom && activeRemoteAudioTracks.size === 0) {
    return { data: null, error: { message: 'Aktif sesli gorusme baglantisi yok.' } };
  }

  try {
    activeRemoteMuted = muted;
    const modules = await getLiveKitModules();

    if (modules?.AudioSession.setDefaultRemoteAudioTrackVolume) {
      await modules.AudioSession.setDefaultRemoteAudioTrackVolume(volume);
    }

    applyRemoteMuteToKnownTracks(muted);
    logRemoteMute({
      remoteMuteSuccess: true,
      muted: activeRemoteMuted,
      volume,
      knownTrackCount: activeRemoteAudioTracks.size,
    });

    return { data: getConnectedVoiceState(), error: null };
  } catch (error) {
    activeRemoteMuted = !muted;
    applyRemoteMuteToKnownTracks(activeRemoteMuted);
    logRemoteMute({
      remoteMuteError: getFriendlyErrorMessage(error, 'remote mute failed'),
      muted,
    });
    return {
      data: null,
      error: { message: getFriendlyErrorMessage(error, 'Karşı tarafın sesi güncellenemedi.') },
    };
  }
}
