import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { BadgePill } from '../components/BadgePill';
import { ChoiceChip } from '../components/ChoiceChip';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { avatarOptions, getAvatarById, giftBonusByPlan, planDurations, roleLabels, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { GiftItem } from '../types';

// TODO: Supabase Realtime / WebRTC sesli eşleşme bağlanacak
// TODO: RevenueCat / In-App Purchase bağlanacak
// TODO: Moderasyon ve şikayet paneli bağlanacak

type CallPhase = 'searching' | 'matched' | 'ended';

function getSearchBias(skipCount: number) {
  if (skipCount === 1) {
    return 0.2;
  }

  if (skipCount === 2) {
    return 0.45;
  }

  if (skipCount > 2) {
    return 0.7;
  }

  return 0;
}

export function MatchingScreen({ navigation }: AppScreenProps<'Matching'>) {
  const {
    activeRole,
    activeTopic,
    setActiveTopic,
    profile,
    skipCount,
    rewardMatch,
    penalizeMatch,
    registerSkip,
    userLevel,
  } = useAppState();
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [searchSession, setSearchSession] = useState(0);
  const [callPhase, setCallPhase] = useState<CallPhase>('searching');
  const [searchRemaining, setSearchRemaining] = useState(4);
  const isFocused = useIsFocused();

  const totalSeconds = planDurations[profile.plan];
  const bonusSeconds = giftBonusByPlan[profile.plan];

  const { remainingSeconds, addSeconds, setIsRunning } = useCountdownTimer({
    initialSeconds: totalSeconds,
    autoStart: false,
    onExpire: () => {
      setCallPhase('ended');
      setReviewVisible(true);
    },
  });

  const selfAvatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);
  const partnerAvatar = useMemo(() => {
    const visiblePool = avatarOptions.filter((avatar) => avatar.id !== profile.avatarId);
    const bias = getSearchBias(skipCount);
    const nextIndex = Math.min(visiblePool.length - 1, Math.round((visiblePool.length - 1) * (0.25 + bias)));
    return getAvatarById(visiblePool[nextIndex]?.id ?? visiblePool[0].id);
  }, [profile.avatarId, skipCount]);

  useEffect(() => {
    if (!isFocused) {
      setIsRunning(false);
      return;
    }

    setCallPhase('searching');
    setReviewVisible(false);
    setSearchRemaining(4);
    setIsRunning(false);

    const intervalId = setInterval(() => {
      setSearchRemaining((current) => {
        if (current <= 1) {
          clearInterval(intervalId);
          setCallPhase('matched');
          setIsRunning(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isFocused, searchSession, setIsRunning]);

  const restartSearch = () => {
    setSearchSession((current) => current + 1);
  };

  const handleGiftSelect = (gift: GiftItem) => {
    setGiftVisible(false);
    setSelectedGift(gift);
    setCelebrationVisible(true);
    setTimeout(() => {
      setCelebrationVisible(false);
      addSeconds(profile.plan === 'vip' ? 120 : bonusSeconds);
    }, 5000);
  };

  const handleEndCall = () => {
    setIsRunning(false);
    setCallPhase('ended');
    setReviewVisible(true);
  };

  const handlePass = () => {
    registerSkip();
    setPassModalVisible(true);
    restartSearch();
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable onPress={() => setSafetyModalVisible(true)} style={styles.reportPill}>
            <Text style={styles.reportText}>Şikayet et / Engelle</Text>
          </Pressable>
        }
        subtitle="Anonim sesli görüşme"
        title="Ses Odası Hazırlanıyor"
      />

      <View style={styles.body}>
        <GlassCard style={styles.selfCard} toned="strong">
          <Avatar avatar={selfAvatar} size={60} />
          <View style={styles.selfCopy}>
            <Text style={styles.selfRole}>{roleLabels[activeRole]}</Text>
            <Text style={styles.selfName}>{profile.username}</Text>
            <Text style={styles.selfMeta}>
              {profile.plan.toUpperCase()} • Level {userLevel} • {activeTopic}
            </Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.matchCard} toned="strong">
          {callPhase === 'searching' ? (
            <>
              <Text style={styles.sectionLabel}>Otomatik eşleştiriliyor...</Text>
              <CountdownRing caption="eşleşme aranıyor" remainingSeconds={searchRemaining} size={176} totalSeconds={4} tone="blue" />
              <Text style={styles.searchTitle}>Seni anlayacak biri aranıyor...</Text>
              <Text style={styles.searchMeta}>İstersen bir konu seç. Yeni üyeler yüksek puanlı aktif kullanıcılarla öncelikli eşleşir.</Text>
            </>
          ) : (
            <>
              <View style={styles.partnerHeader}>
                <Avatar avatar={partnerAvatar} size={92} />
                <View style={styles.partnerCopy}>
                  <Text style={styles.partnerRole}>{activeRole === 'derdim-var' ? 'Derman Olan' : 'Derdim Var'}</Text>
                  <Text style={styles.partnerName}>{partnerAvatar.name}</Text>
                  <BadgePill
                    badge={{
                      id: `${profile.plan}-badge`,
                      name: profile.plan === 'vip' ? 'VIP rozeti' : profile.plan === 'plus' ? 'Mavi şimşek' : 'Standart',
                      description: '',
                      icon: profile.plan === 'vip' ? 'star' : 'flash',
                      gradient: profile.plan === 'vip' ? ['#D8B24C', '#B97A13'] : ['#357CFF', '#7E54FF'],
                    }}
                  />
                </View>
              </View>

              <View style={styles.tagRow}>
                {topics.map((topic) => (
                  <ChoiceChip key={topic} label={topic} onPress={() => setActiveTopic(topic)} selected={activeTopic === topic} />
                ))}
              </View>

              <Text style={styles.connectedLabel}>Eşleşme bulundu, görüşme başladı.</Text>
              <CountdownRing caption="kalan süre" remainingSeconds={remainingSeconds} size={204} totalSeconds={totalSeconds} />
            </>
          )}

          {callPhase === 'matched' ? (
            <View style={styles.actionRow}>
              <Pressable onPress={() => setFriendModalVisible(true)} style={styles.actionPill}>
                <Ionicons color={colors.text} name="person-add" size={18} />
              </Pressable>
              <Pressable onPress={() => setSafetyModalVisible(true)} style={styles.actionPill}>
                <Ionicons color={colors.text} name="shield-checkmark" size={18} />
              </Pressable>
              <Pressable onPress={handlePass} style={[styles.actionPill, styles.passPill]}>
                <Ionicons color={colors.text} name="arrow-forward" size={18} />
                <Text style={styles.passText}>Pas geç</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.topicHint}>
            <Ionicons color={colors.cyan} name="sparkles" size={16} />
            <Text style={styles.topicHintText}>Konu etiketi: {activeTopic}</Text>
          </View>
        </GlassCard>

        {callPhase === 'matched' ? (
          <View style={styles.controls}>
            <Pressable
              disabled={callPhase !== 'matched'}
              onPress={() => setMicEnabled((current) => !current)}
              style={[styles.controlButton, micEnabled && styles.controlActive, callPhase !== 'matched' && styles.disabledControl]}
            >
              <Ionicons color={colors.text} name={micEnabled ? 'mic' : 'mic-off'} size={22} />
            </Pressable>

            <Pressable disabled={callPhase !== 'matched'} onPress={() => setGiftVisible(true)} style={[styles.controlButton, callPhase !== 'matched' && styles.disabledControl]}>
              <Ionicons color={colors.text} name="gift" size={22} />
            </Pressable>

            <Pressable onPress={handleEndCall} style={[styles.controlButton, styles.endButton]}>
              <Ionicons color={colors.text} name="call" size={22} style={styles.endIcon} />
            </Pressable>
          </View>
        ) : null}

        {callPhase === 'searching' ? <Text style={styles.helperText}>Bu ekran yazışma içermez; yalnızca ses odaklı demo akışı için tasarlandı.</Text> : null}
      </View>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={celebrationVisible} />

      <NoticeModal
        actions={[
          {
            label: 'Bana iyi geldi',
            onPress: () => {
              rewardMatch();
              setReviewVisible(false);
              navigation.navigate('Home');
            },
            variant: 'secondary',
          },
          {
            label: 'Uyum sağlamadı',
            onPress: () => {
              penalizeMatch();
              setReviewVisible(false);
              navigation.navigate('Home');
            },
            variant: 'ghost',
          },
          {
            label: 'Şikayet et',
            onPress: () => setSafetyModalVisible(true),
            variant: 'gold',
          },
        ]}
        message="Bu kişi sana iyi geldi mi?"
        title="Görüşmeyi değerlendir"
        visible={reviewVisible && callPhase === 'ended'}
      />

      <NoticeModal
        actions={[
          { label: 'Tamam', onPress: () => setFriendModalVisible(false), variant: 'secondary' },
        ]}
        message="Arkadaşlık isteği gönderildi."
        title="İstek gönderildi"
        visible={friendModalVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Tamam', onPress: () => setSafetyModalVisible(false), variant: 'secondary' },
        ]}
        message="Şikayet kaydı alındı. Moderasyon kuyruğuna eklendi."
        title="Şikayet / engelleme"
        visible={safetyModalVisible}
      />

      <NoticeModal
        actions={[
          {
            label: 'Tamam',
            onPress: () => setPassModalVisible(false),
            variant: 'secondary',
          },
        ]}
        message="Sık pas geçmek derman puanını düşürebilir."
        title="Pas geçildi"
        visible={passModalVisible}
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
    gap: spacing.sm,
  },
  selfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  selfCopy: {
    flex: 1,
    gap: 4,
  },
  selfRole: {
    color: colors.cyan,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  selfName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  selfMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  matchCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  searchTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  searchMeta: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  partnerHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partnerCopy: {
    flex: 1,
    gap: 6,
  },
  partnerRole: {
    color: colors.cyan,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  partnerName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  connectedLabel: {
    color: colors.green,
    fontWeight: '700',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  actionPill: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  passPill: {
    backgroundColor: 'rgba(255,124,156,0.12)',
    borderColor: 'rgba(255,124,156,0.26)',
  },
  passText: {
    color: colors.text,
    fontWeight: '700',
  },
  topicHint: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  topicHintText: {
    color: colors.muted,
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
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
  helperText: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
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
