import { RealtimeChannel } from '@supabase/supabase-js';

import { defaultProfile } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';
import { MatchParticipantProfile, MatchmakingMode, MatchmakingQueueRow, MatchmakingState } from '../types';

type MatchServiceError = {
  message: string;
};

type MatchServiceResult<T> = {
  data: T | null;
  error: MatchServiceError | null;
};

const MATCH_RETRY_MESSAGE = 'Eslesme sirasi yenilendi, tekrar deneniyor...';
const MATCH_START_ERROR_MESSAGE = 'Eslesme su anda baslatilamadi. Lutfen tekrar dene.';

let activeQueue: MatchmakingQueueRow | null = null;
let activePartnerProfile: MatchParticipantProfile | null = null;
let matchChannel: RealtimeChannel | null = null;

function getConfigError(): MatchServiceError {
  return {
    message:
      'Supabase env bilgileri eksik. EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY degerlerini doldur.',
  };
}

function getOppositeMode(mode: MatchmakingMode): MatchmakingMode {
  return mode === 'derdim' ? 'derman' : 'derdim';
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
    return null;
  }

  const fallbackProfile: MatchParticipantProfile = {
    userId,
    username: `kullanici_${userId.slice(0, 6)}`,
    avatarId: defaultProfile.avatarId,
    plan: 'free',
  };

  const { data, error } = await supabase
    .from('profiles')
    .select('username, avatar_id, plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return fallbackProfile;
  }

  return {
    userId,
    username: typeof data.username === 'string' && data.username.trim().length > 0 ? data.username.trim() : fallbackProfile.username,
    avatarId: typeof data.avatar_id === 'string' && data.avatar_id.trim().length > 0 ? data.avatar_id.trim() : fallbackProfile.avatarId,
    plan: data.plan === 'plus' || data.plan === 'vip' ? data.plan : 'free',
  };
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
    return { data: null, error: { message: result.error.message } };
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
    .select('id, user_id, mode, status, matched_with, created_at')
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
    .update({ status: 'waiting', matched_with: null })
    .eq('user_id', existingQueue.matched_with)
    .eq('matched_with', existingQueue.user_id)
    .eq('status', 'matched');

  if (error) {
    console.error('[match] releasePartnerMatch failed:', error.message);
  }
}

async function fetchUserQueue(userId: string): Promise<MatchmakingQueueRow | null> {
  const { data, error } = await supabase
    .from('matchmaking_queue')
    .select('id, user_id, mode, status, matched_with, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[match] fetchUserQueue failed:', error.message);
  }

  return data ?? null;
}

async function deleteUserQueue(userId: string) {
  const existingQueue = await fetchUserQueue(userId);
  await releasePartnerMatch(existingQueue);

  const { error } = await supabase.from('matchmaking_queue').delete().eq('user_id', userId);

  if (error) {
    console.error('[match] deleteUserQueue failed:', error.message);
    return { data: null, error: { message: MATCH_START_ERROR_MESSAGE } };
  }

  return { data: true, error: null };
}

async function upsertUserQueue(userId: string, mode: MatchmakingMode): Promise<MatchServiceResult<MatchmakingQueueRow>> {
  const existingQueue = await fetchUserQueue(userId);
  await releasePartnerMatch(existingQueue);

  const { data, error } = await supabase
    .from('matchmaking_queue')
    .upsert(
      {
        user_id: userId,
        mode,
        status: 'waiting',
        matched_with: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('id, user_id, mode, status, matched_with, created_at')
    .single();

  if (error) {
    console.error('[match] upsertUserQueue failed:', error.message);
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
    console.error('[match] claim_matchmaking_pair failed:', error.message);
    return { data: null, error: { message: error.message } };
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
    console.error('[match] leaveQueue delete failed:', error.message);
    return { data: null, error: { message: MATCH_START_ERROR_MESSAGE } };
  }

  return { data: true, error: null };
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
