import { RealtimeChannel } from '@supabase/supabase-js';

import { defaultProfile, getAvatarById, gifts, receivedGifts } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { FriendSummary, GiftItem, MembershipPlan } from '../types';
import { getFriendlyErrorMessage, isMissingTableError } from '../utils/errorMessages';
import { getCurrentUser } from './authService';
import { sendMessageNotification } from './notificationService';

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

export type GiftHistory = {
  received: Array<GiftItem & { count: number }>;
  sent: Array<GiftItem & { count: number }>;
  popular: GiftItem[];
};

export type FriendListData = {
  friends: Array<FriendSummary & { isOnline: boolean; lastSeenAt?: string | null; level: number; dermanScore: number }>;
  incomingRequests: Array<FriendSummary & { requestId: string }>;
  outgoingRequests: Array<FriendSummary & { requestId: string }>;
};

const fallbackFriends: FriendListData['friends'] = [
  { id: 'demo-luna', username: 'Luna_24', avatarId: 'f-2', plan: 'vip', isOnline: true, level: 3, dermanScore: 4.8 },
  { id: 'demo-atlas', username: 'Atlas_28', avatarId: 'm-1', plan: 'plus', isOnline: false, level: 2, dermanScore: 4.6 },
];

function getPlan(value: unknown): MembershipPlan {
  return value === 'plus' || value === 'vip' ? value : 'free';
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
    return new Map<string, FriendSummary & { isOnline?: boolean; lastSeenAt?: string | null }>();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_id, plan, is_online, last_seen_at')
    .in('user_id', userIds);

  if (error) {
    console.error('[social] fetchProfiles failed:', error.message);
    return new Map<string, FriendSummary & { isOnline?: boolean; lastSeenAt?: string | null }>();
  }

  return new Map(
    (data ?? []).map((profile: any) => [
      String(profile.user_id),
      {
        id: String(profile.user_id),
        username: String(profile.username || `kullanici_${String(profile.user_id).slice(0, 6)}`),
        avatarId: String(profile.avatar_id || defaultProfile.avatarId),
        plan: getPlan(profile.plan),
        isOnline: Boolean(profile.is_online),
        lastSeenAt: profile.last_seen_at ?? null,
      },
    ]),
  );
}

export async function listFriends(): Promise<ServiceResult<FriendListData>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data) {
    return {
      data: { friends: fallbackFriends, incomingRequests: [], outgoingRequests: [] },
      error: null,
    };
  }

  const userId = userIdResult.data;
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, receiver_id, status, created_at')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    console.error('[social] listFriends failed:', error.message);
    if (isMissingTableError(error)) {
      return { data: { friends: [], incomingRequests: [], outgoingRequests: [] }, error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Arkadaş listesi yüklenemedi.') } };
  }

  const rows = data ?? [];
  const peerIds = rows.map((row: any) => (row.requester_id === userId ? row.receiver_id : row.requester_id));
  const profiles = await fetchProfiles(peerIds);
  const toSummary = (row: any) => {
    const peerId = String(row.requester_id === userId ? row.receiver_id : row.requester_id);
    return profiles.get(peerId) ?? {
      id: peerId,
      username: `kullanici_${peerId.slice(0, 6)}`,
      avatarId: defaultProfile.avatarId,
      plan: 'free' as MembershipPlan,
      isOnline: false,
      lastSeenAt: null,
    };
  };

  return {
    data: {
      friends: rows
        .filter((row: any) => row.status === 'accepted')
        .map((row: any) => ({ ...toSummary(row), isOnline: Boolean(toSummary(row).isOnline), level: 2, dermanScore: 4.7 })),
      incomingRequests: rows
        .filter((row: any) => row.status === 'pending' && row.receiver_id === userId)
        .map((row: any) => ({ ...toSummary(row), requestId: row.id })),
      outgoingRequests: rows
        .filter((row: any) => row.status === 'pending' && row.requester_id === userId)
        .map((row: any) => ({ ...toSummary(row), requestId: row.id })),
    },
    error: null,
  };
}

export async function updateFriendship(requestId: string, status: 'accepted' | 'blocked'): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from('friendships')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    console.error('[social] updateFriendship failed:', error.message);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Arkadaşlık isteği güncellenemedi.') } };
  }

  return { data: true, error: null };
}

export async function createOrGetThread(peerUserId: string): Promise<ServiceResult<ChatThreadSummary>> {
  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  if (!isSupabaseConfigured || peerUserId.startsWith('demo-')) {
    return {
      data: {
        id: `demo-thread-${peerUserId}`,
        peer: fallbackFriends.find((friend) => friend.id === peerUserId) ?? fallbackFriends[0],
        lastMessage: 'Demo sohbet hazir.',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      },
      error: null,
    };
  }

  const userId = userIdResult.data;
  const [user1Id, user2Id] = [userId, peerUserId].sort();
  const existingResult = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id, last_message, last_message_at, created_at')
    .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
    .maybeSingle();

  if (existingResult.error) {
    console.error('[social] createOrGetThread lookup failed:', existingResult.error.message);
    return { data: null, error: { message: getFriendlyErrorMessage(existingResult.error, 'Sohbet başlatılamadı.') } };
  }

  const threadResult = existingResult.data
    ? { data: existingResult.data, error: null }
    : await supabase
      .from('chat_threads')
      .insert({ user1_id: user1Id, user2_id: user2Id })
      .select('id, user1_id, user2_id, last_message, last_message_at, created_at')
      .single();

  if (threadResult.error || !threadResult.data) {
    console.error('[social] createOrGetThread failed:', threadResult.error?.message ?? 'empty result');
    return { data: null, error: { message: getFriendlyErrorMessage(threadResult.error, 'Sohbet başlatılamadı.') } };
  }

  const data = threadResult.data;
  const profiles = await fetchProfiles([peerUserId]);
  return {
    data: {
      id: data.id,
      peer: profiles.get(peerUserId) ?? { id: peerUserId, username: 'Anonim', avatarId: defaultProfile.avatarId, plan: 'free' },
      lastMessage: data.last_message ?? '',
      lastMessageAt: data.last_message_at ?? data.created_at,
      unreadCount: 0,
    },
    error: null,
  };
}

export async function listThreads(): Promise<ServiceResult<ChatThreadSummary[]>> {
  const userIdResult = await getUserId();

  if (!isSupabaseConfigured || userIdResult.error || !userIdResult.data) {
    return {
      data: [
        {
          id: 'demo-thread-demo-luna',
          peer: fallbackFriends[0],
          lastMessage: 'Merhaba, bugun nasilsin?',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 1,
        },
      ],
      error: null,
    };
  }

  const userId = userIdResult.data;
  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, user1_id, user2_id, last_message, last_message_at, created_at')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[social] listThreads failed:', error.message);
    if (isMissingTableError(error)) {
      return { data: [], error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Sohbetler yüklenemedi.') } };
  }

  const rows = data ?? [];
  const peerIds = rows.map((row: any) => String(row.user1_id === userId ? row.user2_id : row.user1_id));
  const profiles = await fetchProfiles(peerIds);

  return {
    data: rows.map((row: any) => {
      const peerId = String(row.user1_id === userId ? row.user2_id : row.user1_id);
      return {
        id: row.id,
        peer: profiles.get(peerId) ?? { id: peerId, username: 'Anonim', avatarId: defaultProfile.avatarId, plan: 'free' },
        lastMessage: row.last_message ?? '',
        lastMessageAt: row.last_message_at ?? row.created_at,
        unreadCount: 0,
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
          message: 'Merhaba, burasi demo sohbet alani.',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      ],
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, thread_id, sender_id, receiver_id, message, is_read, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[social] listMessages failed:', error.message);
    if (isMissingTableError(error)) {
      return { data: [], error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Mesajlar yüklenemedi.') } };
  }

  return {
    data: (data ?? []).map((row: any) => ({
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
    console.error('[social] sendMessage failed:', error.message);
    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Mesaj gönderilemedi.') } };
  }

  await supabase
    .from('chat_threads')
    .update({ last_message: trimmedMessage, last_message_at: now })
    .eq('id', thread.id);
  await sendMessageNotification();

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

export function subscribeToMessages(threadId: string, onMessage: (message: ChatMessageItem) => void): RealtimeChannel | null {
  if (!isSupabaseConfigured || threadId.startsWith('demo-')) {
    return null;
  }

  const channel = supabase
    .channel(`chat:${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
      (payload) => {
        const row = payload.new as any;
        onMessage({
          id: row.id,
          threadId: row.thread_id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          message: row.message,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
        });
      },
    )
    .subscribe();

  return channel;
}

export async function listGiftHistory(): Promise<ServiceResult<GiftHistory>> {
  if (!isSupabaseConfigured) {
    return {
      data: {
        received: receivedGifts.map((gift) => ({ ...gifts.find((item) => item.id === gift.id)!, count: gift.count })).filter(Boolean),
        sent: [{ ...gifts[1], count: 2 }],
        popular: gifts.slice(0, 4),
      },
      error: null,
    };
  }

  const userIdResult = await getUserId();

  if (userIdResult.error || !userIdResult.data) {
    return { data: null, error: userIdResult.error };
  }

  const { data, error } = await supabase
    .from('gift_transactions')
    .select('sender_id, receiver_id, gift_type, created_at')
    .or(`sender_id.eq.${userIdResult.data},receiver_id.eq.${userIdResult.data}`);

  if (error) {
    console.error('[social] listGiftHistory failed:', error.message);
    if (isMissingTableError(error)) {
      return { data: { received: [], sent: [], popular: gifts.slice(0, 4) }, error: null };
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
      popular: gifts.slice(0, 4),
    },
    error: null,
  };
}
