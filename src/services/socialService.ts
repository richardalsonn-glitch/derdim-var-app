import { RealtimeChannel } from '@supabase/supabase-js';

import { giftCatalog } from '../data/giftCatalog';
import { defaultProfile, gifts } from '../data/mockData';
import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { computeFriendAvailability } from '../utils/availabilityState';
import { getDeterministicAvatarId, resolveAvatarId as resolveCanonicalAvatarId } from '../utils/avatarResolver';

import { FriendSummary, GiftItem, MembershipPlan } from '../types';
import { getFriendlyErrorMessage, isMissingTableError } from '../utils/errorMessages';
import { getCurrentUser, resolveDisplayName } from './authService';
import { isAnyCallSoundPlaying } from './callSoundService';
import { getActiveChatThreadId } from './chatActivityService';
import { playMessageNotificationSound } from './messageSoundService';
import { sendFriendAcceptedNotification, sendFriendRequestNotification, sendMessageNotification } from './notificationService';

type ServiceResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type ChatThreadSummary = {
  id: string;
  peer: FriendSummary & { isOnline?: boolean; lastSeenAt?: string | null };
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  clearedForCurrentUser?: boolean;
};

type ChatThreadRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  deleted_for_user1_at?: string | null;
  deleted_for_user2_at?: string | null;
};

export type ChatMessageItem = {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type PeerPresence = {
  isOnline: boolean;
  lastSeenAt: string | null;
};

export type GiftHistory = {
  received: Array<GiftItem & { count: number }>;
  sent: Array<GiftItem & { count: number }>;
  popular: GiftItem[];
  balances: Record<string, number>;
};

export type GiftBalanceMap = Record<string, number>;

export type FriendListData = {
  friends: Array<FriendSummary & { isOnline: boolean; lastSeenAt?: string | null; callStatus?: 'available' | 'busy' | 'offline'; availabilityStatus?: FriendAvailabilityStatus; level: number; dermanScore: number }>;
  incomingRequests: Array<FriendSummary & { requestId: string }>;
  outgoingRequests: Array<FriendSummary & { requestId: string }>;
};
export type FriendAvailabilityStatus = 'available' | 'busy' | 'searching' | 'offline';
type SocialProfileSummary = FriendSummary & {
  isOnline?: boolean;
  lastSeenAt?: string | null;
  callStatus?: 'available' | 'busy' | 'offline';
  avatarSource?: 'profiles' | 'rpc' | 'fallback';
  rawProfileAvatarId?: string | null;
};

type FriendAvailabilityRow = {
  user_id: string;
  availability_status: FriendAvailabilityStatus;
};

type FriendActiveState = {
  activeCallFound: boolean;
  activeMatchFound: boolean;
  activeSearchFound: boolean;
};

const emptyFriendData: FriendListData = { friends: [], incomingRequests: [], outgoingRequests: [] };
const ONLINE_WINDOW_MS = 5 * 1000;
const MAX_PROCESSED_MESSAGE_SOUND_IDS = 100;
const processedMessageSoundIds: string[] = [];
const processedMessageSoundIdSet = new Set<string>();
const PROFILE_SUMMARY_SELECT = 'user_id, username, avatar_id, plan, is_online, last_seen, last_seen_at, presence_status, call_status';

export function getFriendAvailabilityMessage(status: FriendAvailabilityStatus | undefined) {
  switch (status) {
    case 'available':
      return '';
    case 'searching':
      return 'Bu kullanıcı şu anda eşleşme arıyor.';
    case 'busy':
      return 'Bu kullanıcı şu anda başka bir görüşmede.';
    case 'offline':
    default:
      return 'Bu kullanıcı şu anda çevrim dışı.';
  }
}

export function canStartFriendCall(status: FriendAvailabilityStatus | undefined) {
  return status === 'available';
}

function buildRealtimeFilter(column: string, value: string) {
  return `${column}=eq.${String(value).replace(/,/g, '%2C')}`;
}

function isThreadHiddenForCurrentUser(thread: ChatThreadRow, currentUserId: string) {
  const deletedAt = thread.user1_id === currentUserId
    ? thread.deleted_for_user1_at
    : thread.user2_id === currentUserId
      ? thread.deleted_for_user2_at
      : null;

  if (!deletedAt) {
    return false;
  }

  if (!thread.last_message_at) {
    return true;
  }

  return new Date(thread.last_message_at).getTime() <= new Date(deletedAt).getTime();
}


function getPlan(value: unknown): MembershipPlan {
  return value === 'plus' || value === 'vip' ? value : 'free';
}

function buildFallbackProfileSummary(userId: string): SocialProfileSummary {
  return {
    id: userId,
    username: resolveDisplayName({}),
    avatarId: getDeterministicAvatarId(userId),
    plan: 'free',
    isOnline: false,
    lastSeenAt: null,
    avatarSource: 'fallback',
    rawProfileAvatarId: null,
  };
}

function resolveAvatarId(value: unknown) {
  return resolveCanonicalAvatarId(value);
}

function getProfileLastSeenAt(profile: {
  last_seen_at?: string | null;
  last_seen?: string | null;
}) {
  return profile.last_seen_at ?? profile.last_seen ?? null;
}

function isPresenceFresh(lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return false;
  }

  const timestamp = new Date(lastSeenAt).getTime();

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < ONLINE_WINDOW_MS;
}

function resolveProfileIsOnline(profile: {
  is_online?: boolean | null;
  presence_status?: string | null;
  last_seen_at?: string | null;
  last_seen?: string | null;
}) {
  const lastSeenAt = getProfileLastSeenAt(profile);
  const fresh = isPresenceFresh(lastSeenAt);
  const presenceOnline = String(profile.presence_status ?? '').toLowerCase() === 'online';

  return fresh && (Boolean(profile.is_online) || presenceOnline);
}

function getThreadDeletedAtForUser(thread: ChatThreadRow, currentUserId: string) {
  return thread.user1_id === currentUserId
    ? thread.deleted_for_user1_at ?? null
    : thread.user2_id === currentUserId
      ? thread.deleted_for_user2_at ?? null
      : null;
}

function rememberProcessedMessageSoundId(messageId: string) {
  if (processedMessageSoundIdSet.has(messageId)) {
    return false;
  }

  processedMessageSoundIdSet.add(messageId);
  processedMessageSoundIds.push(messageId);

  while (processedMessageSoundIds.length > MAX_PROCESSED_MESSAGE_SOUND_IDS) {
    const oldest = processedMessageSoundIds.shift();

    if (oldest) {
      processedMessageSoundIdSet.delete(oldest);
    }
  }

  return true;
}

function maybePlayIncomingMessageSound(message: ChatMessageItem, currentUserId: string) {
  if (!message.id || message.senderId === currentUserId || message.receiverId !== currentUserId) {
    return;
  }

  if (getActiveChatThreadId() === message.threadId) {
    return;
  }

  if (isAnyCallSoundPlaying()) {
    return;
  }

  if (!rememberProcessedMessageSoundId(message.id)) {
    return;
  }

  playMessageNotificationSound();
}
function resolveMappedAvatar(profile: {
  user_id?: string | null;
  avatar_id?: string | null;
}, profileSource: 'profiles' | 'rpc') {
  const userId = String(profile.user_id ?? '');
  const selectedFieldsIncludeAvatarId = Object.prototype.hasOwnProperty.call(profile, 'avatar_id');
  const rawProfileAvatarId = typeof profile.avatar_id === 'string' ? profile.avatar_id.trim() : '';
  const hasAvatarId = rawProfileAvatarId.length > 0;
  const mappedAvatarId = hasAvatarId
    ? resolveAvatarId(rawProfileAvatarId)
    : getDeterministicAvatarId(userId);
  const source: SocialProfileSummary['avatarSource'] = hasAvatarId ? profileSource : 'fallback';
  const fallbackReason = hasAvatarId ? null : 'missing-avatar-id';

  if (__DEV__) {
    logSafeDebug(
      '[social-profile-avatar]',
      `userId:${userId || 'missing'} selectedFieldsIncludeAvatarId:${selectedFieldsIncludeAvatarId} rawProfileAvatarId:${rawProfileAvatarId || 'empty'} mappedAvatarId:${mappedAvatarId} source:${source} fallbackReason:${fallbackReason ?? 'none'}`,
    );
  }

  return {
    rawProfileAvatarId,
    mappedAvatarId,
    source,
  };
}

function mapProfileSummary(profile: any, profileSource: 'profiles' | 'rpc' = 'profiles'): SocialProfileSummary {
  const username = resolveDisplayName({
    username: profile.username,
  });
  const lastSeenAt = getProfileLastSeenAt(profile);
  const isOnline = resolveProfileIsOnline(profile);
  const avatar = resolveMappedAvatar(profile, profileSource);

  if (__DEV__) {
    logSafeDebug('[social] profile lookup', `userId:${String(profile.user_id)} hasUsername:${username !== 'Anonim'}`);
  }

  return {
    id: String(profile.user_id),
    username,
    avatarId: avatar.mappedAvatarId,
    plan: getPlan(profile.plan),
    isOnline,
    lastSeenAt,
    avatarSource: avatar.source,
    rawProfileAvatarId: avatar.rawProfileAvatarId || null,
    callStatus: profile.call_status === 'busy' || profile.call_status === 'offline'
      ? profile.call_status
      : isOnline
        ? 'available'
        : 'offline',
  };
}

async function fetchProfilesViaRpc(userIds: string[]) {
  if (!isSupabaseConfigured || userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_visible_profile_summaries', {
    p_user_ids: userIds,
  });

  if (error) {
    logSafeDebug('[social] fetchProfiles rpc skipped', error, {
      functionName: 'fetchProfilesViaRpc',
      rpc: 'get_visible_profile_summaries',
    });
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function getCurrentUserResolvedUsername() {
  const currentUserResult = await getCurrentUser();
  const currentUserId = currentUserResult.data?.id;
  let profileUsername: unknown;

  if (currentUserId && isSupabaseConfigured) {
    const profileResult = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (profileResult.error) {
      logSafeDebug('[social] current user profile username lookup skipped', profileResult.error, {
        functionName: 'getCurrentUserResolvedUsername',
        table: 'profiles',
      });
    }

    profileUsername = profileResult.data?.username;
  }

  const username = resolveDisplayName({
    username: profileUsername,
    currentUserMetadataUsername: currentUserResult.data?.user_metadata?.username,
  });

  if (__DEV__) {
    logSafeDebug('[social] current user username resolved', `userId:${currentUserId ?? 'missing'} hasProfileUsername:${Boolean(profileUsername)} fallback:${username === 'Anonim'}`);
  }

  return username;
}

async function shouldSendMessageNotification(receiverId: string, threadId: string) {
  if (!isSupabaseConfigured || !receiverId || !threadId) {
    return false;
  }

  const recentWindowStart = new Date(Date.now() - 20 * 1000).toISOString();
  const existingResult = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', receiverId)
    .eq('type', 'message_received')
    .contains('data', { threadId })
    .eq('is_read', false)
    .gte('created_at', recentWindowStart)
    .limit(1)
    .maybeSingle();

  if (existingResult.error) {
    logSafeDebug('[social] shouldSendMessageNotification fallback allow', existingResult.error);
    return true;
  }

  return !existingResult.data;
}

async function getUserId(): Promise<ServiceResult<string>> {
  const result = await getCurrentUser();

  if (result.error || !result.data?.id) {
    return { data: null, error: { message: result.error?.message ?? 'Aktif oturum bulunamadi.' } };
  }

  return { data: result.data.id, error: null };
}

async function fetchProfiles(userIds: string[]) {
  if (!isSupabaseConfigured || userIds.length === 0) {
    return new Map<string, SocialProfileSummary>();
  }

  const uniqueUserIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SUMMARY_SELECT)
    .in('user_id', uniqueUserIds);

  const profiles = new Map<string, SocialProfileSummary>();

  if (error) {
    logSafeWarn('[social] fetchProfiles failed', error);
  } else {
    (data ?? []).forEach((profile: any) => {
      profiles.set(String(profile.user_id), mapProfileSummary(profile, 'profiles'));
    });
  }

  const missingUserIds = uniqueUserIds.filter((userId) => !profiles.has(userId));

  if (missingUserIds.length > 0) {
    logSafeDebug('[social] profile direct lookup missing', `userIds:${missingUserIds.join('|')}`);
    const rpcProfiles = await fetchProfilesViaRpc(missingUserIds);
    rpcProfiles.forEach((profile: any) => {
      profiles.set(String(profile.user_id), mapProfileSummary(profile, 'rpc'));
    });
  }

  uniqueUserIds
    .filter((userId) => !profiles.has(userId))
    .forEach((userId) => {
      logSafeDebug('[social] profile fallback', `userId:${userId} reason:profile-not-visible-or-missing`);
    });

  return profiles;
}

async function fetchFriendAvailability(userIds: string[]) {
  const availability = new Map<string, FriendAvailabilityStatus>();

  if (!isSupabaseConfigured || userIds.length === 0) {
    return availability;
  }

  const uniqueUserIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
  const { data, error } = await supabase.rpc('get_friend_availability', {
    p_user_ids: uniqueUserIds,
  });

  if (error) {
    logSafeDebug('[social] friend availability rpc skipped', error, {
      functionName: 'fetchFriendAvailability',
      rpc: 'get_friend_availability',
    });
    return availability;
  }

  ((data ?? []) as FriendAvailabilityRow[]).forEach((row) => {
    if (row.user_id && row.availability_status) {
      availability.set(String(row.user_id), row.availability_status);
    }
  });

  return availability;
}

async function fetchFriendActiveStates(userIds: string[]) {
  const states = new Map<string, FriendActiveState>();
  const uniqueUserIds = Array.from(new Set(userIds.map(String).filter(Boolean)));

  uniqueUserIds.forEach((userId) => {
    states.set(userId, {
      activeCallFound: false,
      activeMatchFound: false,
      activeSearchFound: false,
    });
  });

  if (!isSupabaseConfigured || uniqueUserIds.length === 0) {
    return states;
  }

  const userIdList = uniqueUserIds.join(',');
  const [matchResult, callResult] = await Promise.all([
    supabase
      .from('matchmaking_queue')
      .select('user_id, matched_with, status')
      .or(`user_id.in.(${userIdList}),matched_with.in.(${userIdList})`)
      .in('status', ['waiting', 'matched']),
    supabase
      .from('friend_call_invites')
      .select('caller_id, receiver_id, status, expires_at')
      .or(`caller_id.in.(${userIdList}),receiver_id.in.(${userIdList})`)
      .in('status', ['ringing', 'accepted']),
  ]);

  if (matchResult.error) {
    logSafeDebug('[availability] active match lookup skipped', matchResult.error, {
      functionName: 'fetchFriendActiveStates',
      table: 'matchmaking_queue',
    });
  } else {
    (matchResult.data ?? []).forEach((row: any) => {
      const status = String(row.status ?? '');
      const affectedIds = [row.user_id, row.matched_with].map((value) => String(value ?? '')).filter((value) => states.has(value));

      affectedIds.forEach((userId) => {
        const state = states.get(userId);

        if (!state) {
          return;
        }

        if (status === 'matched') {
          state.activeMatchFound = true;
          return;
        }

        if (status === 'waiting' && row.user_id === userId) {
          state.activeSearchFound = true;
        }
      });
    });
  }

  if (callResult.error) {
    logSafeDebug('[availability] active call lookup skipped', callResult.error, {
      functionName: 'fetchFriendActiveStates',
      table: 'friend_call_invites',
    });
  } else {
    const now = Date.now();

    (callResult.data ?? []).forEach((row: any) => {
      const status = String(row.status ?? '');
      const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
      const isActiveCall = status === 'accepted' || (status === 'ringing' && expiresAt > now);

      if (!isActiveCall) {
        return;
      }

      [row.caller_id, row.receiver_id]
        .map((value) => String(value ?? ''))
        .filter((value) => states.has(value))
        .forEach((userId) => {
          const state = states.get(userId);

          if (state) {
            state.activeCallFound = true;
          }
        });
    });
  }

  return states;
}

export async function listFriends(): Promise<ServiceResult<FriendListData>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data) {
    return {
      data: emptyFriendData,
      error: null,
    };
  }

  const userId = userIdResult.data;
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id, status, created_at')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    logSafeWarn('[social] listFriends failed', error);
    if (isMissingTableError(error)) {

      return { data: { friends: [], incomingRequests: [], outgoingRequests: [] }, error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Arkadaş listesi yüklenemedi.') } };
  }

  const rows = data ?? [];
  const peerIds = rows.map((row: any) => (row.requester_id === userId ? row.receiver_id : row.requester_id));
  const [profiles, availability, activeStates] = await Promise.all([
    fetchProfiles(peerIds),
    fetchFriendAvailability(peerIds),
    fetchFriendActiveStates(peerIds),
  ]);
  const toSummary = (row: any) => {
    const peerId = String(row.requester_id === userId ? row.receiver_id : row.requester_id);
    return profiles.get(peerId) ?? buildFallbackProfileSummary(peerId);
  };
  const incomingRows = rows.filter((row: any) => row.status === 'pending' && row.receiver_id === userId);
  const outgoingRows = rows.filter((row: any) => row.status === 'pending' && row.requester_id === userId);

  if (__DEV__) {
    incomingRows.forEach((row: any) => {
      const requesterId = String(row.requester_id);
      logSafeDebug('[social] incoming requester profile lookup', `requesterId:${requesterId} hasUsername:${profiles.get(requesterId)?.username !== undefined && profiles.get(requesterId)?.username !== 'Anonim'}`);
    });
    outgoingRows.forEach((row: any) => {
      const receiverId = String(row.receiver_id);
      logSafeDebug('[social] outgoing receiver profile lookup', `receiverId:${receiverId} hasUsername:${profiles.get(receiverId)?.username !== undefined && profiles.get(receiverId)?.username !== 'Anonim'}`);
    });
  }

  return {
    data: {
      friends: rows
        .filter((row: any) => row.status === 'accepted')
        .map((row: any) => {
          const peerId = String(row.requester_id === userId ? row.receiver_id : row.requester_id);
          const summary = toSummary(row);
          const rpcAvailability = availability.get(peerId);
          const activeState = activeStates.get(peerId) ?? {
            activeCallFound: false,
            activeMatchFound: false,
            activeSearchFound: false,
          };
          const computedAvailability = computeFriendAvailability({
            activeCallFound: activeState.activeCallFound,
            activeMatchFound: activeState.activeMatchFound,
            activeSearchFound: activeState.activeSearchFound,
            isOnline: Boolean(summary.isOnline),
            profileCallStatus: summary.callStatus,
            rpcStatus: rpcAvailability,
          });
          const availabilityStatus: FriendAvailabilityStatus = computedAvailability.status;

          logSafeDebug(
            '[friend-avatar] friend resolved',
            `currentUserId:${userId} friendUserId:${peerId} rawProfileAvatarId:${summary.rawProfileAvatarId || 'empty'} mappedAvatarId:${summary.avatarId} canonicalAvatarId:${summary.avatarId} source:${summary.avatarSource ?? 'fallback'}`,
          );
          logSafeDebug(
            '[availability]',
            `userId:${peerId} computedStatus:${availabilityStatus} reason:${computedAvailability.reason} activeCallFound:${computedAvailability.activeCallFound} activeMatchFound:${computedAvailability.activeMatchFound} staleIgnored:${computedAvailability.staleIgnored}`,
          );

          return {
            ...summary,
            isOnline: availabilityStatus !== 'offline',
            callStatus: availabilityStatus === 'busy' ? 'busy' : availabilityStatus === 'offline' ? 'offline' : 'available',
            availabilityStatus,
            level: 2,
            dermanScore: 4.7,
          };
        }),
      incomingRequests: incomingRows
        .map((row: any) => {
          const summary = toSummary(row);
          logSafeDebug(
            '[friend-avatar] incoming request resolved',
            `currentUserId:${userId} friendUserId:${summary.id} rawProfileAvatarId:${summary.rawProfileAvatarId || 'empty'} mappedAvatarId:${summary.avatarId} canonicalAvatarId:${summary.avatarId} source:${summary.avatarSource ?? 'fallback'}`,
          );
          return { ...summary, requestId: row.id };
        }),
      outgoingRequests: outgoingRows
        .map((row: any) => {
          const summary = toSummary(row);
          logSafeDebug(
            '[friend-avatar] outgoing request resolved',
            `currentUserId:${userId} friendUserId:${summary.id} rawProfileAvatarId:${summary.rawProfileAvatarId || 'empty'} mappedAvatarId:${summary.avatarId} canonicalAvatarId:${summary.avatarId} source:${summary.avatarSource ?? 'fallback'}`,
          );
          return { ...summary, requestId: row.id };
        }),
    },
    error: null,
  };
}

export async function updateFriendship(requestId: string, status: 'accepted' | 'rejected' | 'blocked'): Promise<ServiceResult<true>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error ?? { message: 'Aktif oturum bulunamadi.' } };
  }

  const currentUserId = userIdResult.data;
  const existing = currentUserId
    ? await supabase
      .from('friendships')
      .select('id, requester_id, receiver_id, status')
      .eq('id', requestId)
      .maybeSingle()
    : { data: null };

  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('receiver_id', currentUserId ?? '');

  if (error) {
    logSafeWarn('[social] updateFriendship failed', error);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Arkadaşlık isteği güncellenemedi.') } };
  }


  if (status === 'accepted' && existing.data && existing.data.status === 'pending' && existing.data.receiver_id === currentUserId) {
    const receiverId = String(existing.data.requester_id);
    const currentProfileUsername = await getCurrentUserResolvedUsername();
    await sendFriendAcceptedNotification({
      receiverId,
      friendId: currentUserId,
      friendName: currentProfileUsername,
      requestId,
    });
  }

  return { data: true, error: null };
}

export async function removeFriend(friendUserId: string): Promise<ServiceResult<true>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: { message: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.' } };
  }

  const rpcResult = await supabase.rpc('remove_friend', { p_friend_user_id: friendUserId });

  if (!rpcResult.error) {
    return { data: true, error: null };
  }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${userIdResult.data},receiver_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},receiver_id.eq.${userIdResult.data})`)
    .eq('status', 'accepted');

  if (error) {
    logSafeDebug('[social] removeFriend skipped', error);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'İşlem tamamlanamadı. Lütfen tekrar deneyin.') } };
  }


  return { data: true, error: null };
}

export async function sendFriendshipRequest(receiverId: string): Promise<ServiceResult<'created' | 'already_pending' | 'already_friends'>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  if (!isSupabaseConfigured) {
    return { data: null, error: { message: 'Arkadaşlık isteği şu anda gönderilemedi.' } };
  }

  const userId = userIdResult.data;

  if (receiverId === userId) {
    return { data: null, error: { message: 'Arkadaşlık isteği şu anda gönderilemedi.' } };
  }

  const existing = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${userId})`)
    .maybeSingle();

  if (existing.error) {
    logSafeWarn('[social] sendFriendshipRequest lookup failed', existing.error);
    if (!isMissingTableError(existing.error)) {

      return { data: null, error: { message: getFriendlyErrorMessage(existing.error, 'Arkadaşlık isteği gönderilemedi.') } };
    }
  }

  if (existing.data?.status === 'accepted') {
    return { data: 'already_friends', error: null };
  }

  if (existing.data?.status === 'pending') {
    return { data: 'already_pending', error: null };
  }

  const { data: inserted, error } = await supabase
    .from('friendships')
    .insert({
      requester_id: userId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    logSafeWarn('[social] sendFriendshipRequest failed', error);

    if (error.code === '23505') {

      return { data: 'already_pending', error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Arkadaşlık isteği gönderilemedi.') } };
  }

  const requesterName = await getCurrentUserResolvedUsername();
  await sendFriendRequestNotification({
    receiverId,
    requesterId: userId,
    requesterName,
    requestId: inserted?.id,
  });

  return { data: 'created', error: null };
}

export async function createOrGetThread(peerUserId: string): Promise<ServiceResult<ChatThreadSummary>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  if (!isSupabaseConfigured || peerUserId.startsWith('demo-')) {
    return { data: null, error: { message: 'Sohbet açmak için önce gerçek bir arkadaş seçmelisin.' } };
  }

  const userId = userIdResult.data;
  const [user1Id, user2Id] = [userId, peerUserId].sort();
  const existingResult = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id, last_message, last_message_at, created_at, deleted_for_user1_at, deleted_for_user2_at')
    .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
    .maybeSingle();

  if (existingResult.error) {
    logSafeWarn('[social] createOrGetThread lookup failed', existingResult.error);
    return { data: null, error: { message: getFriendlyErrorMessage(existingResult.error, 'Sohbet başlatılamadı.') } };
  }


  const existingThread = existingResult.data as ChatThreadRow | null;

  const threadResult = existingThread
    ? { data: existingThread, error: null }
    : await supabase
      .from('chat_threads')
      .insert({ user1_id: user1Id, user2_id: user2Id })
      .select('id, user1_id, user2_id, last_message, last_message_at, created_at, deleted_for_user1_at, deleted_for_user2_at')
      .single();

  if (threadResult.error || !threadResult.data) {
    logSafeWarn('[social] createOrGetThread failed', threadResult.error ?? 'empty result');
    return { data: null, error: { message: getFriendlyErrorMessage(threadResult.error, 'Sohbet başlatılamadı.') } };
  }


  const data = threadResult.data;
  const profiles = await fetchProfiles([peerUserId]);
  return {
    data: {
      id: data.id,
      peer: profiles.get(peerUserId) ?? buildFallbackProfileSummary(peerUserId),
      lastMessage: data.last_message ?? '',
      lastMessageAt: data.last_message_at ?? data.created_at,
      unreadCount: 0,
      clearedForCurrentUser: isThreadHiddenForCurrentUser(data as ChatThreadRow, userId),
    },
    error: null,
  };
}

export async function listThreads(): Promise<ServiceResult<ChatThreadSummary[]>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data) {
    return {
      data: [],
      error: null,
    };
  }

  const userId = userIdResult.data;
  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id, last_message, last_message_at, created_at, deleted_for_user1_at, deleted_for_user2_at')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    logSafeWarn('[social] listThreads failed', error);
    if (isMissingTableError(error)) {

      return { data: [], error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Sohbetler yüklenemedi.') } };
  }

  const rows = ((data ?? []) as ChatThreadRow[]).filter((row) => !isThreadHiddenForCurrentUser(row, userId));
  const peerIds = rows.map((row) => String(row.user1_id === userId ? row.user2_id : row.user1_id));
  const profiles = await fetchProfiles(peerIds);
  const unreadResult = await supabase
    .from('chat_messages')
    .select('thread_id, created_at')
    .eq('receiver_id', userId)
    .eq('is_read', false);
  const unreadCounts = new Map<string, number>();
  const visibleThreadDeletedAt = new Map(rows.map((row) => [String(row.id), getThreadDeletedAtForUser(row, userId)]));

  (unreadResult.data ?? []).forEach((row: any) => {
    const threadId = String(row.thread_id);
    const deletedAt = visibleThreadDeletedAt.get(threadId);

    if (deletedAt && new Date(row.created_at).getTime() <= new Date(deletedAt).getTime()) {
      return;
    }

    unreadCounts.set(threadId, (unreadCounts.get(threadId) ?? 0) + 1);
  });

  return {
    data: rows.map((row: any) => {
      const peerId = String(row.user1_id === userId ? row.user2_id : row.user1_id);
      return {
        id: row.id,
        peer: profiles.get(peerId) ?? buildFallbackProfileSummary(peerId),
        lastMessage: row.last_message ?? '',
        lastMessageAt: row.last_message_at ?? row.created_at,
        unreadCount: unreadCounts.get(String(row.id)) ?? 0,
        clearedForCurrentUser: false,
      };
    }),
    error: null,
  };
}

export async function listMessages(threadId: string): Promise<ServiceResult<ChatMessageItem[]>> {
  if (!isSupabaseConfigured || threadId.startsWith('demo-')) {
    return {
      data: [
        {
          id: 'demo-message-1',
          threadId,
          senderId: 'demo-luna',
          receiverId: 'me',
          message: 'Merhaba, burasi sohbet alani.',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      error: null,
    };
  }

  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  const currentUserId = userIdResult.data;
  const threadResult = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id, deleted_for_user1_at, deleted_for_user2_at')
    .eq('id', threadId)
    .maybeSingle();

  if (threadResult.error || !threadResult.data) {
    return { data: [], error: null };
  }

  const deletedAt = threadResult.data.user1_id === currentUserId
    ? threadResult.data.deleted_for_user1_at
    : threadResult.data.user2_id === currentUserId
      ? threadResult.data.deleted_for_user2_at
      : null;

  let messageQuery = supabase
    .from('chat_messages')
    .select('id, thread_id, sender_id, receiver_id, message, is_read, created_at')
    .eq('thread_id', threadId);

  if (deletedAt) {
    messageQuery = messageQuery.gt('created_at', deletedAt);
  }

  const { data, error } = await messageQuery.order('created_at', { ascending: true });

  if (error) {
    logSafeWarn('[social] listMessages failed', error);
    if (isMissingTableError(error)) {

      return { data: [], error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Mesajlar yüklenemedi.') } };
  }

  return {
    data: (data ?? [])
      .map((row: any) => ({
        id: row.id,
        threadId: row.thread_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        message: row.message,
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      })),
    error: null,
  };
}

export async function markThreadMessagesRead(threadId: string): Promise<ServiceResult<true>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data || !threadId) {
    return { data: true, error: null };
  }

  const { error } = await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('thread_id', threadId)
    .eq('receiver_id', userIdResult.data)
    .eq('is_read', false);

  if (error) {
    logSafeDebug('[social] markThreadMessagesRead skipped', error);
    return { data: true, error: null };
  }

  return { data: true, error: null };
}

export async function getPeerPresence(userId: string): Promise<ServiceResult<PeerPresence>> {
  if (!isSupabaseConfigured || !userId) {
    return { data: { isOnline: false, lastSeenAt: null }, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_online, last_seen_at, last_seen, presence_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { data: { isOnline: false, lastSeenAt: null }, error: null };
  }

  const lastSeenAt = getProfileLastSeenAt(data);
  const isOnline = resolveProfileIsOnline(data);

  return {
    data: {
      isOnline,
      lastSeenAt,
    },
    error: null,
  };
}

export function subscribeToPeerPresence(userId: string, onChange: () => void): RealtimeChannel | null {
  if (!isSupabaseConfigured || !userId) {
    return null;
  }

  const topic = `presence:${userId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  return supabase
    .channel(topic)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: buildRealtimeFilter('user_id', userId) }, onChange)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[social] presence realtime reconnect', `status:${status}`);
      }
    });
}

export async function sendMessage(thread: ChatThreadSummary, message: string): Promise<ServiceResult<ChatMessageItem>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return { data: null, error: { message: 'Bos mesaj gonderilemez.' } };
  }

  if (!isSupabaseConfigured || thread.id.startsWith('demo-')) {
    const now = new Date().toISOString();
    return {
      data: {
        id: `demo-message-${Date.now()}`,
        threadId: thread.id,
        senderId: userIdResult.data,
        receiverId: thread.peer.id,
        message: trimmedMessage,
        isRead: true,
        createdAt: now,
      },
      error: null,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: thread.id,
      sender_id: userIdResult.data,
      receiver_id: thread.peer.id,
      message: trimmedMessage,
      created_at: now,
    })
    .select('id, thread_id, sender_id, receiver_id, message, is_read, created_at')
    .single();

  if (error) {
    logSafeWarn('[social] sendMessage failed', error);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Mesaj gönderilemedi.') } };
  }

  const threadUpdatePayload: Record<string, string | null> = {
    last_message: trimmedMessage,
    last_message_at: now,
  };

  await supabase
    .from('chat_threads')
    .update(threadUpdatePayload)
    .eq('id', thread.id);
  const senderName = await getCurrentUserResolvedUsername();
  const canNotify = await shouldSendMessageNotification(thread.peer.id, thread.id);

  if (canNotify) {
    await sendMessageNotification({
      receiverId: thread.peer.id,
      senderId: userIdResult.data,
      senderName,
      threadId: thread.id,
      message: trimmedMessage,
    });
  }

  return {
    data: {
      id: data.id,
      threadId: data.thread_id,
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      message: data.message,
      isRead: Boolean(data.is_read),
      createdAt: data.created_at,
    },
    error: null,
  };
}

export async function deleteThreadForCurrentUser(threadId: string): Promise<ServiceResult<true>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data || !threadId) {
    return { data: true, error: null };
  }

  const userId = userIdResult.data;
  const threadResult = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id')
    .eq('id', threadId)
    .maybeSingle();

  if (threadResult.error || !threadResult.data) {
    logSafeDebug('[social] deleteThreadForCurrentUser lookup skipped', threadResult.error ?? 'thread not found', {
      functionName: 'deleteThreadForCurrentUser',
      table: 'chat_threads',
    });
    return { data: true, error: null };
  }

  const payload = threadResult.data.user1_id === userId
    ? { deleted_for_user1_at: new Date().toISOString() }
    : threadResult.data.user2_id === userId
      ? { deleted_for_user2_at: new Date().toISOString() }
      : null;

  if (!payload) {
    return { data: true, error: null };
  }

  const { error } = await supabase
    .from('chat_threads')
    .update(payload)
    .eq('id', threadId);

  if (error) {
    logSafeDebug('[social] deleteThreadForCurrentUser update skipped', error, {
      functionName: 'deleteThreadForCurrentUser',
      table: 'chat_threads',
    });
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Sohbet silinemedi.') } };
  }

  return { data: true, error: null };
}

export function subscribeToMessages(threadId: string, onMessage: (message: ChatMessageItem) => void): RealtimeChannel | null {
  if (!isSupabaseConfigured || threadId.startsWith('demo-')) {
    return null;
  }

  const topic = `chat-messages:${threadId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: buildRealtimeFilter('thread_id', threadId) },
      (payload) => {
        if (!payload.new) {
          return;
        }

        const row = payload.new as any;
        onMessage({
          id: String(row.id),
          threadId: String(row.thread_id),
          senderId: String(row.sender_id),
          receiverId: String(row.receiver_id),
          message: String(row.message ?? ''),
          isRead: Boolean(row.is_read),
          createdAt: String(row.created_at),
        });
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[social] messages realtime reconnect', `status:${status}`);
      }
    });

  return channel;
}


export function subscribeToFriendships(onChange: () => void, currentUserId: string): RealtimeChannel | null {
  if (!isSupabaseConfigured || !currentUserId) {
    return null;
  }

  const topic = `friendships:${currentUserId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  return supabase
    .channel(topic)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `requester_id=eq.${currentUserId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${currentUserId}` }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matchmaking_queue' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_call_invites' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_room_members' }, onChange)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[social] friendships realtime reconnect', `status:${status}`);
      }
    });
}


export function subscribeToThreads(onChange: () => void, currentUserId: string): RealtimeChannel | null {
  if (!isSupabaseConfigured || !currentUserId) {
    return null;
  }

  const topic = `chat-threads:${currentUserId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  return supabase
    .channel(topic)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads', filter: `user1_id=eq.${currentUserId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads', filter: `user2_id=eq.${currentUserId}` }, onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${currentUserId}` }, onChange)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[social] threads realtime reconnect', `status:${status}`);
      }
    });
}

export function subscribeToIncomingMessageSounds(currentUserId: string): RealtimeChannel | null {
  if (!isSupabaseConfigured || !currentUserId) {
    return null;
  }

  const topic = `chat-message-sounds:${currentUserId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  return supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${currentUserId}` },
      (payload) => {
        if (!payload.new) {
          return;
        }

        const row = payload.new as any;
        maybePlayIncomingMessageSound({
          id: String(row.id),
          threadId: String(row.thread_id),
          senderId: String(row.sender_id),
          receiverId: String(row.receiver_id),
          message: String(row.message ?? ''),
          isRead: Boolean(row.is_read),
          createdAt: String(row.created_at),
        }, currentUserId);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[social] message sound realtime reconnect', `status:${status}`);
      }
    });
}


export async function setCurrentUserPresence(isOnline: boolean): Promise<ServiceResult<true>> {
  if (!isSupabaseConfigured) {
    return { data: true, error: null };
  }

  const { error } = await supabase.rpc('set_presence', { p_is_online: isOnline });

  if (error) {
    logSafeDebug('[social] set_presence skipped', error);
    return { data: true, error: null };
  }


  return { data: true, error: null };
}

export async function listGiftHistory(): Promise<ServiceResult<GiftHistory>> {
  let balances: GiftBalanceMap = {};

  if (!isSupabaseConfigured) {
    return {
      data: {
        received: [],
        sent: [],
        popular: giftCatalog,
        balances,
      },
      error: null,
    };
  }

  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  const balanceResult = await supabase
    .from('user_gift_balances')
    .select('gift_id, quantity')
    .eq('user_id', userIdResult.data);

  if (balanceResult.error) {
    logSafeWarn('[social] listGiftBalances failed', balanceResult.error);
  } else {
    balances = (balanceResult.data ?? []).reduce<GiftBalanceMap>((acc, row: any) => {
      const giftId = String(row.gift_id ?? '').trim();

      if (giftId) {
        acc[giftId] = Number(row.quantity ?? 0);
      }

      return acc;
    }, {});
  }

  const { data, error } = await supabase
    .from('gift_transactions')
    .select('sender_id, receiver_id, gift_type, created_at')
    .or(`sender_id.eq.${userIdResult.data},receiver_id.eq.${userIdResult.data}`);

  if (error) {
    logSafeWarn('[social] listGiftHistory failed', error);
    if (isMissingTableError(error)) {

      return { data: { received: [], sent: [], popular: giftCatalog, balances }, error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Hediye geçmişi yüklenemedi.') } };
  }

  const countByType = (rows: any[]) => rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.gift_type] = (acc[row.gift_type] ?? 0) + 1;
    return acc;
  }, {});
  const toGiftList = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([giftType, count]) => {
        const gift = gifts.find((item) => item.id === giftType) ?? gifts[0];
        return { ...gift, count };
      });

  return {
    data: {
      received: toGiftList(countByType((data ?? []).filter((row: any) => row.receiver_id === userIdResult.data))),
      sent: toGiftList(countByType((data ?? []).filter((row: any) => row.sender_id === userIdResult.data))),
      popular: giftCatalog,
      balances,
    },
    error: null,
  };
}

export async function listGiftBalances(): Promise<ServiceResult<GiftBalanceMap>> {
  const historyResult = await listGiftHistory();

  if (historyResult.data) {
    return { data: historyResult.data.balances, error: historyResult.error };
  }

  return { data: null, error: historyResult.error };
}

export async function purchaseGiftCredit(gift: GiftItem, quantity = 1): Promise<ServiceResult<GiftBalanceMap>> {
  if (!isSupabaseConfigured) {
    return { data: { [gift.id]: quantity }, error: null };
  }

  const { error } = await supabase.rpc('purchase_gift_credit', {
    p_gift_id: gift.id,
    p_quantity: quantity,
    p_price_try: gift.priceTry,
    p_bonus_seconds: gift.bonusSeconds,
  });

  if (error) {
    logSafeWarn('[social] purchaseGiftCredit failed', error, { functionName: 'purchaseGiftCredit', rpc: 'purchase_gift_credit' });
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Hediye hakkı alınamadı.') } };
  }

  return listGiftBalances();
}

export async function consumeGiftCredit(
  gift: GiftItem,
  options: { relatedCallRoomId?: string | null; recipientUserId?: string | null } = {},
): Promise<ServiceResult<{ remaining: number }>> {
  if (!isSupabaseConfigured) {
    return { data: { remaining: 0 }, error: null };
  }

  const { data, error } = await supabase.rpc('consume_gift_credit', {
    p_gift_id: gift.id,
    p_related_call_room_id: options.relatedCallRoomId ?? null,
    p_recipient_user_id: options.recipientUserId ?? null,
    p_price_try: gift.priceTry,
    p_bonus_seconds: gift.bonusSeconds,
  });

  if (error) {
    logSafeWarn('[social] consumeGiftCredit failed', error, { functionName: 'consumeGiftCredit', rpc: 'consume_gift_credit' });
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Hediye hakkı kullanılamadı.') } };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { data: { remaining: Number(row?.remaining_quantity ?? 0) }, error: null };
}
