import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { isLiveKitEnabled } from '../config/features';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, silentListeners } from '../data/mockData';
import { requestMicrophonePermission } from '../services/permissionsService';
import { AppScreenProps } from '../navigation/types';

export function SilentScreamScreen({ navigation }: AppScreenProps<'SilentScream'>) {
  const { setActiveRole } = useAppState();
  const [voteMessage, setVoteMessage] = useState('%30 evet olursa +1 dakika uzar.');
  const [expiredVisible, setExpiredVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const { remainingSeconds, addSeconds } = useCountdownTimer({
    initialSeconds: 180,
    onExpire: () => setExpiredVisible(true),
  });

  const handleExtendVote = () => {
    setVoteMessage('Oylama simülasyonu başladı... %34 evet göründü.');
    setTimeout(() => {
      setVoteMessage('Yeterli destek geldi. Süreye +1 dakika eklendi.');
      addSeconds(60);
    }, 1400);
  };

  const handleMicTake = async () => {
    if (isLiveKitEnabled) {
      const result = await requestMicrophonePermission();

      if (!result.granted) {
        setPermissionModalVisible(true);
        return;
      }
    }

    setActiveRole('derdim-var');
    navigation.navigate('Matching');
  };

  return (
    <PremiumScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => setSafetyVisible(true)} style={styles.reportPill}>
            <Text style={styles.reportText}>Şikayet et / Engelle</Text>
          </Pressable>
        }
        subtitle="1 anlatıcı • en fazla 10 dinleyici"
        title="Sessiz Çığlık"
      />

      <GlassCard style={styles.storyCard} toned="strong">
        <Text style={styles.storyTag}>Şu an anlatan kişi</Text>
        <Avatar avatar={getAvatarById('f-3')} size={108} />
        <Text style={styles.storyTitle}>“Çok yalnızım...”</Text>
        <Text style={styles.storyText}>Oda sessiz. Dinleyicilerin mikrofonları kapalı ve sıra tek kişide.</Text>
      </GlassCard>

      <View style={styles.timerWrap}>
        <CountdownRing remainingSeconds={remainingSeconds} size={220} totalSeconds={180} />
      </View>

      <GlassCard style={styles.listenersCard}>
        <View style={styles.listenersHeader}>
          <Text style={styles.listenersTitle}>Dinleyenler</Text>
          <Text style={styles.listenersMeta}>8 / 10 kişi</Text>
        </View>
        <View style={styles.listenersGrid}>
          {silentListeners.map((listener) => (
            <View key={listener.id} style={styles.listenerItem}>
              <Avatar avatar={getAvatarById(listener.avatarId)} size={54} />
              <View style={styles.muteBadge}>
                <Ionicons color={colors.text} name="mic-off" size={12} />
              </View>
            </View>
          ))}
          {Array.from({ length: 2 }).map((_, index) => (
            <View key={`empty-${index}`} style={styles.emptySlot}>
              <Ionicons color={colors.dim} name="person-add" size={16} />
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.voteCard}>
        <Text style={styles.voteTitle}>Süre uzatma oylaması</Text>
        <Text style={styles.voteText}>{voteMessage}</Text>
      </GlassCard>

      <View style={styles.actions}>
        <GradientButton icon="thumbs-up" onPress={handleExtendVote} title="Süre uzasın" variant="secondary" />
        <GradientButton icon="mic" onPress={handleMicTake} title="Mikrofona geç" />
      </View>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setExpiredVisible(false), variant: 'secondary' }]}
        message="Süre doldu. Devam etmek için hediye gönder veya paketini yükselt."
        title="Süre doldu"
        visible={expiredVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Tekrar Dene', onPress: handleMicTake },
          { label: 'Şimdilik Vazgeç', onPress: () => setPermissionModalVisible(false), variant: 'ghost' },
        ]}
        message="Sesli görüşme için mikrofon izni gerekli."
        title="Mikrofon izni gerekli"
        visible={permissionModalVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Şikayet et', onPress: () => navigation.navigate('Home'), variant: 'gold' },
          { label: 'Engelle', onPress: () => navigation.navigate('Home'), variant: 'secondary' },
          { label: 'Vazgeç', onPress: () => setSafetyVisible(false), variant: 'ghost' },
        ]}
        message="Bu alan anonim sosyal destek içindir. Moderasyon akışı şimdilik demo modunda çalışır."
        title="Güvenlik seçenekleri"
        visible={safetyVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  storyCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  storyTag: {
    color: colors.cyan,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  storyTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  storyText: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  timerWrap: {
    alignItems: 'center',
  },
  listenersCard: {
    gap: spacing.md,
  },
  listenersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listenersTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  listenersMeta: {
    color: colors.muted,
  },
  listenersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  listenerItem: {
    width: 58,
    height: 58,
  },
  muteBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  emptySlot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  voteCard: {
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  voteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  voteText: {
    color: colors.muted,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
  reportPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reportText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
