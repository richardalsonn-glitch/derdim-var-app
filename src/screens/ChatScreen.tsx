import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { ChatMessageItem, ChatThreadSummary, createOrGetThread, listMessages, listThreads, sendMessage, subscribeToMessages } from '../services/socialService';
import { supabase } from '../lib/supabase';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

export function ChatScreen({ navigation, route }: AppScreenProps<'Chat'>) {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThreadSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorMessage('');

      if (route.params?.peerUserId) {
        const result = await createOrGetThread(route.params.peerUserId);

        if (!mounted) {
          return;
        }

        if (result.error || !result.data) {
          setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbet açılamadı.'));
          setLoading(false);
          return;
        }

        setActiveThread(result.data);
        setLoading(false);
        return;
      }

      const result = await listThreads();

      if (!mounted) {
        return;
      }

      if (result.error || !result.data) {
        setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbetler yüklenemedi.'));
      } else {
        setThreads(result.data);
        const initialThread = route.params?.threadId ? result.data.find((thread) => thread.id === route.params?.threadId) : null;
        setActiveThread(initialThread ?? null);
      }

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [route.params?.peerUserId, route.params?.threadId]);

  useEffect(() => {
    if (!activeThread) {
      return undefined;
    }

    let mounted = true;
    void listMessages(activeThread.id).then((result) => {
      if (!mounted) {
        return;
      }

      if (result.error || !result.data) {
        setErrorMessage(getFriendlyErrorMessage(result.error, 'Mesajlar yüklenemedi.'));
      } else {
        setMessages(result.data);
      }
    });

    const channel = subscribeToMessages(activeThread.id, (message) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    });

    return () => {
      mounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [activeThread]);

  async function handleSend() {
    if (!activeThread || sending || !draft.trim()) {
      return;
    }

    setSending(true);
    const result = await sendMessage(activeThread, draft);

    const sentMessage = result.data;

    if (result.error || !sentMessage) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Mesaj gönderilemedi.'));
    } else {
      setMessages((current) => [...current, sentMessage]);
      setDraft('');
    }

    setSending(false);
  }

  function renderThread({ item }: { item: ChatThreadSummary }) {
    return (
      <Pressable onPress={() => setActiveThread(item)}>
        <GlassCard style={styles.threadCard}>
          <Avatar avatar={getAvatarById(item.peer.avatarId)} size={52} />
          <View style={styles.threadCopy}>
            <View style={styles.threadTop}>
              <Text style={styles.title}>{item.peer.username}</Text>
              {item.unreadCount > 0 ? <Text style={styles.badge}>{item.unreadCount}</Text> : null}
            </View>
            <Text numberOfLines={1} style={styles.muted}>{item.lastMessage || 'Henuz mesaj yok.'}</Text>
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={18} />
        </GlassCard>
      </Pressable>
    );
  }

  function renderMessage({ item }: { item: ChatMessageItem }) {
    const mine = item.senderId !== activeThread?.peer.id;

    return (
      <View style={[styles.messageBubble, mine ? styles.myBubble : styles.peerBubble]}>
        <Text style={styles.messageText}>{item.message}</Text>
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
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader
        onBack={activeThread ? () => setActiveThread(null) : () => navigation.goBack()}
        subtitle={activeThread ? 'Guvenli mesajlasma alani' : 'Arkadaslarinla mesajlas'}
        title={activeThread ? activeThread.peer.username : 'Sohbetler'}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {activeThread ? (
        <View style={styles.chatPane}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Bu sohbette henuz mesaj yok.</Text>}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
          />
          <View style={styles.composer}>
            <TextInput
              onChangeText={setDraft}
              placeholder="Mesaj yaz..."
              placeholderTextColor={colors.dim}
              style={styles.input}
              value={draft}
            />
            <Pressable disabled={sending || !draft.trim()} onPress={() => void handleSend()} style={styles.sendButton}>
              <Ionicons color={colors.text} name="send" size={18} />
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Henüz sohbetin yok. Bir arkadaş eklediğinde buradan mesajlaşabilirsin.</Text>}
          renderItem={renderThread}
          contentContainerStyle={styles.list}
        />
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
    paddingBottom: spacing.xl,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  threadCopy: {
    flex: 1,
  },
  threadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    marginTop: 3,
  },
  badge: {
    minWidth: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
    color: colors.text,
    backgroundColor: colors.pink,
    textAlign: 'center',
    fontWeight: '800',
  },
  chatPane: {
    flex: 1,
  },
  messageList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(154,70,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  peerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    color: colors.text,
    lineHeight: 20,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
