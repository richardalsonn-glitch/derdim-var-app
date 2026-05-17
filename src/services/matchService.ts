import { RealtimeChannel } from '@supabase/supabase-js';

import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getCurrentUser, resolveDisplayName } from './authService';
import { MatchParticipantProfile, MatchmakingMode, MatchmakingQueueRow, MatchmakingState } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getDeterministicAvatarId, resolveAvatarId } from '../utils/avatarResolver';

type MatchServiceError = {
  message: string;
};

type MatchServiceResult<T> = {
  data: T | null;
  error: MatchServiceError | null;
};

const MATCH_RETRY_MESSAGE = 'Eslesme sirasi yenilendi, tekrar deneniyor...';
const MATCH_START_ERROR_MESSAGE = 'Eşleşme başlatılamadı. Lütfen tekrar deneyin.';
const MATCH_QUEUE_SELECT = 'id, user_id, mode, status, matched_with, match_room_id, room_id, ended_at, ended_by, created_at, updated_at';
const PARTNER_PROFILE_SELECT = 'user_id, username, avatar_id, plan, is_online, last_seen, last_seen_at, presence_status, call_status';

type MatchSessionCloseState = {
  isClosed: boolean;
  eventRoomId: string | null;
  status: string | null;
  rowCount: number;
  activeRows: number;
  terminalRows: number;
};

let activeQueue: MatchmakingQueueRow | null = null;
let activePartnerProfile: MatchParticipantProfile | null = null;
let matchChannel: RealtimeChannel | null = null;

function logMatchEnd(message: string) {
  logSafeDebug('[match-end]', message, { functionName: 'matchService' });
}

function getConfigError(): MatchServiceError {
  return {
    message:
      'Supabase env bilgileri eksik. EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY degerlerini doldur.',
  };
}

function getOppositeMode(mode: MatchmakingMode): MatchmakingMode {
  return mode === 'derdim' ? 'derman' : 'derdim';
}

function getOnlineState(profile: any) {
  const lastSeenAt = profile?.last_seen_at ?? profile?.last_seen ?? null;
  return {
    isOnline: Boolean(profile?.is_online) || (lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < 90 * 1000 : false),
    lastSeenAt,
  };
}

function mapPartnerProfile(userId: string, profileData: any, fallbackProfile: MatchParticipantProfile): MatchParticipantProfile {
  const username = resolveDisplayName({
    username: profileData?.username,
  });
  const presence = getOnlineState(profileData);
  const partnerAvatarId = resolveAvatarId(
    typeof profileData?.avatar_id === 'string' && profileData.avatar_id.trim().length > 0
      ? profileData.avatar_id.trim()
      : fallbackProfile.avatarId,
  );

  if (__DEV__) {
    logSafeDebug('[match] partner profile lookup', `userId:${userId} hasUsername:${username !== 'Anonim'}`);
  }

  return {
    userId,
    username,
    avatarId: partnerAvatarId,
    plan: profileData?.plan === 'plus' || profileData?.plan === 'vip' ? profileData.plan : 'free',
    isOnline: presence.isOnline,
    lastSeenAt: presence.lastSeenAt,
  };
}

async function fetchVisiblePartnerProfile(userId: string) {
  const { data, error } = await supabase.rpc('get_visible_profile_summaries', {
    p_user_ids: [userId],
  });

  if (error) {
    logSafeDebug('[match] partner profile rpc lookup skipped', error, {
      functionName: 'fetchVisiblePartnerProfile',
      rpc: 'get_visible_profile_summaries',
    });
    return null;
  }

  return Array.isArray(data) ? data[0] : null;
}

async function clearChannel() {
  if (!matchChannel) {
    return;
  }

  const channel = matchChannel;
  matchChannel = null;
  await supabase.removeChannel(channel);
}

async function fetchPartnerProfile(userId: string | null): Promise<MatchParticipantProfile | null> {
  if (!userId) {
    logSafeDebug('[match] partner profile fallback', 'reason:missing-user-id');
    return null;
  }

  const fallbackProfile: MatchParticipantProfile = {
    userId,
    username: resolveDisplayName({}),
    avatarId: getDeterministicAvatarId(userId),
    plan: 'free',
  };

  const { data: profileData, error } = await supabase
    .from('profiles')
    .select(PARTNER_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (!error && profileData) {
    return mapPartnerProfile(userId, profileData, fallbackProfile);
  }

  if (error) {
    logSafeDebug('[match] partner profile direct lookup skipped', error, {
      functionName: 'fetchPartnerProfile',
      table: 'profiles',
    });
  } else {
    logSafeDebug('[match] partner profile direct lookup empty', `userId:${userId}`);
  }

  const rpcProfile = await fetchVisiblePartnerProfile(userId);

  if (rpcProfile) {
    return mapPartnerProfile(userId, rpcProfile, fallbackProfile);
  }

  logSafeDebug('[match] partner profile fallback', `userId:${userId} reason:profile-not-visible-or-missing`);
  return fallbackProfile;
}

async function buildMatchState(queue: MatchmakingQueueRow): Promise<MatchmakingState> {
  const partnerProfile = await fetchPartnerProfile(queue.matched_with);

  return {
    queue,
    partnerProfile,
  };
}

async function getAuthenticatedUserId(): Promise<MatchServiceResult<string>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getConfigError() };
  }

  const result = await getCurrentUser();

  if (result.error) {
    return { data: null, error: { message: getFriendlyErrorMessage(result.error, MATCH_START_ERROR_MESSAGE) } };
  }

  if (!result.data?.id) {
    return { data: null, error: { message: 'Eslesme icin aktif oturum bulunamadi.' } };
  }

  return { data: result.data.id, error: null };
}

async function refreshCurrentQueue(): Promise<MatchmakingQueueRow | null> {
  if (!activeQueue) {
    return null;
  }

  const { data } = await supabase
    .from('matchmaking_queue')
    .select(MATCH_QUEUE_SELECT)
    .eq('id', activeQueue.id)
    .maybeSingle();

  if (data) {
    activeQueue = data;
  }

  return data ?? null;
}

function isDuplicateKeyError(error: { code?: string; message?: string } | null) {
  return error?.code === '23505' || error?.message?.toLowerCase().includes('duplicate key');
}

async function releasePartnerMatch(existingQueue: MatchmakingQueueRow | null) {
  if (!existingQueue?.matched_with) {
    return;
  }

  const { error } = await supabase
    .from('matchmaking_queue')
    .update({ status: 'waiting', matched_with: null, match_room_id: null, room_id: null, updated_at: new Date().toISOString() })
    .eq('user_id', existingQueue.matched_with)
    .eq('matched_with', existingQueue.user_id)
    .eq('status', 'matched');

  if (error) {
    logSafeDebug('[match] releasePartnerMatch skipped', error);
  }
}

async function fetchUserQueue(userId: string): Promise<MatchmakingQueueRow | null> {
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select(MATCH_QUEUE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logSafeDebug('[match] fetchUserQueue skipped', error);
  }

  return data ?? null;
}

async function deleteUserQueue(userId: string) {
  const existingQueue = await fetchUserQueue(userId);
  await releasePartnerMatch(existingQueue);

  const { error } = await supabase.from('matchmaking_queue').delete().eq('user_id', userId);

  if (error) {
    logSafeDebug('[match] deleteUserQueue skipped', error);
    return { data: null, error: { message: MATCH_START_ERROR_MESSAGE } };
  }

  return { data: true, error: null };
}

async function upsertUserQueue(userId: string, mode: MatchmakingMode): Promise<MatchServiceResult<MatchmakingQueueRow>> {
  const existingQueue = await fetchUserQueue(userId);
  await releasePartnerMatch(existingQueue);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('matchmaking_queue')
    .upsert(
      {
        user_id: userId,
        mode,
        status: 'waiting',
        matched_with: null,
        match_room_id: null,
        room_id: null,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select(MATCH_QUEUE_SELECT)
    .single();

  if (error) {
    return {
      data: null,
      error: {
        message: isDuplicateKeyError(error) ? MATCH_RETRY_MESSAGE : MATCH_START_ERROR_MESSAGE,
      },
    };
  }

  return { data, error: null };
}

async function joinQueueOnce(mode: MatchmakingMode, shouldRetryDuplicate: boolean): Promise<MatchServiceResult<MatchmakingState>> {
  const userIdResult = await getAuthenticatedUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  const userId = userIdResult.data;

  await clearChannel();
  const upsertResult = await upsertUserQueue(userId, mode);

  if (upsertResult.error || !upsertResult.data) {
    if (shouldRetryDuplicate && upsertResult.error?.message === MATCH_RETRY_MESSAGE) {
      await deleteUserQueue(userId);
      return joinQueueOnce(mode, false);
    }

    return {
      data: null,
      error: { message: upsertResult.error?.message ?? MATCH_START_ERROR_MESSAGE },
    };
  }

  activeQueue = upsertResult.data;
  activePartnerProfile = null;

  return findMatch();
}

export async function joinQueue(mode: MatchmakingMode): Promise<MatchServiceResult<MatchmakingState>> {
  return joinQueueOnce(mode, true);
}

export async function findMatch(): Promise<MatchServiceResult<MatchmakingState>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getConfigError() };
  }

  if (!activeQueue) {
    return { data: null, error: { message: 'Aktif kuyruk kaydi bulunamadi.' } };
  }

  const currentQueue = (await refreshCurrentQueue()) ?? activeQueue;

  if (currentQueue.status === 'matched') {
    activePartnerProfile = await fetchPartnerProfile(currentQueue.matched_with);
    return {
      data: {
        queue: currentQueue,
        partnerProfile: activePartnerProfile,
      },
      error: null,
    };
  }

  const { data, error } = await supabase.rpc('claim_matchmaking_pair', {
    p_queue_id: currentQueue.id,
  });

  if (error) {
    logSafeDebug('[match] claim_matchmaking_pair skipped', error);
    return { data: null, error: { message: getFriendlyErrorMessage(error, MATCH_START_ERROR_MESSAGE) } };
  }

  const nextQueue = Array.isArray(data) ? (data[0] as MatchmakingQueueRow | undefined) : undefined;

  if (!nextQueue) {
    return {
      data: {
        queue: currentQueue,
        partnerProfile: null,
      },
      error: null,
    };
  }

  activeQueue = nextQueue;

  if (nextQueue.status !== 'matched') {
    activePartnerProfile = null;
    return {
      data: {
        queue: nextQueue,
        partnerProfile: null,
      },
      error: null,
    };
  }

  return {
    data: await buildMatchState(nextQueue),
    error: null,
  };
}

export async function listenForMatch(
  onMatch: (state: MatchmakingState) => void,
): Promise<MatchServiceResult<() => Promise<void>>> {
  if (!isSupabaseConfigured) {
    return { data: null, error: getConfigError() };
  }

  if (!activeQueue) {
    return { data: null, error: { message: 'Dinleme baslatmak icin aktif kuyruk kaydi bulunamadi.' } };
  }

  await clearChannel();

  const queueId = activeQueue.id;
  const userId = activeQueue.user_id;
  const oppositeMode = getOppositeMode(activeQueue.mode);
  let resolved = false;

  const resolveMatch = async () => {
    const result = await findMatch();

    if (resolved || result.error || !result.data || result.data.queue.status !== 'matched') {
      return;
    }

    resolved = true;
    onMatch(result.data);
  };

  matchChannel = supabase.channel(`matchmaking:${userId}:${queueId}`);

  matchChannel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'matchmaking_queue',
      filter: `id=eq.${queueId}`,
    },
    async (payload) => {
      const nextRow = payload.new as MatchmakingQueueRow;

      activeQueue = nextRow;

      if (resolved || nextRow.status !== 'matched') {
        return;
      }

      resolved = true;
      activePartnerProfile = await fetchPartnerProfile(nextRow.matched_with);
      onMatch({
        queue: nextRow,
        partnerProfile: activePartnerProfile,
      });
    },
  );

  matchChannel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'matchmaking_queue',
      filter: `mode=eq.${oppositeMode}`,
    },
    async (payload) => {
      const nextRow = payload.new as MatchmakingQueueRow | undefined;

      if (resolved || !nextRow || nextRow.status !== 'waiting' || nextRow.user_id === userId) {
        return;
      }

      await resolveMatch();
    },
  );

  matchChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      void resolveMatch();
    }
  });

  return {
    data: async () => {
      resolved = true;
      await clearChannel();
    },
    error: null,
  };
}

export async function leaveQueue(): Promise<MatchServiceResult<true>> {
  if (!isSupabaseConfigured) {
    activeQueue = null;
    activePartnerProfile = null;
    return { data: true, error: null };
  }

  await clearChannel();

  const userIdResult = await getAuthenticatedUserId();

  if (userIdResult.error || !userIdResult.data) {
    activePartnerProfile = null;
    activeQueue = null;
    return { data: true, error: null };
  }

  const queueToRemove = activeQueue ?? (await fetchUserQueue(userIdResult.data));
  activeQueue = null;
  activePartnerProfile = null;

  await releasePartnerMatch(queueToRemove);

  const { error } = await supabase.from('matchmaking_queue').delete().eq('user_id', userIdResult.data);

  if (error) {
    logSafeDebug('[match] leaveQueue delete skipped', error);
    return { data: null, error: { message: MATCH_START_ERROR_MESSAGE } };
  }

  return { data: true, error: null };
}

export async function endMatchSessionReliable(matchRoomId: string | null | undefined, source = 'user-ended-call'): Promise<MatchServiceResult<true>> {
  const normalizedMatchRoomId = matchRoomId?.trim();

  if (!isSupabaseConfigured || !normalizedMatchRoomId) {
    return { data: true, error: null };
  }

  const userResult = await getCurrentUser();
  const userId = userResult.data?.id ?? 'unknown';
  logMatchEnd(`endRequested source:${source} roomId:${normalizedMatchRoomId} currentUserId:${userId}`);

  const { error } = await supabase.rpc('end_match_session', {
    p_match_room_id: normalizedMatchRoomId,
  });
  logMatchEnd(`endRpcSuccess:${!error} source:${source} roomId:${normalizedMatchRoomId}`);

  if (error) {
    logSafeDebug('[match] endMatchSession skipped', error, { functionName: 'endMatchSessionReliable', rpc: 'end_match_session', table: 'matchmaking_queue' });
    const fallback = await supabase
      .from('matchmaking_queue')
      .update({ status: 'ended', ended_at: new Date().toISOString(), ended_by: userResult.data?.id ?? null, updated_at: new Date().toISOString() })
      .or(`match_room_id.eq.${normalizedMatchRoomId},room_id.eq.${normalizedMatchRoomId}`)
      .in('status', ['matched', 'waiting']);
    logMatchEnd(`endFallbackSuccess:${!fallback.error} roomId:${normalizedMatchRoomId}`);

    if (fallback.error) {
      logSafeDebug('[match] endMatchSession fallback skipped', fallback.error, { functionName: 'endMatchSessionReliable', table: 'matchmaking_queue' });
      return { data: null, error: { message: 'Görüşme kapatılamadı, lütfen tekrar deneyin.' } };
    }
  }

  if (activeQueue?.match_room_id === normalizedMatchRoomId || activeQueue?.room_id === normalizedMatchRoomId) {
    activeQueue = {
      ...activeQueue,
      status: 'ended',
      matched_with: null,
      updated_at: new Date().toISOString(),
    };
  }

  return { data: true, error: null };
}

export async function isMatchSessionClosed(matchRoomId: string | null | undefined): Promise<MatchServiceResult<boolean>> {
  const stateResult = await getMatchSessionCloseState(matchRoomId);

  if (stateResult.error || !stateResult.data) {
    return { data: stateResult.data?.isClosed ?? null, error: stateResult.error };
  }

  return { data: stateResult.data.isClosed, error: null };
}

export async function getMatchSessionCloseState(matchRoomId: string | null | undefined): Promise<MatchServiceResult<MatchSessionCloseState>> {
  const normalizedMatchRoomId = matchRoomId?.trim();

  if (!isSupabaseConfigured || !normalizedMatchRoomId) {
    return {
      data: {
        isClosed: false,
        eventRoomId: null,
        status: null,
        rowCount: 0,
        activeRows: 0,
        terminalRows: 0,
      },
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select('status, match_room_id, room_id, ended_at, ended_by')
    .or(`match_room_id.eq.${normalizedMatchRoomId},room_id.eq.${normalizedMatchRoomId}`)
    .limit(2);

  if (error) {
    logSafeDebug('[match] poll session status skipped', error, { functionName: 'isMatchSessionClosed', table: 'matchmaking_queue' });
    return { data: null, error: { message: 'Görüşme durumu kontrol edilemedi.' } };
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return {
      data: {
        isClosed: false,
        eventRoomId: normalizedMatchRoomId,
        status: 'missing',
        rowCount: 0,
        activeRows: 0,
        terminalRows: 0,
      },
      error: null,
    };
  }

  const hasActive = rows.some((row) => row.status === 'matched' || row.status === 'waiting');
  const terminalRows = rows.filter((row) => row.status === 'ended' || row.status === 'cancelled' || row.status === 'expired');
  const firstTerminalRow = terminalRows[0] ?? rows[0];
  const eventRoomId = firstTerminalRow?.match_room_id ?? firstTerminalRow?.room_id ?? normalizedMatchRoomId;
  const status = terminalRows.length > 0 && terminalRows.length !== rows.length
    ? 'mixed'
    : firstTerminalRow?.status ?? null;

  return {
    data: {
      isClosed: rows.length > 0 && terminalRows.length === rows.length && !hasActive,
      eventRoomId,
      status,
      rowCount: rows.length,
      activeRows: rows.length - terminalRows.length,
      terminalRows: terminalRows.length,
    },
    error: null,
  };
}

export function listenForMatchSessionEndReliable(
  matchRoomId: string | null | undefined,
  onEnd: (event?: { eventRoomId: string | null; status: string | null }) => void,
): MatchServiceResult<() => Promise<void>> {
  const normalizedMatchRoomId = matchRoomId?.trim();

  if (!isSupabaseConfigured || !normalizedMatchRoomId) {
    return { data: null, error: null };
  }

  let resolved = false;
  const channel = supabase.channel(`match-session:${normalizedMatchRoomId}`);
  const isTargetRoom = (row: MatchmakingQueueRow | undefined) =>
    row?.match_room_id === normalizedMatchRoomId || row?.room_id === normalizedMatchRoomId;

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'matchmaking_queue',
    },
    (payload) => {
      const nextRow = payload.new as MatchmakingQueueRow | undefined;
      const prevRow = payload.old as MatchmakingQueueRow | undefined;

      if (resolved || (!isTargetRoom(nextRow) && !isTargetRoom(prevRow))) {
        return;
      }

      if (nextRow?.status === 'ended' || nextRow?.status === 'cancelled' || nextRow?.status === 'expired') {
        resolved = true;
        onEnd({
          eventRoomId: nextRow.match_room_id ?? nextRow.room_id ?? prevRow?.match_room_id ?? prevRow?.room_id ?? normalizedMatchRoomId,
          status: nextRow.status,
        });
      }
    },
  );

  channel.subscribe();

  return {
    data: async () => {
      resolved = true;
      await supabase.removeChannel(channel);
    },
    error: null,
  };
}

export async function endMatchSession(matchRoomId: string | null | undefined): Promise<MatchServiceResult<true>> {
  if (!isSupabaseConfigured || !matchRoomId?.trim()) {
    return { data: true, error: null };
  }

  const { error } = await supabase.rpc('end_match_session', {
    p_match_room_id: matchRoomId,
  });

  if (error) {
    logSafeDebug('[match] endMatchSession skipped', error, { functionName: 'endMatchSession', rpc: 'end_match_session', table: 'matchmaking_queue' });
    return { data: null, error: { message: 'Görüşme kapatılamadı, lütfen tekrar deneyin.' } };
  }

  if (activeQueue?.match_room_id === matchRoomId || activeQueue?.room_id === matchRoomId) {
    activeQueue = {
      ...activeQueue,
      status: 'ended',
      matched_with: null,
      updated_at: new Date().toISOString(),
    };
  }

  return { data: true, error: null };
}

export function listenForMatchSessionEnd(
  matchRoomId: string | null | undefined,
  onEnd: () => void,
): MatchServiceResult<() => Promise<void>> {
  if (!isSupabaseConfigured || !matchRoomId?.trim()) {
    return { data: null, error: null };
  }

  let resolved = false;
  const channel = supabase.channel(`match-session:${matchRoomId}`);
  const handleRow = (row: MatchmakingQueueRow | undefined) => {
    if (!row || resolved) {
      return;
    }

    if (row.status === 'ended' || row.status === 'cancelled' || row.status === 'expired') {
      resolved = true;
      onEnd();
    }
  };

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'matchmaking_queue',
      filter: `match_room_id=eq.${matchRoomId}`,
    },
    (payload) => handleRow(payload.new as MatchmakingQueueRow | undefined),
  );

  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'matchmaking_queue',
      filter: `room_id=eq.${matchRoomId}`,
    },
    (payload) => handleRow(payload.new as MatchmakingQueueRow | undefined),
  );

  channel.subscribe();

  return {
    data: async () => {
      resolved = true;
      await supabase.removeChannel(channel);
    },
    error: null,
  };
}

export function getActiveMatch(): MatchmakingState | null {
  if (!activeQueue) {
    return null;
  }

  return {
    queue: activeQueue,
    partnerProfile: activePartnerProfile,
  };
}

export function hasActiveMatch() {
  return activeQueue?.status === 'matched';
}
