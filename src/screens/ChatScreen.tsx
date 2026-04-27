import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, giftBonusByPlan, guestProfile, planDurations } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { GiftItem } from '../types';

// TODO: Supabase Realtime / WebRTC sesli eslesme baglanacak
// TODO: RevenueCat / In-App Purchase baglanacak
// TODO: Moderasyon ve sikayet paneli baglanacak

type CallPhase = 'connecting' | 'connected' | 'ended';

export function ChatScreen({ navigation }: AppScreenProps<'Chat'>) {
  const { activeRole, activeTopic, profile } = useAppState();
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [expiredVisible, setExpiredVisible] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [callPhase, setCallPhase] = useState<CallPhase>('connecting');
  const partnerAvatar = useMemo(() => getAvatarById(guestProfile.avatarId), []);
  const totalSeconds = planDurations[profile.plan];
  const bonusSeconds = giftBonusByPlan[profile.plan];
  const { remainingSeconds, addSeconds, setIsRunning } = useCountdownTimer({
    initialSeconds: totalSeconds,
    autoStart: false,
    onExpire: () => {
      setExpiredVisible(true);
      setReviewVisible(true);
      setCallPhase('ended');
    },
  });

  useEffect(() => {
    const timerId = setTimeout(() => {
      setCallPhase('connected');
      setIsRunning(true);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [setIsRunning]);

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

  const openReview = () => {
    setIsRunning(false);
    setReviewVisible(true);
    setCallPhase('ended');
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => setSafetyVisible(true)} style={styles.reportPill}>
            <Text style={styles.reportText}>Şikayet et / Engelle</Text>
          </Pressable>
        }
        subtitle="Anonim sesli görüşme"
        title="Ses Odası"
      />

      <View style={styles.body}>
        <GlassCard style={styles.callCard} toned="strong">
          <Avatar avatar={partnerAvatar} size={118} />
          <View style={styles.headline}>
            <Text style={styles.role}>{activeRole === 'derdim-var' ? 'Derman Olan' : 'Derdim Var'}</Text>
            <Text style={styles.partnerName}>{guestProfile.username}</Text>
            <View style={styles.topicPill}>
              <Text style={styles.topicText}>{activeTopic}</Text>
            </View>
            <Text style={[styles.statusText, callPhase === 'connected' && styles.statusConnected]}>
              {callPhase === 'connecting' ? 'Bağlanıyor...' : callPhase === 'connected' ? 'Bağlandı' : 'Görüşme sonlandı'}
            </Text>
          </View>

          <CountdownRing remainingSeconds={remainingSeconds} size={248} totalSeconds={Math.max(totalSeconds, remainingSeconds)} />

          <View style={styles.controls}>
            <Pressable
              disabled={callPhase !== 'connected'}
              onPress={() => setMicEnabled((current) => !current)}
              style={[styles.controlButton, micEnabled && styles.controlActive, callPhase !== 'connected' && styles.disabledControl]}
            >
              <Ionicons color={colors.text} name={micEnabled ? 'mic' : 'mic-off'} size={22} />
            </Pressable>

            <Pressable disabled={callPhase !== 'connected'} onPress={openGiftFlow} style={[styles.controlButton, callPhase !== 'connected' && styles.disabledControl]}>
              <Ionicons color={colors.text} name="gift" size={22} />
            </Pressable>

            <Pressable onPress={openReview} style={[styles.controlButton, styles.endButton]}>
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
          <Text style={styles.helperText}>Bu alan yazışma içermez; yalnızca demo sesli görüşme hissi için tasarlandı.</Text>
        )}
      </View>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={celebrationVisible} />

      <NoticeModal
        actions={[
          { label: 'Hediye gönder', onPress: openGiftFlow },
          { label: 'Paketi yükselt', onPress: () => navigation.navigate('Packages'), variant: 'gold' },
        ]}
        message="Süre doldu. Devam etmek için hediye gönder veya paketini yükselt."
        title="Süre doldu"
        visible={expiredVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Bana iyi geldi', onPress: () => navigation.navigate('Home'), variant: 'secondary' },
          { label: 'Uyum sağlamadı', onPress: () => navigation.navigate('Home'), variant: 'ghost' },
          { label: 'Şikayet et', onPress: () => navigation.navigate('Home'), variant: 'gold' },
        ]}
        message="Bu kişi sana iyi geldi mi?"
        title="Görüşmeyi değerlendir"
        visible={reviewVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Şikayet et', onPress: () => navigation.navigate('Home'), variant: 'gold' },
          { label: 'Engelle', onPress: () => navigation.navigate('Home'), variant: 'secondary' },
          { label: 'Vazgeç', onPress: () => setSafetyVisible(false), variant: 'ghost' },
        ]}
        message="Güvenlik ekibi ileride moderasyon paneliyle desteklenecek. Şimdilik bu akış mock olarak çalışır."
        title="Güvenlik seçenekleri"
        visible={safetyVisible}
      />
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
  statusText: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  statusConnected: {
    color: colors.green,
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
  disabledControl: {
    opacity: 0.55,
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
