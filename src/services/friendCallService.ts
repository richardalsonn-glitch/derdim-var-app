import { RealtimeChannel } from '@supabase/supabase-js';

import { defaultProfile } from '../data/mockData';
import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { FriendSummary, MembershipPlan } from '../types';
import { buildFriendCallAvatarLog } from '../utils/avatarLogger';
import { getDeterministicAvatarId, resolveAvatarId } from '../utils/avatarResolver';

type ServiceResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type FriendCallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'cancelled';

export type FriendCallInvite = {
  id: string;
  callerId: string;
  receiverId: string;
  roomId: string;
  status: FriendCallStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  endedAt: string | null;
};

type FriendCallInviteRow = {
  id: string;
  caller_id: string;
  receiver_id: string;
  room_id: string;
  status: FriendCallStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  ended_at: string | null;
};

type ProfileSummaryRow = {
  user_id: string;
  username?: string | null;
  avatar_id?: string | null;
  plan?: string | null;
};

const FRIEND_CALL_ERROR_MESSAGES: Record<string, string> = {
  receiver_searching: 'Bu kullanıcı şu anda eşleşme arıyor.',
  caller_searching: 'Şu anda eşleşme arıyorsun.',
  receiver_offline: 'Bu kullanıcı şu anda çevrim dışı.',
  receiver_busy: 'Bu kullanıcı şu anda başka bir görüşmede.',
  caller_busy: 'Şu anda başka bir görüşmedesin.',
  not_friends: 'Bu kullanıcıyı aramak için arkadaş olmanız gerekiyor.',
  invalid_receiver: 'Bu kullanıcı şu anda aranamaz.',
  invite_not_found: 'Çağrı artık geçerli değil.',
  invite_not_ringing: 'Çağrı artık yanıtlanamaz.',
  invite_expired: 'Çağrı yanıtlanmadı.',
  invalid_action: 'Çağrı yanıtı işlenemedi.',
  not_authenticated: 'Oturumun sona ermiş olabilir. Lütfen tekrar giriş yap.',
};

function buildRealtimeFilter(column: string, value: string) {
  return `${column}=eq.${String(value).replace(/,/g, '%2C')}`;
}

function mapInvite(row: FriendCallInviteRow): FriendCallInvite {
  return {
    id: String(row.id),
    callerId: String(row.caller_id),
    receiverId: String(row.receiver_id),
    roomId: String(row.room_id),
    status: row.status,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    expiresAt: String(row.expires_at),
    acceptedAt: row.accepted_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    endedAt: row.ended_at ?? null,
  };
}

function mapCallError(error: unknown, fallback: string) {
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');

  const lower = message.toLowerCase();
  const safeMessages: Record<string, string> = {
    receiver_offline: 'Bu kullanıcı şu anda çevrim dışı.',
    receiver_searching: 'Bu kullanıcı şu anda eşleşme arıyor.',
    receiver_busy: 'Bu kullanıcı şu anda başka bir görüşmede.',
    caller_searching: 'Önce eşleşme aramayı durdurmalısın.',
    caller_busy: 'Şu anda başka bir görüşmedesin.',
    not_friends: 'Bu kullanıcıyı aramak için arkadaş olmalısın.',
  };
  const safeKey = Object.keys(safeMessages).find((candidate) => lower.includes(candidate));

  if (safeKey) {
    return safeMessages[safeKey];
  }

  if (lower.includes('receiver_offline')) {
    return 'Bu kullanıcı şu anda çevrim dışı.';
  }

  if (lower.includes('receiver_busy')) {
    return 'Bu kullanıcı şu anda başka bir görüşmede.';
  }

  if (lower.includes('receiver_searching')) {
    return 'Bu kullanıcı şu anda eşleşme arıyor.';
  }

  if (lower.includes('not_friends')) {
    return 'Bu kullanıcıyı aramak için arkadaş olmalısın.';
  }

  const key = Object.keys(FRIEND_CALL_ERROR_MESSAGES).find((candidate) => lower.includes(candidate));

  return key ? FRIEND_CALL_ERROR_MESSAGES[key] : fallback;
}

function getPlan(value: unknown): MembershipPlan {
  return value === 'plus' || value === 'vip' ? value : 'free';
}

function mapProfileSummary(row: ProfileSummaryRow | null | undefined): FriendSummary {
  const username = String(row?.username ?? '').trim();
  const fallbackAvatarId = getDeterministicAvatarId(String(row?.user_id ?? 'friend-call-peer'));
  const avatarId = resolveAvatarId(row?.avatar_id || fallbackAvatarId);

  return {
    id: String(row?.user_id ?? ''),
    username: username || 'Kullanıcı',
    avatarId,
    plan: getPlan(row?.plan),
  };
}

export async function createFriendCallInvite(receiverId: string): Promise<ServiceResult<FriendCallInvite>> {
  if (!isSupabaseConfigured || !receiverId) {
    return { data: null, error: { message: 'Çağrı şu anda başlatılamadı. Lütfen tekrar deneyin.' } };
  }

  const { data, error } = await supabase.rpc('create_friend_call_invite', {
    p_receiver_id: receiverId,
  });

  if (error || !data) {
    logSafeWarn('[friend-call] create invite failed', error, {
      functionName: 'createFriendCallInvite',
      rpc: 'create_friend_call_invite',
      table: 'friend_call_invites',
    });
    return {
      data: null,
      error: { message: mapCallError(error, 'Çağrı başlatılamadı. Lütfen tekrar deneyin.') },
    };
  }

  return { data: mapInvite(data as FriendCallInviteRow), error: null };
}

export async function respondFriendCallInvite(inviteId: string, action: 'accept' | 'reject'): Promise<ServiceResult<FriendCallInvite>> {
  if (!isSupabaseConfigured || !inviteId) {
    return { data: null, error: { message: 'Çağrı yanıtlanamadı. Lütfen tekrar deneyin.' } };
  }

  const { data, error } = await supabase.rpc('respond_friend_call_invite', {
    p_invite_id: inviteId,
    p_action: action,
  });

  if (error || !data) {
    logSafeWarn('[friend-call] respond invite failed', error, {
      functionName: 'respondFriendCallInvite',
      rpc: 'respond_friend_call_invite',
      table: 'friend_call_invites',
    });
    return {
      data: null,
      error: { message: mapCallError(error, 'Çağrı yanıtlanamadı. Lütfen tekrar deneyin.') },
    };
  }

  return { data: mapInvite(data as FriendCallInviteRow), error: null };
}

export async function cancelFriendCallInvite(inviteId: string): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured || !inviteId) {
    return { data: true, error: null };
  }

  const { error } = await supabase
    .from('friend_call_invites')
    .update({ status: 'cancelled' })
    .eq('id', inviteId)
    .eq('status', 'ringing');

  if (error) {
    logSafeDebug('[friend-call] cancel invite skipped', error, {
      functionName: 'cancelFriendCallInvite',
      table: 'friend_call_invites',
    });
    return { data: null, error: { message: 'Çağrı iptal edilemedi. Lütfen tekrar deneyin.' } };
  }

  return { data: true, error: null };
}

export async function markFriendCallInviteMissed(inviteId: string): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured || !inviteId) {
    return { data: true, error: null };
  }

  const { error } = await supabase.rpc('miss_friend_call_invite', {
    p_invite_id: inviteId,
  });

  if (error) {
    logSafeDebug('[friend-call] mark missed skipped', error, {
      functionName: 'markFriendCallInviteMissed',
      rpc: 'miss_friend_call_invite',
      table: 'friend_call_invites',
    });
    return { data: null, error: { message: 'Çağrı cevaplanmadı.' } };
  }

  return { data: true, error: null };
}

export async function endFriendCallInvite(roomId: string | null | undefined): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured || !roomId?.trim()) {
    return { data: true, error: null };
  }

  const { error } = await supabase.rpc('end_friend_call_invite', {
    p_room_id: roomId.trim(),
  });

  if (error) {
    logSafeDebug('[friend-call] end invite skipped', error, {
      functionName: 'endFriendCallInvite',
      rpc: 'end_friend_call_invite',
      table: 'friend_call_invites',
    });
    return { data: null, error: { message: 'Görüşme sona erdirilemedi. Lütfen tekrar deneyin.' } };
  }

  return { data: true, error: null };
}

export async function expireOldFriendCallInvites(): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured) {
    return { data: true, error: null };
  }

  const { error } = await supabase.rpc('expire_old_friend_call_invites');

  if (error) {
    logSafeDebug('[friend-call] expire invites skipped', error, {
      functionName: 'expireOldFriendCallInvites',
      rpc: 'expire_old_friend_call_invites',
      table: 'friend_call_invites',
    });
  }

  return { data: true, error: null };
}

export async function getFriendCallInvite(inviteId: string): Promise<ServiceResult<FriendCallInvite>> {
  if (!isSupabaseConfigured || !inviteId) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from('friend_call_invites')
    .select('id, caller_id, receiver_id, room_id, status, created_at, updated_at, expires_at, accepted_at, rejected_at, ended_at')
    .eq('id', inviteId)
    .maybeSingle();

  if (error) {
    logSafeDebug('[friend-call] invite lookup skipped', error, {
      functionName: 'getFriendCallInvite',
      table: 'friend_call_invites',
    });
    return { data: null, error: null };
  }

  return { data: data ? mapInvite(data as FriendCallInviteRow) : null, error: null };
}

export async function getFriendCallInviteByRoom(roomId: string | null | undefined): Promise<ServiceResult<FriendCallInvite>> {
  if (!isSupabaseConfigured || !roomId?.trim()) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from('friend_call_invites')
    .select('id, caller_id, receiver_id, room_id, status, created_at, updated_at, expires_at, accepted_at, rejected_at, ended_at')
    .eq('room_id', roomId.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSafeDebug('[friend-call] room invite lookup skipped', error, {
      functionName: 'getFriendCallInviteByRoom',
      table: 'friend_call_invites',
    });
    return { data: null, error: null };
  }

  return { data: data ? mapInvite(data as FriendCallInviteRow) : null, error: null };
}

export async function getLatestIncomingFriendCallInvite(currentUserId: string): Promise<ServiceResult<FriendCallInvite>> {
  if (!isSupabaseConfigured || !currentUserId) {
    return { data: null, error: null };
  }

  await expireOldFriendCallInvites();

  const { data, error } = await supabase
    .from('friend_call_invites')
    .select('id, caller_id, receiver_id, room_id, status, created_at, updated_at, expires_at, accepted_at, rejected_at, ended_at')
    .eq('receiver_id', currentUserId)
    .eq('status', 'ringing')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSafeDebug('[friend-call] incoming invite lookup skipped', error, {
      functionName: 'getLatestIncomingFriendCallInvite',
      table: 'friend_call_invites',
    });
    return { data: null, error: null };
  }

  return { data: data ? mapInvite(data as FriendCallInviteRow) : null, error: null };
}

export async function getFriendCallPeerProfile(userId: string): Promise<ServiceResult<FriendSummary>> {
  if (!isSupabaseConfigured || !userId) {
    return {
      data: {
        id: userId,
        username: 'Kullanıcı',
        avatarId: getDeterministicAvatarId(userId),
        plan: 'free',
      },
      error: null,
    };
  }

  const profileResult = await supabase
    .from('profiles')
    .select('user_id, username, avatar_id, plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileResult.data?.user_id) {
    const profile = mapProfileSummary(profileResult.data as ProfileSummaryRow);
    logSafeDebug('[friend-call-avatar] peer profile resolved', buildFriendCallAvatarLog({
      screen: 'voicecall',
      peerUserId: userId,
      rawAvatarId: profileResult.data.avatar_id,
    }));

    return { data: profile, error: null };
  }

  if (profileResult.error) {
    logSafeDebug('[friend-call] profile direct lookup skipped', profileResult.error, {
      functionName: 'getFriendCallPeerProfile',
      table: 'profiles',
    });
  }

  const { data, error } = await supabase.rpc('get_visible_profile_summaries', {
    p_user_ids: [userId],
  });

  if (error) {
    logSafeDebug('[friend-call] profile rpc skipped', error, {
      functionName: 'getFriendCallPeerProfile',
      rpc: 'get_visible_profile_summaries',
      table: 'profiles',
    });
    logSafeDebug('[friend-call-avatar] peer profile resolved', buildFriendCallAvatarLog({
      screen: 'voicecall',
      peerUserId: userId,
      rawAvatarId: getDeterministicAvatarId(userId),
    }));
    return {
      data: {
        id: userId,
        username: 'Kullanıcı',
        avatarId: getDeterministicAvatarId(userId),
        plan: 'free',
      },
      error: null,
    };
  }

  const row = Array.isArray(data) ? data[0] as ProfileSummaryRow | undefined : undefined;
  const profile = mapProfileSummary(row ? { ...row, user_id: userId } : { user_id: userId });

  logSafeDebug(
    '[friend-call-avatar] peer profile resolved',
    buildFriendCallAvatarLog({
      screen: 'voicecall',
      peerUserId: userId,
      rawAvatarId: row?.avatar_id ?? profile.avatarId,
    }),
  );

  return { data: profile, error: null };
}

export function subscribeToIncomingFriendCallInvites(
  currentUserId: string,
  onInvite: (invite: FriendCallInvite) => void,
): RealtimeChannel | null {
  if (!isSupabaseConfigured || !currentUserId) {
    return null;
  }

  const topic = `friend-call-incoming:${currentUserId}`;
  supabase.getChannels()
    .filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`)
    .forEach((channel) => {
      void supabase.removeChannel(channel);
    });

  return supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_call_invites',
        filter: buildRealtimeFilter('receiver_id', currentUserId),
      },
      (payload) => {
        const row = payload.new as FriendCallInviteRow | undefined;

        if (row?.status === 'ringing' && new Date(row.expires_at).getTime() > Date.now()) {
          onInvite(mapInvite(row));
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[friend-call] incoming realtime reconnect', `status:${status}`);
      }
    });
}

export function subscribeToFriendCallInvite(
  inviteId: string,
  onChange: (invite: FriendCallInvite) => void,
): RealtimeChannel | null {
  if (!isSupabaseConfigured || !inviteId) {
    return null;
  }

  const topic = `friend-call-invite:${inviteId}`;
  supabase.getChannels()
    .filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`)
    .forEach((channel) => {
      void supabase.removeChannel(channel);
    });

  return supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_call_invites',
        filter: buildRealtimeFilter('id', inviteId),
      },
      (payload) => {
        const row = payload.new as FriendCallInviteRow | undefined;

        if (row) {
          onChange(mapInvite(row));
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[friend-call] invite realtime reconnect', `status:${status}`);
      }
    });
}

export function subscribeToFriendCallRoom(
  roomId: string | null | undefined,
  onChange: (invite: FriendCallInvite) => void,
): RealtimeChannel | null {
  const normalizedRoomId = roomId?.trim();

  if (!isSupabaseConfigured || !normalizedRoomId) {
    return null;
  }

  const topic = `friend-call-room:${normalizedRoomId}`;
  supabase.getChannels()
    .filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`)
    .forEach((channel) => {
      void supabase.removeChannel(channel);
    });

  return supabase
    .channel(topic)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_call_invites',
        filter: buildRealtimeFilter('room_id', normalizedRoomId),
      },
      (payload) => {
        const row = payload.new as FriendCallInviteRow | undefined;

        if (row) {
          onChange(mapInvite(row));
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[friend-call] room realtime reconnect', `status:${status}`);
      }
    });
}
