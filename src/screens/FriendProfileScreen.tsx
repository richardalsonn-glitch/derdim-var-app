import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { defaultProfile, getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { createOrGetThread, FriendListData, listFriends } from '../services/socialService';

export function FriendProfileScreen({ navigation, route }: AppScreenProps<'FriendProfile'>) {
  const [friend, setFriend] = useState<FriendListData['friends'][number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeText, setNoticeText] = useState('');

  useEffect(() => {
    let mounted = true;
    void listFriends().then((result) => {
      if (!mounted) {
        return;
      }

      setFriend(result.data?.friends.find((item) => item.id === route.params.friendId) ?? {
        id: route.params.friendId,
        username: 'Anonim',
        avatarId: defaultProfile.avatarId,
        plan: 'free',
        isOnline: false,
        level: 1,
        dermanScore: 0,
      });
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [route.params.friendId]);

  async function openMessage() {
    if (!friend) {
      return;
    }

    const result = await createOrGetThread(friend.id);

    if (result.data) {
      navigation.navigate('Chat', { threadId: result.data.id, peerUserId: friend.id });
    }
  }

  function showStub(message: string) {
    setNoticeText(message);
    setNoticeVisible(true);
  }

  if (loading || !friend) {
    return (
      <PremiumScreen contentStyle={styles.center} scroll={false}>
        <ActivityIndicator color={colors.cyan} />
      </PremiumScreen>
    );
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle={friend.isOnline ? 'Online' : 'Offline'} title="Arkadaş Profili" />
      <GlassCard style={styles.hero} toned="strong">
        <Avatar avatar={getAvatarById(friend.avatarId)} size={92} />
        <Text style={styles.name}>{friend.username}</Text>
        <Text style={styles.muted}>{friend.plan.toUpperCase()} • Level {friend.level} • Derman {friend.dermanScore.toFixed(1)}</Text>
      </GlassCard>

      <View style={styles.actions}>
        <GradientButton icon="chatbubble-ellipses" onPress={() => void openMessage()} title="Mesaj Yaz" />
        <GradientButton icon="call" onPress={() => navigation.navigate('VoiceCall', { matchedUserId: friend.id, matchReady: true })} title="Ara" variant="secondary" />
        <GradientButton onPress={() => showStub('Arkadaşlıktan çıkarma kaydı alındı.')} title="Arkadaşlıktan Çıkar" variant="ghost" />
        <GradientButton onPress={() => showStub('Engelleme ve şikayet kaydı alındı.')} title="Engelle / Şikayet Et" variant="ghost" />
      </View>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setNoticeVisible(false), variant: 'secondary' }]}
        message={noticeText}
        title="Güvenlik kaydı"
        visible={noticeVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  muted: {
    color: colors.muted,
  },
  actions: {
    gap: spacing.sm,
  },
});
