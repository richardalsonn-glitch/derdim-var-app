import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { AppScreenProps } from '../navigation/types';
import { markNotificationsRead } from '../services/notificationService';
import { createOrGetThread, FriendAvailabilityStatus, FriendListData, listFriends, removeFriend, subscribeToFriendships, updateFriendship } from '../services/socialService';
import { getCurrentUser } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { useFriendCall } from '../providers/FriendCallProvider';

type FriendItem = FriendListData['friends'][number];
type RequestItem = FriendListData['incomingRequests'][number];

function getAvailabilityMeta(status: FriendAvailabilityStatus | undefined) {
  switch (status) {
    case 'available':
      return {
        label: 'Müsait',
        message: '',
        dotStyle: styles.statusDotAvailable,
        callDisabled: false,
      };
    case 'searching':
      return {
        label: 'Eşleşme aranıyor',
        message: 'Bu kullanıcı şu anda eşleşme arıyor.',
        dotStyle: styles.statusDotSearching,
        callDisabled: true,
      };
    case 'busy':
      return {
        label: 'Başka görüşmede',
        message: 'Bu kullanıcı şu anda başka bir görüşmede.',
        dotStyle: styles.statusDotBusy,
        callDisabled: true,
      };
    case 'offline':
    default:
      return {
        label: 'Çevrim dışı',
        message: 'Bu kullanıcı şu anda çevrim dışı.',
        dotStyle: styles.statusDotOffline,
        callDisabled: true,
      };
  }
}

export function FriendsScreen({ navigation }: AppScreenProps<'Friends'>) {
  const { width, height } = useWindowDimensions();
  const compact = useMemo(() => width <= 390 || height <= 844, [height, width]);
  const [data, setData] = useState<FriendListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isCallingFriend, startFriendCall } = useFriendCall();

  async function loadFriends() {
    setLoading(true);
    const result = await listFriends();

    if (result.error || !result.data) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Arkadaşlar yüklenemedi.'));
    } else {
      setData(result.data);
      setErrorMessage('');
    }

    setLoading(false);
  }

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
    void loadFriends();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    void markNotificationsRead({
      currentUserId,
      types: ['friend_request_received', 'friend_request_accepted'],
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const channel = subscribeToFriendships(() => {
      void loadFriends();
    }, currentUserId);
    const polling = setInterval(() => {
      void loadFriends();
    }, 5000);

    return () => {
      clearInterval(polling);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [currentUserId]);

  async function openMessage(friendId: string) {
    if (openingChatId) {
      return;
    }

    setOpeningChatId(friendId);
    const result = await createOrGetThread(friendId);
    setOpeningChatId(null);

    if (result.error || !result.data) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbet açılmadı. Lütfen tekrar deneyin.'));
      return;
    }

    setErrorMessage('');
    navigation.navigate('Chat', { threadId: result.data.id, peerUserId: friendId });
  }

  async function accept(request: RequestItem) {
    if (updatingRequestId) {
      return;
    }

    setUpdatingRequestId(request.requestId);
    const result = await updateFriendship(request.requestId, 'accepted');

    if (result.error) {
      setUpdatingRequestId(null);
      setErrorMessage(getFriendlyErrorMessage(result.error, 'İstek şu an güncellenemedi. Lütfen tekrar dene.'));
      return;
    }

    if (currentUserId) {
      await markNotificationsRead({
        currentUserId,
        types: ['friend_request_received'],
        actorId: request.id,
        requestId: request.requestId,
      });
    }

    setUpdatingRequestId(null);
    setErrorMessage('');
    setSuccessMessage('Arkadaşlık isteği kabul edildi.');
    await loadFriends();
  }

  async function reject(request: RequestItem) {
    if (updatingRequestId) {
      return;
    }

    setUpdatingRequestId(request.requestId);
    const result = await updateFriendship(request.requestId, 'rejected');

    if (result.error) {
      setUpdatingRequestId(null);
      setErrorMessage(getFriendlyErrorMessage(result.error, 'İstek şu an güncellenemedi. Lütfen tekrar dene.'));
      return;
    }

    if (currentUserId) {
      await markNotificationsRead({
        currentUserId,
        types: ['friend_request_received'],
        actorId: request.id,
        requestId: request.requestId,
      });
    }

    setUpdatingRequestId(null);
    setErrorMessage('');
    setSuccessMessage('Arkadaşlık isteği reddedildi.');
    await loadFriends();
  }

  async function callFriend(friend: FriendItem) {
    const availability = getAvailabilityMeta(friend.availabilityStatus);

    if (availability.callDisabled) {
      setSuccessMessage('');
      setErrorMessage(availability.message);
      return;
    }

    if (isCallingFriend) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    const result = await startFriendCall(friend);

    if (!result.ok) {
      setErrorMessage(result.message ?? 'Çağrı başlatılamadı. Lütfen tekrar deneyin.');
    }
  }

  async function removeFriendConfirmed(friendId: string) {
    if (removingFriendId) {
      return;
    }

    setRemovingFriendId(friendId);
    const result = await removeFriend(friendId);
    setRemovingFriendId(null);

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'));
      return;
    }

    setData((current) => current
      ? { ...current, friends: current.friends.filter((friend) => friend.id !== friendId) }
      : current);
    setErrorMessage('');
  }

  function confirmRemoveFriend(friend: FriendItem) {
    Alert.alert(
      'Arkadaşlıktan Çıkar',
      'Bu kişiyi arkadaşlarından kaldırmak istiyor musun?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Arkadaşlıktan Çıkar', style: 'destructive', onPress: () => void removeFriendConfirmed(friend.id) },
      ],
    );
  }

  function renderRemoveAction(friend: FriendItem) {
    return (
      <Pressable disabled={removingFriendId === friend.id} onPress={() => confirmRemoveFriend(friend)} style={styles.removeAction}>
        <Ionicons color={colors.text} name="trash" size={20} />
        <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.removeActionText}>
          Sil
        </Text>
      </Pressable>
    );
  }

  function renderFriend({ item }: { item: FriendItem }) {
    const availability = getAvailabilityMeta(item.availabilityStatus);

    return (
      <Swipeable renderRightActions={() => renderRemoveAction(item)} overshootRight={false}>
        <Pressable onPress={() => navigation.navigate('FriendProfile', { friendId: item.id })}>
          <GlassCard style={styles.friendCard}>
            <UserAvatar
              avatarId={item.avatarId}
              avatarSourceType="friend-profile"
              currentUserId={currentUserId}
              renderedUserId={item.id}
              screen="friends"
              size={54}
              username={item.username}
            />
            <View style={styles.friendCopy}>
              <Text numberOfLines={1} style={styles.title}>{item.username}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, availability.dotStyle]} />
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.statusText}>
                  {availability.label}
                </Text>
              </View>
              <Text style={styles.muted}>Level {item.level} - Derman {item.dermanScore.toFixed(1)}</Text>
            </View>
            <Pressable
              disabled={openingChatId === item.id}
              onPress={(event) => {
                event.stopPropagation();
                void openMessage(item.id);
              }}
              style={[styles.iconAction, openingChatId === item.id && styles.iconActionDisabled]}
            >
              <Ionicons color={colors.cyan} name="chatbubble-ellipses" size={18} />
            </Pressable>
            <Pressable
              disabled={isCallingFriend}
              onPress={(event) => {
                event.stopPropagation();
                void callFriend(item);
              }}
              style={[styles.iconAction, styles.callAction, availability.callDisabled && styles.callActionUnavailable, isCallingFriend && styles.iconActionDisabled]}
            >
              <Ionicons color={availability.callDisabled ? colors.muted : colors.pink} name="call" size={18} />
            </Pressable>
          </GlassCard>
        </Pressable>
      </Swipeable>
    );
  }

  function renderRequest({ item }: { item: RequestItem }) {
    return (
      <GlassCard style={styles.requestCard}>
        <View style={styles.requestTop}>
          <UserAvatar
            avatarId={item.avatarId}
            avatarSourceType="friend-profile"
            currentUserId={currentUserId}
            renderedUserId={item.id}
            screen="friends"
            size={46}
            username={item.username}
          />
          <View style={styles.friendCopy}>
            <Text style={styles.title}>{item.username}</Text>
            <Text style={styles.muted}>Arkadaşlık isteği gönderdi.</Text>
          </View>
        </View>
        <View style={styles.requestActions}>
          <Pressable
            disabled={updatingRequestId === item.requestId}
            onPress={() => void accept(item)}
            style={[styles.requestButton, styles.acceptButton, compact && styles.requestButtonCompact, updatingRequestId === item.requestId && styles.requestButtonDisabled]}
          >
            <Text style={styles.requestButtonText}>{updatingRequestId === item.requestId ? 'İşleniyor...' : 'Kabul Et'}</Text>
          </Pressable>
          <Pressable
            disabled={updatingRequestId === item.requestId}
            onPress={() => void reject(item)}
            style={[styles.requestButton, styles.rejectButton, compact && styles.requestButtonCompact, updatingRequestId === item.requestId && styles.requestButtonDisabled]}
          >
            <Text style={styles.requestButtonText}>{updatingRequestId === item.requestId ? 'İşleniyor...' : 'Reddet'}</Text>
          </Pressable>
        </View>
      </GlassCard>
    );
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Mesaj, çağrı ve arkadaşlık istekleri" title="Arkadaşlar" />
      {loading ? <ActivityIndicator color={colors.cyan} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

      {data?.incomingRequests.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gelen istekler</Text>
          <FlatList data={data.incomingRequests} keyExtractor={(item) => item.requestId} renderItem={renderRequest} scrollEnabled={false} contentContainerStyle={styles.list} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Arkadaş listesi</Text>
        <FlatList
          data={data?.friends ?? []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Henüz arkadaşın yok. Eşleşmelerden sonra arkadaş ekleyebilirsin.</Text>}
          renderItem={renderFriend}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
        />
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    gap: spacing.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestCard: {
    gap: spacing.sm,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestButtonCompact: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  requestButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: colors.purple,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  rejectButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
  },
  requestButtonText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  statusRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
  },
  statusDotAvailable: {
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.8,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  statusDotSearching: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.72,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  statusDotBusy: {
    backgroundColor: colors.pink,
    shadowColor: colors.pink,
    shadowOpacity: 0.72,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  statusDotOffline: {
    backgroundColor: colors.dim,
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  muted: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 12,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconActionDisabled: {
    opacity: 0.55,
  },
  callAction: {
    borderColor: 'rgba(255, 79, 185, 0.34)',
    backgroundColor: 'rgba(255, 79, 185, 0.08)',
  },
  callActionUnavailable: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    opacity: 0.58,
  },
  removeAction: {
    width: 86,
    marginVertical: 2,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#D61E50',
  },
  removeActionText: {
    color: colors.text,
    fontWeight: '900',
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
  success: {
    color: colors.green,
    fontWeight: '800',
  },
});
