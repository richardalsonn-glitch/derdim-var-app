import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, giftBonusByPlan, guestProfile, planDurations } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { GiftItem } from '../types';

export function ChatScreen({ navigation }: AppScreenProps<'Chat'>) {
  const { activeRole, activeTopic, profile } = useAppState();
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [expiredVisible, setExpiredVisible] = useState(false);
  const partnerAvatar = useMemo(() => getAvatarById(guestProfile.avatarId), []);
  const totalSeconds = planDurations[profile.plan];
  const bonusSeconds = giftBonusByPlan[profile.plan];
  const { remainingSeconds, addSeconds, setIsRunning } = useCountdownTimer({
    initialSeconds: totalSeconds,
    onExpire: () => {
      setExpiredVisible(true);
      setReviewVisible(true);
    },
  });

  const openGiftFlow = () => {
    setGiftVisible(true);
  };

  const handleGiftSelect = (gift: GiftItem) => {
    setGiftVisible(false);
    setSelectedGift(gift);
    setCelebrationVisible(true);
    setExpiredVisible(false);
    setTimeout(() => {
      setCelebrationVisible(false);
      addSeconds(bonusSeconds);
    }, 5000);
  };

  const endCall = () => {
    setIsRunning(false);
    setReviewVisible(true);
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Anonim sesli görüşme" title="Ses Odası" />

      <View style={styles.body}>
        <GlassCard style={styles.callCard} toned="strong">
          <Avatar avatar={partnerAvatar} size={118} />
          <View style={styles.headline}>
            <Text style={styles.role}>{activeRole === 'derdim-var' ? 'Derman Olan' : 'Derdim Var'}</Text>
            <Text style={styles.partnerName}>{guestProfile.username}</Text>
            <View style={styles.topicPill}>
              <Text style={styles.topicText}>{activeTopic}</Text>
            </View>
          </View>

          <CountdownRing remainingSeconds={remainingSeconds} size={248} totalSeconds={Math.max(totalSeconds, remainingSeconds)} />

          <View style={styles.controls}>
            <Pressable onPress={() => setMicEnabled((current) => !current)} style={[styles.controlButton, micEnabled && styles.controlActive]}>
              <Ionicons color={colors.text} name={micEnabled ? 'mic' : 'mic-off'} size={22} />
            </Pressable>

            <Pressable onPress={openGiftFlow} style={styles.controlButton}>
              <Ionicons color={colors.text} name="gift" size={22} />
            </Pressable>

            <Pressable onPress={endCall} style={[styles.controlButton, styles.endButton]}>
              <Ionicons color={colors.text} name="call" size={22} style={styles.endIcon} />
            </Pressable>
          </View>

          <GlassCard style={styles.supportCard}>
            <Text style={styles.supportTitle}>Konu etiketi</Text>
            <Text style={styles.supportValue}>{activeTopic}</Text>
            <Text style={styles.supportMeta}>
              {profile.plan === 'vip' ? 'VIP görüşme süresi aktif. Hediye sonrası +2 dk eklenir.' : 'Hediye gönderildiğinde görüşmeye +1 dk eklenir.'}
            </Text>
          </GlassCard>
        </GlassCard>

        {reviewVisible ? (
          <View style={styles.feedbackRow}>
            <GradientButton onPress={() => navigation.navigate('Home')} title="Bana iyi geldi" variant="secondary" />
            <GradientButton onPress={() => navigation.navigate('Home')} title="Uyum sağlamadı" variant="ghost" />
          </View>
        ) : (
          <Text style={styles.helperText}>Yazışma yok. Bu alan yalnızca sesli görüşme deneyimi için tasarlandı.</Text>
        )}
      </View>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={celebrationVisible} />

      <Modal animationType="fade" transparent visible={expiredVisible}>
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.expiredCard}>
            <Text style={styles.expiredTitle}>Süre doldu</Text>
            <Text style={styles.expiredText}>Devam etmek için hediye gönder veya paketini yükselt.</Text>
            <GradientButton onPress={openGiftFlow} title="Hediye gönder" />
            <GradientButton onPress={() => navigation.navigate('Packages')} title="Paketi yükselt" variant="gold" />
          </GlassCard>
        </View>
      </Modal>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  callCard: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headline: {
    alignItems: 'center',
    gap: 8,
  },
  role: {
    color: colors.cyan,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  partnerName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  topicPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicText: {
    color: colors.text,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  controlActive: {
    backgroundColor: 'rgba(69, 224, 255, 0.14)',
    borderColor: 'rgba(69, 224, 255, 0.44)',
  },
  endButton: {
    backgroundColor: 'rgba(255,124,156,0.18)',
    borderColor: 'rgba(255,124,156,0.32)',
  },
  endIcon: {
    transform: [{ rotate: '135deg' }],
  },
  supportCard: {
    width: '100%',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  supportTitle: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  supportValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  supportMeta: {
    color: colors.muted,
    lineHeight: 19,
  },
  helperText: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  feedbackRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 6, 16, 0.74)',
    padding: spacing.lg,
  },
  expiredCard: {
    width: '100%',
    gap: spacing.md,
  },
  expiredTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  expiredText: {
    color: colors.muted,
    lineHeight: 21,
  },
});
