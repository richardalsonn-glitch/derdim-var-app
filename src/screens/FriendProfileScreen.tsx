import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { UserAvatar } from '../components/UserAvatar';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';
import { useFriendCall } from '../providers/FriendCallProvider';
import {
  canStartFriendCall,
  createOrGetThread,
  FriendAvailabilityStatus,
  FriendListData,
  getFriendAvailabilityMessage,
  listFriends,
} from '../services/socialService';
import { submitSupportReport } from '../services/supportService';
import { getCurrentUser } from '../services/authService';

function getProfileAvailabilityMeta(status: FriendAvailabilityStatus | undefined) {
  switch (status) {
    case 'available':
      return {
        label: 'Müsait',
        dotStyle: styles.statusDotAvailable,
        canCall: true,
      };
    case 'searching':
      return {
        label: 'Eşleşme aranıyor',
        dotStyle: styles.statusDotSearching,
        canCall: false,
      };
    case 'busy':
      return {
        label: 'Başka görüşmede',
        dotStyle: styles.statusDotBusy,
        canCall: false,
      };
    case 'offline':
    default:
      return {
        label: 'Çevrim dışı',
        dotStyle: styles.statusDotOffline,
        canCall: false,
      };
  }
}

export function FriendProfileScreen({ navigation, route }: AppScreenProps<'FriendProfile'>) {
  const [friend, setFriend] = useState<FriendListData['friends'][number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeText, setNoticeText] = useState('');
  const [callLoading, setCallLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { isCallingFriend, startFriendCall } = useFriendCall();

  useEffect(() => {
    let active = true;

    void getCurrentUser().then((result) => {
      if (active) {
        setCurrentUserId(result.data?.id ?? null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void listFriends().then((result) => {
      if (!mounted) {
        return;
      }

      setFriend(result.data?.friends.find((item) => item.id === route.params.friendId) ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [route.params.friendId]);

  function showNotice(message: string) {
    setNoticeText(message);
    setNoticeVisible(true);
  }

  async function openMessage() {
    if (!friend) {
      return;
    }

    const result = await createOrGetThread(friend.id);

    if (result.data) {
      navigation.navigate('Chat', { threadId: result.data.id, peerUserId: friend.id });
    } else {
      showNotice(result.error?.message ?? 'Sohbet açılamadı. Lütfen tekrar deneyin.');
    }
  }

  async function callFriend() {
    if (!friend || isCallingFriend || callLoading) {
      return;
    }

    if (!canStartFriendCall(friend.availabilityStatus)) {
      showNotice(getFriendAvailabilityMessage(friend.availabilityStatus));
      return;
    }

    setCallLoading(true);
    const result = await startFriendCall(friend);
    setCallLoading(false);

    if (!result.ok) {
      showNotice(result.message ?? 'Çağrı başlatılamadı. Lütfen tekrar deneyin.');
    }
  }

  async function reportFriend() {
    if (!friend) {
      return;
    }

    const result = await submitSupportReport({
      type: 'report',
      reportedUserId: friend.id,
      message: `Arkadaş profilinden şikayet: ${friend.username}`,
    });

    showNotice(result.error ? result.error.message : 'Şikayetin alındı. En kısa sürede inceleyeceğiz.');
  }

  if (loading) {
    return (
      <PremiumScreen contentStyle={styles.center} scroll={false}>
        <ActivityIndicator color={colors.cyan} />
      </PremiumScreen>
    );
  }

  if (!friend) {
    return (
      <PremiumScreen contentStyle={styles.content}>
        <ScreenHeader onBack={() => navigation.goBack()} subtitle="Profil" title="Arkadaş Profili" />
        <GlassCard toned="strong">
          <Text style={styles.muted}>Arkadaş profili bulunamadı.</Text>
        </GlassCard>
      </PremiumScreen>
    );
  }

  const availability = getProfileAvailabilityMeta(friend.availabilityStatus);

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle={availability.label} title="Arkadaş Profili" />
      <GlassCard style={styles.hero} toned="strong">
        <UserAvatar
          avatarId={friend.avatarId}
          avatarSourceType="friend-profile"
          currentUserId={currentUserId}
          renderedUserId={friend.id}
          screen="friend-profile"
          size={92}
          username={friend.username}
        />
        <Text style={styles.name}>{friend.username}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, availability.dotStyle]} />
          <Text style={styles.statusText}>{availability.label}</Text>
        </View>
        <Text style={styles.muted}>{friend.plan.toUpperCase()} â€¢ Level {friend.level} â€¢ Derman {friend.dermanScore.toFixed(1)}</Text>
      </GlassCard>

      <View style={styles.actions}>
        <GradientButton icon="chatbubble-ellipses" onPress={() => void openMessage()} title="Mesaj Yaz" />
        <GradientButton
          disabled={isCallingFriend || callLoading}
          icon="call"
          muted={!availability.canCall}
          onPress={() => void callFriend()}
          title={callLoading ? 'Aranıyor' : 'Ara'}
          variant="secondary"
        />
        <GradientButton onPress={() => showNotice('Arkadaşlıktan çıkarma işlemi yakında arkadaş yönetimi paneline bağlanacak.')} title="Arkadaşlıktan Çıkar" variant="ghost" />
        <GradientButton onPress={() => void reportFriend()} title="Engelle / Şikayet Et" variant="ghost" />
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusDotAvailable: {
    backgroundColor: colors.green,
  },
  statusDotSearching: {
    backgroundColor: colors.cyan,
  },
  statusDotBusy: {
    backgroundColor: colors.pink,
  },
  statusDotOffline: {
    backgroundColor: colors.muted,
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
  },
});
