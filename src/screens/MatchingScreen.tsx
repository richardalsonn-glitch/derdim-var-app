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
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { avatarOptions, getAvatarById, giftBonusByPlan, planDurations, roleLabels, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { GiftItem } from '../types';

type CallPhase = 'searching' | 'matched' | 'ended';

type RoomControlProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
};

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

function RoomControl({ icon, label, onPress, disabled = false, danger = false, active = false }: RoomControlProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.controlCard,
        active && styles.controlCardActive,
        danger && styles.controlCardDanger,
        disabled && styles.controlCardDisabled,
      ]}
    >
      <View style={[styles.controlIconWrap, active && styles.controlIconWrapActive, danger && styles.controlIconWrapDanger]}>
        <Ionicons color={colors.text} name={icon} size={20} />
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
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
  const isMatched = callPhase === 'matched';

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
    setSelectedGift(null);
    setCelebrationVisible(false);
    setMicEnabled(true);
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
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        subtitle={isMatched ? 'Anonim ses odası başladı' : 'Seni anlayacak biri aranıyor'}
        title={isMatched ? 'Ses Odası' : 'Eşleşme Aranıyor'}
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
          {!isMatched ? (
            <>
              <Text style={styles.sectionLabel}>Otomatik eşleştiriliyor</Text>
              <CountdownRing caption="eşleşme aranıyor" remainingSeconds={searchRemaining} size={176} totalSeconds={4} tone="blue" />
              <Text style={styles.searchTitle}>Seni anlayacak biri aranıyor...</Text>
              <Text style={styles.searchMeta}>İstersen bir konu seç. Kullanıcı bulunduğu anda aynı ekranda ses odası başlayacak.</Text>
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
                      name: profile.plan === 'vip' ? 'VIP rozeti' : profile.plan === 'plus' ? 'Mavi Şimşek' : 'Standart',
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
              <CountdownRing
                caption="kalan süre"
                remainingSeconds={remainingSeconds}
                size={204}
                totalSeconds={Math.max(totalSeconds, remainingSeconds)}
              />
            </>
          )}

          <View style={styles.topicHint}>
            <Ionicons color={colors.cyan} name="sparkles" size={16} />
            <Text style={styles.topicHintText}>
              {isMatched
                ? `Konu etiketi: ${activeTopic} • Hediye seçimi görüşmede süre bonusu verir.`
                : `Konu etiketi: ${activeTopic} • Hediye ikonu eşleşme başlayınca aktifleşir.`}
            </Text>
          </View>
        </GlassCard>

        <View style={styles.controlsGrid}>
          <RoomControl
            active={isMatched && micEnabled}
            disabled={!isMatched}
            icon={isMatched && !micEnabled ? 'mic-off' : 'mic'}
            label="Mikrofon"
            onPress={() => setMicEnabled((current) => !current)}
          />
          <RoomControl disabled={!isMatched} icon="gift" label="Hediye" onPress={() => setGiftVisible(true)} />
          <RoomControl danger icon="call" label="Bitir" onPress={isMatched ? handleEndCall : () => navigation.goBack()} />
          <RoomControl disabled={!isMatched} icon="play-skip-forward" label="Pas Geç" onPress={handlePass} />
          <RoomControl disabled={!isMatched} icon="person-add" label="Arkadaş Ekle" onPress={() => setFriendModalVisible(true)} />
          <RoomControl icon="shield-checkmark" label="Şikayet Et" onPress={() => setSafetyModalVisible(true)} />
        </View>
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
        actions={[{ label: 'Tamam', onPress: () => setFriendModalVisible(false), variant: 'secondary' }]}
        message="Arkadaşlık isteği gönderildi."
        title="İstek gönderildi"
        visible={friendModalVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setSafetyModalVisible(false), variant: 'secondary' }]}
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
    gap: spacing.md,
  },
  body: {
    gap: spacing.md,
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
    lineHeight: 18,
  },
  controlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  controlCard: {
    width: '31%',
    minHeight: 106,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  controlCardActive: {
    backgroundColor: 'rgba(69, 224, 255, 0.14)',
    borderColor: 'rgba(69, 224, 255, 0.44)',
  },
  controlCardDanger: {
    backgroundColor: 'rgba(255,124,156,0.12)',
    borderColor: 'rgba(255,124,156,0.3)',
  },
  controlCardDisabled: {
    opacity: 0.55,
  },
  controlIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  controlIconWrapActive: {
    backgroundColor: 'rgba(69, 224, 255, 0.2)',
  },
  controlIconWrapDanger: {
    backgroundColor: 'rgba(255,124,156,0.16)',
  },
  controlLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
