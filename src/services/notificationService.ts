import { RealtimeChannel } from '@supabase/supabase-js';

import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getFriendlyErrorMessage, isMissingTableError } from '../utils/errorMessages';

type NotificationResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type MarkNotificationsReadInput = {
  currentUserId: string;
  types?: string[];
  actorId?: string;
  requestId?: string;
  threadId?: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

function mapNotification(row: any): AppNotification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body ?? ''),
    data: row.data ?? {},
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
  };
}

export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<NotificationResult<true>> {
  if (!isSupabaseConfigured) {
    return { data: true, error: null };
  }

  const rpcResult = await supabase.rpc('create_notification', {
    p_user_id: input.userId,
    p_actor_id: input.actorId ?? null,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body,
    p_data: input.data ?? {},
  });

  if (!rpcResult.error) {
    return { data: true, error: null };
  }

  logSafeDebug('[notifications] create_notification rpc skipped', rpcResult.error, {
    functionName: 'createNotification',
    rpc: 'create_notification',
  });

  return { data: true, error: null };
}

export function sendMessageNotification(input: {
  receiverId: string;
  senderId: string;
  senderName: string;
  threadId: string;
  message: string;
}) {
  return createNotification({
    userId: input.receiverId,
    actorId: input.senderId,
    type: 'message_received',
    title: input.senderName,
    body: input.message,
    data: {
      senderId: input.senderId,
      actorName: input.senderName,
      threadId: input.threadId,
    },
  });
}

export function sendFriendRequestNotification(input: {
  receiverId: string;
  requesterId: string;
  requesterName: string;
  requestId?: string;
}) {
  return createNotification({
    userId: input.receiverId,
    actorId: input.requesterId,
    type: 'friend_request_received',
    title: 'Arkadaşlık isteği',
    body: `${input.requesterName} sana arkadaşlık isteği gönderdi.`,
    data: {
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      actorName: input.requesterName,
      requestId: input.requestId,
    },
  });
}

export function sendFriendAcceptedNotification(input: {
  receiverId: string;
  friendId: string;
  friendName: string;
  requestId: string;
}) {
  return createNotification({
    userId: input.receiverId,
    actorId: input.friendId,
    type: 'friend_request_accepted',
    title: 'Arkadaşlık isteği kabul edildi',
    body: `${input.friendName} arkadaşlık isteğini kabul etti.`,
    data: {
      friendId: input.friendId,
      friendName: input.friendName,
      actorName: input.friendName,
      requestId: input.requestId,
    },
  });
}

export async function listUnreadNotifications(currentUserId?: string): Promise<NotificationResult<AppNotification[]>> {
  if (!isSupabaseConfigured || !currentUserId) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, data, is_read, created_at')
    .eq('user_id', currentUserId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });

  if (error) {
    logSafeDebug('[notifications] list skipped', error, { functionName: 'listUnreadNotifications', table: 'notifications' });
    if (isMissingTableError(error)) {
      return { data: [], error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Bildirimler yüklenemedi.') } };
  }

  return { data: (data ?? []).map(mapNotification), error: null };
}

export async function markNotificationsRead(input: MarkNotificationsReadInput): Promise<NotificationResult<true>> {
  if (!isSupabaseConfigured || !input.currentUserId) {
    return { data: true, error: null };
  }

  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', input.currentUserId)
    .eq('is_read', false);

  if (input.types?.length) {
    query = query.in('type', input.types);
  }

  if (input.actorId) {
    query = query.eq('actor_id', input.actorId);
  }

  if (input.requestId) {
    query = query.contains('data', { requestId: input.requestId });
  }

  if (input.threadId) {
    query = query.contains('data', { threadId: input.threadId });
  }

  const { error } = await query;

  if (error) {
    logSafeDebug('[notifications] mark read skipped', error, { functionName: 'markNotificationsRead', table: 'notifications' });
    if (isMissingTableError(error)) {
      return { data: true, error: null };
    }

    return { data: null, error: { message: getFriendlyErrorMessage(error, 'Bildirimler güncellenemedi.') } };
  }

  return { data: true, error: null };
}

export function subscribeToNotifications(
  currentUserId: string,
  onNotification: (notification: AppNotification) => void,
): RealtimeChannel | null {
  if (!isSupabaseConfigured || !currentUserId) {
    return null;
  }

  const topic = `notifications:${currentUserId}`;
  const existingChannels = supabase.getChannels().filter((channel) => channel.topic === topic || channel.topic === `realtime:${topic}`);
  existingChannels.forEach((channel) => {
    void supabase.removeChannel(channel);
  });

  return supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
      (payload) => {
        if (!payload.new) {
          return;
        }

        onNotification(mapNotification(payload.new));
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logSafeDebug('[notifications] realtime reconnect', `status:${status}`);
      }
    });
}
