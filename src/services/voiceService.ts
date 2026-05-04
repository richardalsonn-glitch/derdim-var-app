import { isLiveKitEnabled } from '../config/features';
import { getSession } from './authService';

type VoiceServiceError = {
  message: string;
};

type VoiceServiceResult<T> = {
  data: T | null;
  error: VoiceServiceError | null;
};

type CreateTokenPayload = {
  token: string;
  wsUrl: string;
};

type VoiceRoomState = {
  muted: boolean;
  speakerEnabled: boolean;
};

type LiveKitAudioSessionModule = {
  getAudioOutputs: () => Promise<string[]>;
  selectAudioOutput: (output: string) => Promise<void>;
  configureAudio: (config: Record<string, unknown>) => Promise<void>;
  startAudioSession: () => Promise<void>;
  stopAudioSession: () => Promise<void>;
};

type LiveKitModules = {
  AudioSession: LiveKitAudioSessionModule;
  AndroidAudioTypePresets: {
    communication: unknown;
  };
  Room: new (options: Record<string, unknown>) => LiveKitRoomInstance;
  RoomEvent: {
    Disconnected: string;
    TrackSubscribed: string;
  };
  Track: {
    Kind: {
      Audio: string;
    };
  };
};

type LiveKitTrack = {
  kind?: string;
};

type LiveKitRoomInstance = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  connect: (wsUrl: string, token: string, options: Record<string, unknown>) => Promise<void>;
  disconnect: () => void;
  removeAllListeners: () => void;
  localParticipant: {
    isMicrophoneEnabled: boolean;
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  };
};

let livekitModulesCache: LiveKitModules | null = null;
let activeRoom: LiveKitRoomInstance | null = null;
let activeSpeakerEnabled = true;
let mockLiveKitLogged = false;
let mockRoomId: string | null = null;
let mockMicEnabled = true;

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

function logMockMode() {
  if (mockLiveKitLogged) {
    return;
  }

  console.info('LiveKit disabled - using mock call');
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
      Disconnected: string;
      TrackSubscribed: string;
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

async function selectAudioOutput(enableSpeaker: boolean) {
  if (!isLiveKitEnabled) {
    activeSpeakerEnabled = enableSpeaker;
    return activeSpeakerEnabled;
  }

  const modules = await getLiveKitModules();

  if (!modules) {
    activeSpeakerEnabled = enableSpeaker;
    return activeSpeakerEnabled;
  }

  const outputs = await modules.AudioSession.getAudioOutputs();

  if (outputs.length === 0) {
    return enableSpeaker;
  }

  const preferredOutput = enableSpeaker
    ? outputs.includes('speaker')
      ? 'speaker'
      : outputs.includes('force_speaker')
        ? 'force_speaker'
        : outputs[0]
    : outputs.includes('earpiece')
      ? 'earpiece'
      : outputs.includes('default')
        ? 'default'
        : outputs[0];

  await modules.AudioSession.selectAudioOutput(preferredOutput);
  activeSpeakerEnabled = enableSpeaker;
  return activeSpeakerEnabled;
}

function getActiveMuteState() {
  if (!isLiveKitEnabled) {
    return !mockMicEnabled;
  }

  return !(activeRoom?.localParticipant.isMicrophoneEnabled ?? false);
}

async function buildAuthHeaders(): Promise<VoiceServiceResult<Record<string, string>>> {
  const sessionResult = await getSession();
  const sessionToken = sessionResult.data?.access_token;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (sessionResult.error) {
    return {
      data: null,
      error: { message: sessionResult.error.message },
    };
  }

  if (!sessionToken) {
    return {
      data: null,
      error: { message: 'Sesli gorusme icin aktif kullanici oturumu gerekli.' },
    };
  }

  return {
    data: {
      Authorization: `Bearer ${sessionToken}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
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
      headers: headerResult.data,
    });
  } catch {
    // Release failures should not block local disconnect cleanup.
  }
}

export async function createToken(
  peerUserId: string,
): Promise<VoiceServiceResult<CreateTokenPayload>> {
  if (!isLiveKitEnabled) {
    logMockMode();
    return {
      data: {
        token: `mock-token-${peerUserId.trim() || 'peer'}`,
        wsUrl: 'mock://livekit-disabled',
      },
      error: null,
    };
  }

  const endpoint = getFunctionUrl();
  const wsUrl = getLivekitUrl();

  if (!endpoint) {
    return {
      data: null,
      error: { message: 'LiveKit token endpoint tanimli degil. EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT ayarla.' },
    };
  }

  if (!wsUrl) {
    return {
      data: null,
      error: { message: 'LiveKit URL tanimli degil. EXPO_PUBLIC_LIVEKIT_URL ayarla.' },
    };
  }

  try {
    const headerResult = await buildAuthHeaders();

    if (headerResult.error || !headerResult.data) {
      return { data: null, error: headerResult.error };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headerResult.data,
      body: JSON.stringify({
        peerUserId,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: { message: typeof payload?.error === 'string' ? payload.error : 'LiveKit token olusturulamadi.' },
      };
    }

    if (typeof payload?.token !== 'string' || payload.token.length === 0) {
      return {
        data: null,
        error: { message: 'LiveKit token endpoint gecerli bir token donmedi.' },
      };
    }

    return {
      data: {
        token: payload.token,
        wsUrl: typeof payload?.wsUrl === 'string' && payload.wsUrl.length > 0 ? payload.wsUrl : wsUrl,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'LiveKit token endpoint istegi basarisiz oldu.' },
    };
  }
}

export async function joinRoom(
  peerUserId: string,
): Promise<VoiceServiceResult<VoiceRoomState>> {
  if (!isLiveKitEnabled) {
    logMockMode();
    mockRoomId = getMockRoomId(peerUserId);
    mockMicEnabled = true;
    activeSpeakerEnabled = true;

    return {
      data: {
        muted: false,
        speakerEnabled: true,
      },
      error: null,
    };
  }

  const tokenResult = await createToken(peerUserId);

  if (tokenResult.error || !tokenResult.data) {
    return { data: null, error: tokenResult.error };
  }

  try {
    const modules = await getLiveKitModules();

    if (!modules) {
      return {
        data: null,
        error: { message: 'LiveKit modulleri yuklenemedi.' },
      };
    }

    await leaveRoom();
    await modules.AudioSession.configureAudio({
      android: {
        preferredOutputList: ['speaker', 'earpiece', 'headset', 'bluetooth'],
        audioTypeOptions: modules.AndroidAudioTypePresets.communication,
      },
      ios: {
        defaultOutput: 'speaker',
      },
    });
    await modules.AudioSession.startAudioSession();

    const room = new modules.Room({
      adaptiveStream: true,
      dynacast: true,
    });

    room.on(modules.RoomEvent.Disconnected, () => {
      activeRoom = null;
    });
    room.on(modules.RoomEvent.TrackSubscribed, (track: unknown) => {
      const nextTrack = track as LiveKitTrack;

      if (nextTrack.kind === modules.Track.Kind.Audio) {
        activeSpeakerEnabled = true;
      }
    });

    await room.connect(tokenResult.data.wsUrl, tokenResult.data.token, {
      autoSubscribe: true,
    });
    await room.localParticipant.setMicrophoneEnabled(true);
    await selectAudioOutput(true);
    activeRoom = room;

    return {
      data: {
        muted: getActiveMuteState(),
        speakerEnabled: activeSpeakerEnabled,
      },
      error: null,
    };
  } catch (error) {
    await leaveRoom();
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'LiveKit odasina baglanilamadi.' },
    };
  }
}

export async function leaveRoom(): Promise<VoiceServiceResult<true>> {
  try {
    if (!isLiveKitEnabled) {
      mockRoomId = null;
      mockMicEnabled = true;
      activeSpeakerEnabled = true;
      return { data: true, error: null };
    }

    const modules = await getLiveKitModules();

    if (activeRoom) {
      try {
        await activeRoom.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // ignore track shutdown errors during disconnect
      }

      activeRoom.disconnect();
      activeRoom.removeAllListeners();
      activeRoom = null;
    }

    if (modules) {
      await modules.AudioSession.stopAudioSession();
    }

    await releaseTokenSession();

    return { data: true, error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'LiveKit baglantisi kapatilamadi.' },
    };
  }
}

export async function toggleMute(): Promise<VoiceServiceResult<VoiceRoomState>> {
  if (!isLiveKitEnabled) {
    mockMicEnabled = !mockMicEnabled;
    return {
      data: {
        muted: !mockMicEnabled,
        speakerEnabled: activeSpeakerEnabled,
      },
      error: null,
    };
  }

  if (!activeRoom) {
    return { data: null, error: { message: 'Aktif sesli gorusme baglantisi yok.' } };
  }

  try {
    const nextEnabled = !activeRoom.localParticipant.isMicrophoneEnabled;
    await activeRoom.localParticipant.setMicrophoneEnabled(nextEnabled);

    return {
      data: {
        muted: !nextEnabled,
        speakerEnabled: activeSpeakerEnabled,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Mikrofon durumu guncellenemedi.' },
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
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Hoparlor durumu guncellenemedi.' },
    };
  }
}
