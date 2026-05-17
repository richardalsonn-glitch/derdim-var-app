import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar, BottomTabItem } from '../components/home/BottomTabBar';
import { HomePalette } from '../components/home/types';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radius, spacing } from '../constants/theme';
import { logSafeDebug } from '../lib/safeLogger';
import { supabase } from '../lib/supabase';
import { AppScreenProps } from '../navigation/types';
import { markNotificationsRead } from '../services/notificationService';
import { getCurrentUser } from '../services/authService';
import { setActiveChatThreadId } from '../services/chatActivityService';
import {
  ChatMessageItem,
  ChatThreadSummary,
  createOrGetThread,
  deleteThreadForCurrentUser,
  getPeerPresence,
  listMessages,
  listThreads,
  markThreadMessagesRead,
  sendMessage,
  subscribeToMessages,
  subscribeToPeerPresence,
  subscribeToThreads,
} from '../services/socialService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getScreenLayout } from '../utils/responsive';
import { mergeChatMessages, shouldAutoScrollForIncomingMessage } from '../utils/chatState';

type PresenceState = {
  isOnline: boolean;
  lastSeenAt: string | null;
};

type ThreadFilter = 'all' | 'unread' | 'online';

const chatPalette: HomePalette = {
  theme: 'dark',
  background: ['#040713', '#090B20', '#110822'],
  orbPrimary: 'rgba(255, 79, 185, 0.16)',
  orbSecondary: 'rgba(69, 224, 255, 0.14)',
  surface: 'rgba(255,255,255,0.08)',
  surfaceStrong: 'rgba(11, 13, 35, 0.92)',
  border: 'rgba(190, 132, 255, 0.18)',
  text: '#F8EFFF',
  muted: '#BBB5D8',
  dim: '#7F7BA1',
  pink: '#FF4FB9',
  purple: '#9C49FF',
  blue: '#4E83FF',
  cyan: '#50D5FF',
  gold: '#FFD36B',
  green: '#36F07B',
  tabInactive: '#ABA6C5',
  shadow: 'rgba(101, 50, 194, 0.42)',
};

const chatBottomTabs: BottomTabItem[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'chats', label: 'Sohbetler', icon: 'chatbox-ellipses' },
  { key: 'gifts', label: 'Hediyeler', icon: 'gift' },
  { key: 'friends', label: 'Arkadaşlar', icon: 'people' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
];

function formatPresenceText(presence: PresenceState, isTyping: boolean) {
  if (isTyping) {
    return 'yazıyor...';
  }

  if (presence.isOnline) {
    return 'Çevrimiçi';
  }

  if (!presence.lastSeenAt) {
    return 'Son görülme bilgisi yok';
  }

  const diffMs = Date.now() - new Date(presence.lastSeenAt).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `son görülme: ${diffMinutes} dk önce`;
  }

  return `son görülme: ${new Date(presence.lastSeenAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatThreadTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({ navigation, route }: AppScreenProps<'Chat'>) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const screenLayout = getScreenLayout({ width, height }, insets, { bottomInsetMode: 'bottom-tab' });
  const compact = screenLayout.isCompactPhone || height <= 844;
  const bottomTab = screenLayout.bottomTab;
  const listRef = useRef<FlatList<ChatMessageItem> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isNearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIdsRef = useRef(new Set<string>());
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThreadSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [peerPresence, setPeerPresence] = useState<PresenceState>({ isOnline: false, lastSeenAt: null });
  const [threadClearedForCurrentUser, setThreadClearedForCurrentUser] = useState(false);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);

  const scrollToEndSoon = useCallback((animated: boolean) => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      scrollTimeoutRef.current = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated });
      }, 80);
    });
  }, []);

  const sendTypingSignal = useCallback(
    (isTyping: boolean) => {
      const channel = typingChannelRef.current;

      if (!channel || !currentUserId) {
        return;
      }

      const payload = { userId: currentUserId, isTyping };
      const channelWithHttpSend = channel as typeof channel & { httpSend?: (input: unknown) => Promise<unknown> };

      if (typeof channelWithHttpSend.httpSend === 'function') {
        void channelWithHttpSend.httpSend({
          type: 'broadcast',
          event: 'typing',
          payload,
        });
        return;
      }

      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload,
      }, {});
    },
    [currentUserId],
  );
  const [peerTyping, setPeerTyping] = useState(false);
  const peerUserId = route.params?.peerUserId;
  const routeThreadId = route.params?.threadId;
  const activeThreadId = activeThread?.id;
  const activePeerId = activeThread?.peer.id;

  const headerPresenceText = useMemo(
    () => formatPresenceText(peerPresence, peerTyping),
    [peerPresence, peerTyping],
  );
  const filteredThreads = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase('tr-TR');

    return threads.filter((thread) => {
      const matchesSearch = !normalizedSearch
        || thread.peer.username.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || thread.lastMessage.toLocaleLowerCase('tr-TR').includes(normalizedSearch);
      const matchesFilter = threadFilter === 'all'
        || (threadFilter === 'unread' && thread.unreadCount > 0)
        || (threadFilter === 'online' && Boolean(thread.peer.isOnline));

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, threadFilter, threads]);

  const loadThreadList = useCallback(async (preferredThreadId?: string) => {
    const result = await listThreads();

    if (result.error || !result.data) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbetler şu anda yüklenemedi.'));
      return;
    }

    logSafeDebug('[chat]', `chatListRefresh reason:load count:${result.data.length}`);
    setThreads(result.data);

    if (preferredThreadId) {
      setActiveThread(result.data.find((thread) => thread.id === preferredThreadId) ?? null);
    }
  }, []);

  const applyIncomingMessage = useCallback((message: ChatMessageItem) => {
    const isNewMessage = !messageIdsRef.current.has(message.id);
    logSafeDebug('[chat]', `realtimeMessageReceived id:${message.id}`);

    if (isNewMessage) {
      messageIdsRef.current.add(message.id);
      setMessages((current) => mergeChatMessages(current, [message]));
    } else {
      logSafeDebug('[chat]', `duplicateMessageIgnored id:${message.id}`);
    }

    const shouldAutoScroll = shouldAutoScrollForIncomingMessage({
      isNearBottom: isNearBottomRef.current,
      isOwnMessage: message.senderId === currentUserId,
    });

    if (isNewMessage && shouldAutoScroll) {
      setShowNewMessageButton(false);
      logSafeDebug('[chat]', `autoScroll reason:${message.senderId === currentUserId ? 'user-message' : 'new-message-at-bottom'}`);
      scrollToEndSoon(true);
    } else if (isNewMessage && message.senderId !== currentUserId) {
      logSafeDebug('[chat]', 'autoScrollSkipped reason:user-reading-old-messages');
      setShowNewMessageButton(true);
    }

    setThreadClearedForCurrentUser(false);
    setActiveThread((current) => (current && current.id === message.threadId
      ? {
        ...current,
        lastMessage: message.message,
        lastMessageAt: message.createdAt,
        clearedForCurrentUser: false,
      }
      : current));
    setThreads((current) => current.map((thread) => (thread.id === message.threadId
      ? {
        ...thread,
        lastMessage: message.message,
        lastMessageAt: message.createdAt,
        unreadCount: 0,
        clearedForCurrentUser: false,
      }
      : thread)));
  }, [currentUserId, scrollToEndSoon]);

  const markActiveThreadRead = useCallback(async (threadId: string) => {
    if (!currentUserId || !threadId) {
      return;
    }

    await Promise.all([
      markThreadMessagesRead(threadId),
      markNotificationsRead({
        currentUserId,
        types: ['message_received'],
        threadId,
      }),
    ]);
  }, [currentUserId]);

  useEffect(() => {
    let mounted = true;

    async function resolveCurrentUser() {
      const userResult = await getCurrentUser();

      if (!mounted) {
        return;
      }

      setCurrentUserId(userResult.data?.id ?? null);
    }

    void resolveCurrentUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveChatThreadId(activeThreadId ?? null);

    if (activeThreadId) {
      initialScrollDoneRef.current = false;
      isNearBottomRef.current = true;
      setShowNewMessageButton(false);
    }

    return () => {
      setActiveChatThreadId(null);
    };
  }, [activeThreadId]);

  useEffect(() => () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    setActiveChatThreadId(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      setLoading(true);
      setErrorMessage('');

      if (peerUserId) {
        const result = await createOrGetThread(peerUserId);

        if (!mounted) {
          return;
        }

        if (result.error || !result.data) {
          setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbet açılamadı. Lütfen tekrar deneyin.'));
          setLoading(false);
          return;
        }

        setActiveThread(result.data);
        setLoading(false);
        return;
      }

      await loadThreadList(routeThreadId);

      if (mounted) {
        setLoading(false);
      }
    }

    void loadInitial();

    return () => {
      mounted = false;
    };
  }, [loadThreadList, peerUserId, routeThreadId]);

  useEffect(() => {
    if (activeThread || !currentUserId) {
      return undefined;
    }

    const channel = subscribeToThreads(() => {
      logSafeDebug('[chat]', 'chatListRefresh reason:realtime-thread');
      void loadThreadList(routeThreadId);
    }, currentUserId);

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [activeThread, currentUserId, loadThreadList, routeThreadId]);

  useEffect(() => {
    if (!activeThreadId || !activePeerId) {
      setMessages((current) => (current.length > 0 ? [] : current));
      messageIdsRef.current = new Set();
      setPeerPresence({ isOnline: false, lastSeenAt: null });
      setPeerTyping(false);
      setThreadClearedForCurrentUser(false);
      return undefined;
    }

    const threadId = activeThreadId;
    const peerId = activePeerId;
    const initialThreadCleared = Boolean(activeThread?.clearedForCurrentUser);
    let mounted = true;

    setMessages((current) => (current.length > 0 ? [] : current));
    messageIdsRef.current = new Set();
    setThreadClearedForCurrentUser(initialThreadCleared);

    async function refreshConversation(source: 'initial' | 'poll') {
      const [messagesResult, presenceResult] = await Promise.all([
        listMessages(threadId),
        getPeerPresence(peerId),
      ]);

      if (!mounted) {
        return;
      }

      if (messagesResult.error || !messagesResult.data) {
        if (source === 'initial') {
          setErrorMessage(getFriendlyErrorMessage(messagesResult.error, 'Mesajlar yüklenemedi.'));
        }
      } else {
        setErrorMessage('');
        logSafeDebug('[chat]', `messagesFetched count:${messagesResult.data.length} source:${source}`);
        setMessages((current) => {
          const incoming = messagesResult.data ?? [];
          const next = mergeChatMessages(current, incoming);
          messageIdsRef.current = new Set(next.map((item) => item.id));
          return next;
        });
        setThreadClearedForCurrentUser(initialThreadCleared && (messagesResult.data?.length ?? 0) === 0);
      }

      if (presenceResult.data) {
        setPeerPresence(presenceResult.data);
      }

      await markActiveThreadRead(threadId);
    }

    void refreshConversation('initial');

    const messageChannel = subscribeToMessages(threadId, (message) => {
      applyIncomingMessage(message);
      if (message.senderId === peerId) {
        void markActiveThreadRead(threadId);
      }
    });

    const pollingInterval = setInterval(() => {
      void refreshConversation('poll');
    }, 2000);

    const presenceChannel = subscribeToPeerPresence(peerId, () => {
      void getPeerPresence(peerId).then((result) => {
        if (result.data) {
          setPeerPresence(result.data);
        }
      });
    });

    const typingChannel = supabase
      .channel(`chat-typing:${threadId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const next = payload.payload as { userId?: string; isTyping?: boolean };

        if (next.userId && next.userId === peerId) {
          setPeerTyping(Boolean(next.isTyping));
        }
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    const presenceInterval = setInterval(() => {
      void getPeerPresence(peerId).then((result) => {
        if (result.data) {
          setPeerPresence(result.data);
        }
      });
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(presenceInterval);
      clearInterval(pollingInterval);
      setPeerTyping(false);

      if (messageChannel) {
        void supabase.removeChannel(messageChannel);
      }

      if (presenceChannel) {
        void supabase.removeChannel(presenceChannel);
      }

      if (typingChannelRef.current) {
        sendTypingSignal(false);
        void supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [activePeerId, activeThreadId, applyIncomingMessage, markActiveThreadRead, sendTypingSignal]);

  useEffect(() => {
    if (!activeThreadId || !currentUserId || !typingChannelRef.current) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    sendTypingSignal(draft.trim().length > 0);

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingSignal(false);
    }, 2200);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [activeThreadId, currentUserId, draft, sendTypingSignal]);

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  useEffect(() => {
    if (!activeThreadId || messages.length === 0) {
      return;
    }

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      setShowNewMessageButton(false);
      logSafeDebug('[chat]', 'autoScroll reason:first-load');
      scrollToEndSoon(false);
      return;
    }

    if (isNearBottomRef.current) {
      setShowNewMessageButton(false);
      logSafeDebug('[chat]', 'autoScroll reason:new-message-at-bottom');
      scrollToEndSoon(true);
    }
  }, [activeThreadId, messages.length, scrollToEndSoon]);

  async function handleSend() {
    if (!activeThread || sending || !draft.trim()) {
      return;
    }

    setSending(true);
    const result = await sendMessage(activeThread, draft);
    const sentMessage = result.data;

    if (result.error || !sentMessage) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Mesaj şu an gönderilemedi.'));
    } else {
      applyIncomingMessage(sentMessage);
      setDraft('');
      setErrorMessage('');
      await markActiveThreadRead(activeThread.id);
      scrollToEndSoon(true);
    }

    setSending(false);
  }

  async function deleteConversation(thread: ChatThreadSummary) {
    if (deletingThreadId) {
      return;
    }

    setDeletingThreadId(thread.id);
    const result = await deleteThreadForCurrentUser(thread.id);

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbet silinemedi.'));
      setDeletingThreadId(null);
      return;
    }

      if (activeThread?.id === thread.id) {
        setActiveThread(null);
        setMessages([]);
        setThreadClearedForCurrentUser(false);
      }

    setThreads((current) => current.filter((item) => item.id !== thread.id));
    setDeletingThreadId(null);
  }

  function confirmDeleteConversation(thread: ChatThreadSummary) {
    Alert.alert(
      'Sohbeti sil',
      'Bu sohbeti silmek istiyor musun?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Sohbeti Sil', style: 'destructive', onPress: () => void deleteConversation(thread) },
      ],
    );
  }

  function handleBottomTabSelect(item: BottomTabItem) {
    switch (item.key) {
      case 'home':
        navigation.navigate('Home');
        return;
      case 'chats':
        setActiveThread(null);
        return;
      case 'gifts':
        navigation.navigate('Gifts');
        return;
      case 'friends':
        navigation.navigate('Friends');
        return;
      case 'settings':
        navigation.navigate('Settings');
        return;
      default:
        return;
    }
  }

  function handleMessageListScroll(event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const nearBottom = distanceFromBottom < 96;

    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowNewMessageButton(false);
    }
  }

  function renderFilterChip(filter: ThreadFilter, label: string, icon?: keyof typeof Ionicons.glyphMap) {
    const selected = threadFilter === filter;

    return (
      <Pressable onPress={() => setThreadFilter(filter)} style={[styles.filterChip, selected && styles.filterChipActive]}>
        {icon ? <Ionicons color={selected ? colors.text : colors.muted} name={icon} size={14} /> : null}
        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  function renderDeleteAction(item: ChatThreadSummary) {
    return (
      <Pressable onPress={() => confirmDeleteConversation(item)} style={styles.deleteAction}>
        <Ionicons color={colors.text} name="trash" size={20} />
        <Text style={styles.deleteActionText}>Sil</Text>
      </Pressable>
    );
  }

  function renderThread({ item }: { item: ChatThreadSummary }) {
    const isOnline = Boolean(item.peer.isOnline);

    return (
      <Swipeable renderRightActions={() => renderDeleteAction(item)} overshootRight={false}>
        <Pressable onPress={() => setActiveThread(item)} style={({ pressed }) => [styles.threadPressable, pressed && styles.threadPressed]}>
          <LinearGradient colors={['rgba(255, 79, 185, 0.18)', 'rgba(92, 69, 255, 0.08)']} style={styles.threadGlowBorder}>
          <View style={styles.threadCard}>
            <View style={styles.threadAvatarWrap}>
              <UserAvatar
                avatarId={item.peer.avatarId}
                avatarSourceType="peer-profile"
                currentUserId={currentUserId}
                renderedUserId={item.peer.id}
                size={62}
              />
              <View style={[styles.threadOnlineDot, isOnline ? styles.threadOnlineDotActive : styles.threadOnlineDotOffline]} />
            </View>
            <View style={styles.threadCopy}>
              <View style={styles.threadTop}>
                <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={1} style={styles.title}>{item.peer.username}</Text>
                <Text style={styles.threadTime}>{formatThreadTime(item.lastMessageAt)}</Text>
              </View>
              <Text numberOfLines={1} style={styles.muted}>{item.lastMessage || 'Henüz mesaj yok.'}</Text>
            </View>
            {item.unreadCount > 0 ? <Text style={styles.badge}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text> : null}
          </View>
          </LinearGradient>
        </Pressable>
      </Swipeable>
    );
  }

  function renderMessage({ item }: { item: ChatMessageItem }) {
    const mine = item.senderId === currentUserId;

    return (
      <View style={[styles.messageRow, mine ? styles.myRow : styles.peerRow]}>
        <LinearGradient
          colors={mine ? ['rgba(151,73,255,0.95)', 'rgba(255,84,189,0.92)'] : ['rgba(62,95,122,0.65)', 'rgba(44,57,82,0.64)']}
          style={[styles.messageBubble, mine ? styles.myBubble : styles.peerBubble]}
        >
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <PremiumScreen contentStyle={styles.center} scroll={false}>
        <ActivityIndicator color={colors.cyan} />
      </PremiumScreen>
    );
  }

  return (
    <PremiumScreen bottomInsetMode={activeThread ? 'default' : 'none'} contentStyle={styles.content} scroll={false}>
      {activeThread ? (
        <ScreenHeader
        onBack={activeThread ? () => setActiveThread(null) : () => navigation.goBack()}
        subtitle={activeThread ? 'Güvenli mesajlaşma alanı' : 'Arkadaşlarınla mesajlaş'}
        title={activeThread ? 'Sohbet' : 'Sohbetler'}
        rightAction={activeThread ? (
          <Pressable
            disabled={deletingThreadId === activeThread.id}
            onPress={() => confirmDeleteConversation(activeThread)}
            style={[styles.headerDeleteButton, deletingThreadId === activeThread.id && styles.headerDeleteButtonDisabled]}
          >
            <Ionicons color={colors.pink} name="ellipsis-horizontal" size={18} />
          </Pressable>
        ) : undefined}
        />
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {activeThread ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(74, insets.top + 56) : 0}
          style={styles.chatPane}
        >
          <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
            <View style={[styles.chatBody, compact && styles.chatBodyCompact]}>
              <View style={[styles.chatHeaderCard, compact && styles.chatHeaderCardCompact]}>
                <UserAvatar
                  avatarId={activeThread.peer.avatarId}
                  avatarSourceType="peer-profile"
                  currentUserId={currentUserId}
                  renderedUserId={activeThread.peer.id}
                  size={42}
                />
                <View style={styles.chatHeaderTextWrap}>
                  <Text style={[styles.chatHeaderName, compact && styles.chatHeaderNameCompact]}>{activeThread.peer.username}</Text>
                  <Text style={[styles.chatHeaderPresence, compact && styles.chatHeaderPresenceCompact, peerTyping && styles.chatHeaderTyping]}>{headerPresenceText}</Text>
                </View>
                <Pressable style={styles.voiceAction}>
                  <Ionicons color={colors.cyan} name="call" size={18} />
                </Pressable>
              </View>

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={threadClearedForCurrentUser
                  ? (
                    <View>
                      <Text style={styles.empty}>Bu sohbet temizlendi.</Text>
                      <Text style={styles.emptySub}>Yeni mesajlar burada görünecek.</Text>
                    </View>
                  )
                  : <Text style={styles.empty}>Henüz mesaj yok. İlk mesajı sen gönder.</Text>}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => {
                  if (!initialScrollDoneRef.current || isNearBottomRef.current) {
                    scrollToEndSoon(!initialScrollDoneRef.current);
                  }
                }}
                onScroll={handleMessageListScroll}
                scrollEventThrottle={80}
              />

              {showNewMessageButton ? (
                <Pressable
                  onPress={() => {
                    setShowNewMessageButton(false);
                    isNearBottomRef.current = true;
                    scrollToEndSoon(true);
                  }}
                  style={styles.newMessageButton}
                >
                  <Ionicons color={colors.text} name="arrow-down" size={14} />
                  <Text style={styles.newMessageButtonText}>Yeni mesaj</Text>
                </Pressable>
              ) : null}

              <View style={[styles.composer, compact && styles.composerCompact]}>
                <TextInput
                  multiline
                  onChangeText={setDraft}
                  placeholder="Mesaj yaz..."
                  placeholderTextColor={colors.dim}
                  style={[styles.input, compact && styles.inputCompact]}
                  value={draft}
                  maxLength={700}
                />
                <Pressable disabled={sending || !draft.trim()} onPress={() => void handleSend()} style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}>
                  <Ionicons color={colors.text} name="send" size={18} />
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.listPane}>
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={(
            <View style={styles.listHeader}>
              <View style={styles.listHero}>
                <Pressable onPress={() => navigation.goBack()} style={styles.heroBackButton}>
                  <Ionicons color={colors.text} name="chevron-back" size={28} />
                </Pressable>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
                  Sohbetler
                </Text>
                <Text style={[styles.heroSubtitle, compact && styles.heroSubtitleCompact]}>Arkadaşlarınla mesajlaş</Text>
              </View>

              <LinearGradient colors={['rgba(255, 79, 185, 0.42)', 'rgba(80, 116, 255, 0.36)']} style={styles.searchGlowBorder}>
                <View style={[styles.searchBar, compact && styles.searchBarCompact]}>
                  <Ionicons color="#D8CCFF" name="search" size={compact ? 24 : 27} />
                  <TextInput
                    onChangeText={setSearchQuery}
                    placeholder="Sohbet ara..."
                    placeholderTextColor="#AAA3C8"
                    style={[styles.searchInput, compact && styles.searchInputCompact]}
                    value={searchQuery}
                  />
                  <Pressable onPress={() => setSearchQuery('')} style={styles.searchTuneButton}>
                    <Ionicons color="#C9C0EA" name={searchQuery ? 'close' : 'options-outline'} size={22} />
                  </Pressable>
                </View>
              </LinearGradient>

              <View style={styles.filterRow}>
                {renderFilterChip('all', 'Tümü')}
                {renderFilterChip('unread', 'Okunmamış', 'ellipse')}
                {renderFilterChip('online', 'Çevrimiçi', 'ellipse')}
              </View>

              <Pressable onPress={() => navigation.navigate('Friends')} style={({ pressed }) => [styles.newChatCard, pressed && styles.threadPressed]}>
                <LinearGradient colors={['rgba(255, 79, 185, 0.22)', 'rgba(92, 69, 255, 0.12)']} style={styles.newChatIcon}>
                  <Ionicons color={colors.text} name="add" size={34} />
                </LinearGradient>
                <View style={styles.newChatCopy}>
                  <Text style={styles.newChatTitle}>Yeni sohbet başlat</Text>
                  <Text numberOfLines={1} style={styles.newChatSubtitle}>Yeni arkadaşlar edin, sohbetlere katıl</Text>
                </View>
                <Ionicons color={colors.text} name="chevron-forward" size={24} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Henüz sohbetin yok. Bir arkadaş eklediğinde buradan mesajlaşabilirsin.</Text>}
          renderItem={renderThread}
          contentContainerStyle={[styles.list, { paddingBottom: bottomTab.contentPaddingBottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
        <View style={[styles.bottomTabWrap, { height: bottomTab.containerHeight, paddingBottom: bottomTab.bottomInset, paddingHorizontal: bottomTab.sideMargin }]}>
          <View style={[styles.bottomTabInner, { height: bottomTab.barHeight, maxWidth: bottomTab.maxWidth }]}>
            <BottomTabBar activeKey="chats" compact={compact} items={chatBottomTabs} onSelect={handleBottomTabSelect} palette={chatPalette} />
          </View>
        </View>
        </View>
      )}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  listPane: {
    flex: 1,
    position: 'relative',
  },
  listHeader: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  listHero: {
    paddingTop: spacing.sm,
  },
  heroBackButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    textShadowColor: 'rgba(255,255,255,0.18)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 20,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  heroSubtitle: {
    color: '#C6C0DE',
    fontSize: 19,
    marginTop: 4,
  },
  heroSubtitleCompact: {
    fontSize: 16,
  },
  searchGlowBorder: {
    borderRadius: 31,
    padding: 2,
    shadowColor: colors.pink,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  searchBar: {
    minHeight: 62,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(7, 8, 30, 0.92)',
  },
  searchBarCompact: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 0,
  },
  searchInputCompact: {
    fontSize: 16,
  },
  searchTuneButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(174, 151, 255, 0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  filterChipActive: {
    borderColor: 'rgba(255, 96, 205, 0.68)',
    backgroundColor: 'rgba(255, 79, 185, 0.72)',
    shadowColor: colors.pink,
    shadowOpacity: 0.34,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: colors.text,
  },
  threadPressable: {
    borderRadius: 28,
  },
  threadPressed: {
    opacity: 0.84,
  },
  threadGlowBorder: {
    borderRadius: 28,
    padding: 1.5,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 86,
    gap: spacing.md,
    borderRadius: 26,
    backgroundColor: 'rgba(8, 9, 32, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  threadAvatarWrap: {
    position: 'relative',
  },
  threadOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#080920',
  },
  threadOnlineDotActive: {
    backgroundColor: colors.green,
  },
  threadOnlineDotOffline: {
    backgroundColor: '#9D98B8',
  },
  threadCopy: {
    flex: 1,
    minWidth: 0,
  },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    flex: 1,
    minWidth: 0,
  },
  muted: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
  },
  unreadMessage: {
    color: '#DDD7F5',
  },
  threadTime: {
    color: '#B9B3D1',
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  badge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 8,
    overflow: 'hidden',
    color: colors.text,
    backgroundColor: colors.pink,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '800',
    fontSize: 16,
    shadowColor: colors.pink,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  emptyCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 185, 0.28)',
    backgroundColor: 'rgba(10, 11, 36, 0.78)',
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  emptyDescription: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  newChatCard: {
    minHeight: 80,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 79, 185, 0.32)',
    backgroundColor: 'rgba(8, 9, 32, 0.88)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  newChatIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  newChatCopy: {
    flex: 1,
    minWidth: 0,
  },
  newChatTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  newChatSubtitle: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 13,
  },
  bottomTabWrap: {
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomTabInner: {
    width: '100%',
  },
  headerDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerDeleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteAction: {
    width: 86,
    marginVertical: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#D61E50',
  },
  deleteActionText: {
    color: colors.text,
    fontWeight: '900',
  },
  chatPane: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
    gap: spacing.sm,
  },
  chatBodyCompact: {
    gap: spacing.xs,
  },
  chatHeaderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(17,25,42,0.8)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chatHeaderCardCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  chatHeaderTextWrap: {
    flex: 1,
  },
  chatHeaderName: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
  },
  chatHeaderNameCompact: {
    fontSize: 14,
  },
  chatHeaderPresence: {
    color: colors.muted,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  chatHeaderPresenceCompact: {
    fontSize: 11,
  },
  chatHeaderTyping: {
    color: colors.cyan,
  },
  voiceAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  messageList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  newMessageButton: {
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: -spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 79, 185, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  newMessageButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  messageRow: {
    width: '100%',
  },
  myRow: {
    alignItems: 'flex-end',
  },
  peerRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  myBubble: {
    borderTopRightRadius: 8,
  },
  peerBubble: {
    borderTopLeftRadius: 8,
  },
  messageText: {
    color: colors.text,
    lineHeight: 20,
    fontSize: 14,
  },
  messageTime: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  composerCompact: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  inputCompact: {
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    padding: spacing.lg,
  },
  emptySub: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
