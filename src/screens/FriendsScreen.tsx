import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { createOrGetThread, FriendListData, listFriends, updateFriendship } from '../services/socialService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type FriendItem = FriendListData['friends'][number];
type RequestItem = FriendListData['incomingRequests'][number];

export function FriendsScreen({ navigation }: AppScreenProps<'Friends'>) {
  const [data, setData] = useState<FriendListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
    void loadFriends();
  }, []);

  async function openMessage(friendId: string) {
    const result = await createOrGetThread(friendId);

    if (result.error || !result.data) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Sohbet açılamadı.'));
      return;
    }

    navigation.navigate('Chat', { threadId: result.data.id, peerUserId: friendId });
  }

  async function accept(request: RequestItem) {
    const result = await updateFriendship(request.requestId, 'accepted');

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Arkadaşlık isteği güncellenemedi.'));
      return;
    }

    await loadFriends();
  }

  async function reject(request: RequestItem) {
    const result = await updateFriendship(request.requestId, 'blocked');

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Arkadaşlık isteği güncellenemedi.'));
      return;
    }

    await loadFriends();
  }

  function renderFriend({ item }: { item: FriendItem }) {
    return (
      <Pressable onPress={() => navigation.navigate('FriendProfile', { friendId: item.id })}>
        <GlassCard style={styles.friendCard}>
          <Avatar avatar={getAvatarById(item.avatarId)} size={54} />
          <View style={styles.friendCopy}>
            <Text style={styles.title}>{item.username}</Text>
            <Text style={styles.muted}>{item.isOnline ? 'Online' : 'Offline'} • Level {item.level} • {item.dermanScore.toFixed(1)}</Text>
          </View>
          <Pressable onPress={() => void openMessage(item.id)} style={styles.iconAction}>
            <Ionicons color={colors.cyan} name="chatbubble-ellipses" size={18} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('VoiceCall', { matchedUserId: item.id, matchReady: true })} style={styles.iconAction}>
            <Ionicons color={colors.pink} name="call" size={18} />
          </Pressable>
        </GlassCard>
      </Pressable>
    );
  }

  function renderRequest({ item }: { item: RequestItem }) {
    return (
      <GlassCard style={styles.requestCard}>
        <View style={styles.requestTop}>
          <Avatar avatar={getAvatarById(item.avatarId)} size={46} />
          <View style={styles.friendCopy}>
            <Text style={styles.title}>{item.username}</Text>
            <Text style={styles.muted}>Arkadaşlık isteği gönderdi.</Text>
          </View>
        </View>
        <View style={styles.requestActions}>
          <GradientButton compact onPress={() => void accept(item)} title="Kabul Et" />
          <GradientButton compact onPress={() => void reject(item)} title="Reddet" variant="ghost" />
        </View>
      </GlassCard>
    );
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Mesaj, çağrı ve arkadaşlık istekleri" title="Arkadaşlar" />
      {loading ? <ActivityIndicator color={colors.cyan} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

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
  friendCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
  muted: {
    color: colors.muted,
    marginTop: 3,
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
