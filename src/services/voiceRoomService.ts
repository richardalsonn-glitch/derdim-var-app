import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { VoiceRoom, VoiceRoomJoinRequest, VoiceRoomMember, VoiceRoomPricingType, VoiceRoomStatus, VoiceRoomType } from '../types';
import { getDeterministicAvatarId, resolveAvatarId } from '../utils/avatarResolver';
import { resolveDisplayName } from './authService';

type ServiceError = {
  message: string;
};

type ServiceResult<T> = {
  data: T | null;
  error: ServiceError | null;
};

type VoiceRoomRow = {
  id: string;
  room_type: VoiceRoomType;
  pricing_type: VoiceRoomPricingType;
  name: string | null;
  owner_id: string | null;
  status: VoiceRoomStatus;
  capacity: number;
  current_count: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type VoiceRoomMemberRow = {
  id: string;
  room_id: string;
  user_id: string;
  role: VoiceRoomMember['role'];
  seat_index: number | null;
  mic_enabled: boolean | null;
  speaker_enabled: boolean | null;
  status: VoiceRoomMember['status'];
  joined_at: string;
};

type VoiceRoomRequestRow = {
  id: string;
  room_id: string;
  requester_id: string;
  status: VoiceRoomJoinRequest['status'];
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  avatar_id: string | null;
};

const genericError: ServiceError = {
  message: 'İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.',
};

function logRealtimeNotice(scope: string) {
  logSafeDebug(`${scope}: bağlantı sessizce yenileniyor`, 'realtime reconnect');
}

function normalizeRoom(row: VoiceRoomRow, members: VoiceRoomMember[], requests: VoiceRoomJoinRequest[]): VoiceRoom {
  return {
    id: row.id,
    roomType: row.room_type,
    pricingType: row.pricing_type,
    name: row.name || 'Şu anda bu oda müsaittir',
    ownerId: row.owner_id,
    status: row.status,
    capacity: row.capacity,
    currentCount: row.current_count ?? 0,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    members,
    requests,
  };
}

function profileFor(userId: string, profiles: Map<string, ProfileRow>) {
  const profile = profiles.get(userId);
  const fallbackAvatarId = getDeterministicAvatarId(userId);

  return {
    username: resolveDisplayName({
      username: profile?.username,
    }),
    avatarId: resolveAvatarId(profile?.avatar_id?.trim() || fallbackAvatarId),
  };
}

async function getProfiles(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_id')
    .in('user_id', uniqueUserIds);

  if (error || !data) {
    return new Map<string, ProfileRow>();
  }

  return new Map((data as ProfileRow[]).map((profile) => [profile.user_id, profile]));
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user?.id ?? null;
}

export async function fetchNightVoiceRooms(): Promise<ServiceResult<VoiceRoom[]>> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    const { data: rooms, error: roomError } = await supabase
      .from('voice_rooms')
      .select('id, room_type, pricing_type, name, owner_id, status, capacity, current_count, starts_at, expires_at, created_at, updated_at')
      .eq('room_type', 'night')
      .in('status', ['open', 'full', 'active'])
      .order('pricing_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (roomError) {
      return { data: null, error: genericError };
    }

    const roomRows = (rooms ?? []) as VoiceRoomRow[];
    const roomIds = roomRows.map((room) => room.id);

    if (roomIds.length === 0) {
      return { data: [], error: null };
    }

    const [{ data: memberData }, { data: requestData }] = await Promise.all([
      supabase
        .from('voice_room_members')
        .select('id, room_id, user_id, role, seat_index, mic_enabled, speaker_enabled, status, joined_at')
        .in('room_id', roomIds)
        .eq('status', 'joined')
        .order('seat_index', { ascending: true }),
      supabase
        .from('voice_room_join_requests')
        .select('id, room_id, requester_id, status, created_at')
        .in('room_id', roomIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);

    const memberRows = (memberData ?? []) as VoiceRoomMemberRow[];
    const requestRows = (requestData ?? []) as VoiceRoomRequestRow[];
    const profiles = await getProfiles([...memberRows.map((member) => member.user_id), ...requestRows.map((request) => request.requester_id)]);

    const membersByRoom = new Map<string, VoiceRoomMember[]>();
    const requestsByRoom = new Map<string, VoiceRoomJoinRequest[]>();

    memberRows.forEach((member) => {
      const profile = profileFor(member.user_id, profiles);
      const normalized: VoiceRoomMember = {
        id: member.id,
        roomId: member.room_id,
        userId: member.user_id,
        username: profile.username,
        avatarId: profile.avatarId,
        role: member.role,
        seatIndex: member.seat_index,
        micEnabled: Boolean(member.mic_enabled),
        speakerEnabled: Boolean(member.speaker_enabled),
        status: member.status,
        joinedAt: member.joined_at,
      };

      membersByRoom.set(member.room_id, [...(membersByRoom.get(member.room_id) ?? []), normalized]);
    });

    requestRows.forEach((request) => {
      const profile = profileFor(request.requester_id, profiles);
      const normalized: VoiceRoomJoinRequest = {
        id: request.id,
        roomId: request.room_id,
        requesterId: request.requester_id,
        requesterUsername: profile.username,
        requesterAvatarId: profile.avatarId,
        status: request.status,
        createdAt: request.created_at,
      };

      requestsByRoom.set(request.room_id, [...(requestsByRoom.get(request.room_id) ?? []), normalized]);
    });

    return {
      data: roomRows.map((room) => normalizeRoom(room, membersByRoom.get(room.id) ?? [], requestsByRoom.get(room.id) ?? [])),
      error: null,
    };
  } catch {
    return { data: null, error: genericError };
  }
}

export async function fetchNightVoiceRoom(roomId: string): Promise<ServiceResult<VoiceRoom>> {
  const result = await fetchNightVoiceRooms();

  if (result.error || !result.data) {
    return { data: null, error: result.error ?? genericError };
  }

  const room = result.data.find((item) => item.id === roomId);

  if (!room) {
    return { data: null, error: { message: 'Oda şu anda kullanılamıyor.' } };
  }

  return { data: room, error: null };
}

function removeExistingRealtimeChannels(topic: string) {
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);

  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });
}

function createRealtimeSubscription(topic: string, buildChannel: () => ReturnType<typeof supabase.channel>, scope: string) {
  let activeChannel: ReturnType<typeof supabase.channel> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer) {
      return;
    }

    retryTimer = setTimeout(() => {
      retryTimer = null;

      if (!disposed) {
        connect();
      }
    }, 3000);
  };

  const connect = () => {
    if (disposed) {
      return;
    }

    try {
      removeExistingRealtimeChannels(topic);
      activeChannel = buildChannel().subscribe((status) => {
        if (disposed) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          clearRetry();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logRealtimeNotice(scope);
          scheduleReconnect();
          return;
        }

        if (status === 'CLOSED') {
          scheduleReconnect();
        }
      });
    } catch {
      logRealtimeNotice(scope);
      scheduleReconnect();
    }
  };

  connect();

  return () => {
    disposed = true;
    clearRetry();

    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}

export function subscribeToNightVoiceRoomsLobby(onChange: () => void) {
  if (!isSupabaseConfigured) {
    return () => undefined;
  }

  const topic = 'realtime:night-voice-rooms-lobby';
  removeExistingRealtimeChannels(topic);

  return createRealtimeSubscription(
    topic,
    () => supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_rooms' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_members' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_join_requests' }, onChange),
    'Gece Modu lobby',
  );
}

export function subscribeToNightVoiceRoom(roomId: string, onChange: () => void) {
  if (!isSupabaseConfigured) {
    return () => undefined;
  }

  const topic = `realtime:night-room-${roomId}`;
  removeExistingRealtimeChannels(topic);

  return createRealtimeSubscription(
    topic,
    () => supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_rooms', filter: `id=eq.${roomId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_members', filter: `room_id=eq.${roomId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_join_requests', filter: `room_id=eq.${roomId}` }, onChange),
    'Gece Modu oda',
  );
}

async function callRoomRpc(functionName: string, params: Record<string, unknown>): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: { message: 'Bu işlem için giriş yapman gerekiyor.' } };
  }

  const { error } = await supabase.rpc(functionName, params);

  if (error) {
    return { data: null, error: genericError };
  }

  return { data: true, error: null };
}

export function joinVoiceRoomSeat(roomId: string, seatIndex: number) {
  return callRoomRpc('join_voice_room_seat', { p_room_id: roomId, p_seat_index: seatIndex });
}

export function leaveVoiceRoom(roomId: string) {
  return callRoomRpc('leave_voice_room', { p_room_id: roomId });
}

export function renameVoiceRoom(roomId: string, name: string) {
  return callRoomRpc('rename_voice_room', { p_room_id: roomId, p_name: name });
}

export function requestPaidVoiceRoomJoin(roomId: string) {
  return callRoomRpc('request_paid_voice_room_join', { p_room_id: roomId });
}

export function decidePaidVoiceRoomRequest(requestId: string, approve: boolean) {
  return callRoomRpc('decide_paid_voice_room_request', { p_request_id: requestId, p_approve: approve });
}

export function removeVoiceRoomMember(roomId: string, memberUserId: string) {
  return callRoomRpc('remove_voice_room_member', { p_room_id: roomId, p_member_user_id: memberUserId });
}

export function setVoiceRoomMemberAudio(roomId: string, memberUserId: string, micEnabled: boolean, speakerEnabled: boolean) {
  return callRoomRpc('set_voice_room_member_audio', {
    p_room_id: roomId,
    p_member_user_id: memberUserId,
    p_mic_enabled: micEnabled,
    p_speaker_enabled: speakerEnabled,
  });
}

export function expireVoiceRoom(roomId: string) {
  return callRoomRpc('expire_voice_room', { p_room_id: roomId });
}
