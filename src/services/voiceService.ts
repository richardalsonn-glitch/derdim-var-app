import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { Room, RoomEvent, Track } from 'livekit-client';

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

let activeRoom: Room | null = null;
let activeSpeakerEnabled = true;

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

async function selectAudioOutput(enableSpeaker: boolean) {
  const outputs = await AudioSession.getAudioOutputs();

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

  await AudioSession.selectAudioOutput(preferredOutput);
  activeSpeakerEnabled = enableSpeaker;
  return activeSpeakerEnabled;
}

function getActiveMuteState() {
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
  const tokenResult = await createToken(peerUserId);

  if (tokenResult.error || !tokenResult.data) {
    return { data: null, error: tokenResult.error };
  }

  try {
    await leaveRoom();
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: ['speaker', 'earpiece', 'headset', 'bluetooth'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: {
        defaultOutput: 'speaker',
      },
    });
    await AudioSession.startAudioSession();

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    room.on(RoomEvent.Disconnected, () => {
      activeRoom = null;
    });
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
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

    await AudioSession.stopAudioSession();
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
