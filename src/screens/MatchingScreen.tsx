import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { Gender, GiftItem, MembershipPlan, TopicTag } from '../types';

type CallPhase = 'searching' | 'matched';

type MatchPartner = {
  id: string;
  username: string;
  avatarId: string;
  gender: Gender;
  plan: MembershipPlan;
  dermanScore: number;
  level: number;
};

type TopicChipProps = {
  label: TopicTag;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
};

type AudioControlProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
};

const SEARCH_SECONDS = 4;
const CALL_SECONDS = 60;

const topicIcons: Record<TopicTag, keyof typeof Ionicons.glyphMap> = {
  İlişki: 'heart',
  İş: 'briefcase',
  Para: 'cash',
  Sağlık: 'medical',
  Genel: 'ellipsis-horizontal',
};

const matchPartners: MatchPartner[] = [
  { id: 'luna', username: 'Luna_24', avatarId: 'f-2', gender: 'Kadın', plan: 'vip', dermanScore: 4.8, level: 3 },
  { id: 'atlas', username: 'Atlas_28', avatarId: 'm-1', gender: 'Erkek', plan: 'plus', dermanScore: 4.6, level: 2 },
  { id: 'nova', username: 'Nova_23', avatarId: 'f-1', gender: 'Kadın', plan: 'plus', dermanScore: 4.7, level: 3 },
  { id: 'eren', username: 'Eren_31', avatarId: 'm-2', gender: 'Erkek', plan: 'vip', dermanScore: 4.9, level: 4 },
];

function TopicChip({ label, icon, selected, onPress }: TopicChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.topicChip, selected && styles.topicChipSelected]}>
      <Ionicons color={selected ? colors.text : colors.goldSoft} name={icon} size={18} />
      <Text style={[styles.topicChipLabel, selected && styles.topicChipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function AudioControl({ icon, label, active = false, onPress }: AudioControlProps) {
  return (
    <Pressable onPress={onPress} style={styles.audioControl}>
      <View style={[styles.audioControlCircle, active && styles.audioControlCircleActive]}>
        <Ionicons color={colors.text} name={icon} size={26} />
      </View>
      <Text style={styles.audioControlLabel}>{label}</Text>
      <View style={[styles.audioControlDot, active && styles.audioControlDotActive]} />
    </Pressable>
  );
}

function getPlanBadgeCopy(plan: MembershipPlan) {
  if (plan === 'vip') {
    return {
      label: 'Altın Taç',
      icon: 'trophy' as const,
      gradient: ['#6F4800', '#D7A648'] as const,
    };
  }

  return {
    label: 'Mavi Şimşek',
    icon: 'flash' as const,
    gradient: ['#357CFF', '#6E59FF'] as const,
  };
}

export function MatchingScreen({ navigation }: AppScreenProps<'Matching'>) {
  const {
    activeTopic,
    setActiveTopic,
    profile,
    skipCount,
    rewardMatch,
    penalizeMatch,
    registerSkip,
    useDailyAppreciation,
  } = useAppState();
  const [matchSession, setMatchSession] = useState(0);
  const [callPhase, setCallPhase] = useState<CallPhase>('searching');
  const [searchRemaining, setSearchRemaining] = useState(SEARCH_SECONDS);
  const [giftVisible, setGiftVisible] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [appreciationVisible, setAppreciationVisible] = useState(false);
  const [appreciationLimitVisible, setAppreciationLimitVisible] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [partnerMuted, setPartnerMuted] = useState(false);
  const [partnerScore, setPartnerScore] = useState(0);
  const [currentPartner, setCurrentPartner] = useState<MatchPartner>(matchPartners[0]);
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const ringSize = Math.min(width - 28, 360);
  const giftBonusSeconds = profile.plan === 'vip' ? 600 : 300;
  const isMatched = callPhase === 'matched';
  const partnerAvatar = useMemo(() => getAvatarById(currentPartner.avatarId), [currentPartner.avatarId]);
  const partnerBadge = getPlanBadgeCopy(currentPartner.plan);

  const { remainingSeconds, addSeconds, reset, setIsRunning } = useCountdownTimer({
    initialSeconds: CALL_SECONDS,
    autoStart: false,
    onExpire: () => {
      handleConversationFinished();
    },
  });

  function pickPartner(nextSession: number) {
    const offset = (nextSession + skipCount) % matchPartners.length;
    return matchPartners[offset];
  }

  function beginSearch(nextSession: number) {
    const nextPartner = pickPartner(nextSession);
    setCurrentPartner(nextPartner);
    setPartnerScore(nextPartner.dermanScore);
    setCallPhase('searching');
    setSearchRemaining(SEARCH_SECONDS);
    setGiftVisible(false);
    setCelebrationVisible(false);
    setSelectedGift(null);
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPartnerMuted(false);
    setIsRunning(false);
    reset(CALL_SECONDS, false);
  }

  useEffect(() => {
    if (!isFocused) {
      setIsRunning(false);
      return;
    }

    beginSearch(matchSession);
  }, [isFocused, matchSession, skipCount]);

  useEffect(() => {
    if (!isFocused || callPhase !== 'searching') {
      return;
    }

    const intervalId = setInterval(() => {
      setSearchRemaining((current) => {
        if (current <= 1) {
          clearInterval(intervalId);
          setCallPhase('matched');
          reset(CALL_SECONDS, true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [callPhase, isFocused, reset]);

  function restartMatching() {
    setMatchSession((current) => current + 1);
  }

  function handleConversationFinished() {
    setIsRunning(false);

    if (autoContinue) {
      restartMatching();
      return;
    }

    setReviewVisible(true);
  }

  function handleGiftSelect(gift: GiftItem) {
    setGiftVisible(false);
    setSelectedGift(gift);
    setCelebrationVisible(true);
    setTimeout(() => {
      setCelebrationVisible(false);
      addSeconds(giftBonusSeconds);
    }, 10000);
  }

  function handleAppreciation() {
    const result = useDailyAppreciation();

    if (!result.allowed) {
      setAppreciationLimitVisible(true);
      return;
    }

    setPartnerScore((current) => Math.min(5, Number((current + 0.1).toFixed(1))));
    addSeconds(30);
    setAppreciationVisible(true);
  }

  function handlePass() {
    registerSkip();
    restartMatching();
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={28} />
        </Pressable>

        <View style={styles.headerCopy}>
          <View style={styles.headerSignal}>
            <Ionicons color={colors.pink} name="pulse" size={28} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{isMatched ? 'GÖRÜŞME BAŞLADI' : 'EŞLEŞTİRME AŞAMASI'}</Text>
            <Text style={styles.headerSubtitle}>{isMatched ? 'Karşındaki kullanıcı seni dinliyor...' : 'Seni anlayacak biri aranıyor...'}</Text>
          </View>
        </View>

        <Pressable onPress={() => setSafetyModalVisible(true)} style={styles.reportButton}>
          <Ionicons color={colors.danger} name="warning" size={18} />
          <Text style={styles.reportButtonText}>Engelle / Şikayet Et</Text>
        </Pressable>
      </View>

      <GlassCard style={styles.profileCard} toned="strong">
        <View style={styles.profileLeft}>
          <View style={styles.avatarWrap}>
            <Avatar avatar={partnerAvatar} size={126} />
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.partnerInfo}>
            <View style={styles.partnerNameRow}>
              <Text style={styles.partnerName}>{currentPartner.username}</Text>
              <Ionicons color={currentPartner.gender === 'Kadın' ? colors.pink : colors.cyan} name={currentPartner.gender === 'Kadın' ? 'female' : 'male'} size={20} />
            </View>

            <LinearGradient colors={[...partnerBadge.gradient]} style={styles.partnerBadge}>
              <Ionicons color={colors.text} name={partnerBadge.icon} size={14} />
              <Text style={styles.partnerBadgeText}>{partnerBadge.label}</Text>
            </LinearGradient>

            <View style={styles.partnerStatsRow}>
              <View style={styles.partnerStat}>
                <Ionicons color={colors.goldSoft} name="star" size={18} />
                <Text style={styles.partnerStatText}>{partnerScore.toFixed(1)}</Text>
              </View>
              <View style={styles.partnerDivider} />
              <View style={styles.partnerStat}>
                <Ionicons color={colors.cyan} name="sparkles" size={18} />
                <Text style={styles.partnerStatText}>Level {currentPartner.level}</Text>
              </View>
            </View>

            <View style={styles.statusPill}>
              <Ionicons color={colors.pink} name="heart-half" size={16} />
              <Text style={styles.statusPillText}>{partnerMuted ? 'Sessizde' : 'Derman Oluyor'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileActions}>
          <Pressable onPress={() => setFriendModalVisible(true)} style={styles.profileActionButton}>
            <Ionicons color={colors.text} name="person-add" size={22} />
            <Text style={styles.profileActionText}>Arkadaş Ekle</Text>
          </Pressable>

          <Pressable onPress={() => setPartnerMuted((current) => !current)} style={[styles.profileActionButton, styles.profileActionButtonDanger]}>
            <Ionicons color={colors.danger} name={partnerMuted ? 'volume-high' : 'volume-mute'} size={22} />
            <Text style={styles.profileActionText}>{partnerMuted ? 'Sesini Aç' : 'Sessize Al'}</Text>
          </Pressable>
        </View>
      </GlassCard>

      <GlassCard style={styles.autoContinueCard}>
        <View style={styles.autoContinueCopy}>
          <View style={styles.autoContinueIcon}>
            <Ionicons color={colors.muted} name="sync" size={26} />
          </View>
          <View style={styles.autoContinueTextWrap}>
            <Text style={styles.autoContinueTitle}>Otomatik eşleşmeye devam et</Text>
            <Text style={styles.autoContinueSubtitle}>Görüşme bitince sıradaki kişiyle devam et.</Text>
          </View>
        </View>

        <Pressable onPress={() => setAutoContinue((current) => !current)} style={[styles.toggle, autoContinue && styles.toggleActive]}>
          <View style={[styles.toggleKnob, autoContinue && styles.toggleKnobActive]} />
        </Pressable>
      </GlassCard>

      <View style={styles.ringSection}>
        <CountdownRing
          caption="kalan süre"
          promoText={isMatched ? `Hediye göndererek +${profile.plan === 'vip' ? '10' : '5'} dk kazan!` : undefined}
          remainingSeconds={isMatched ? remainingSeconds : searchRemaining}
          size={ringSize}
          subtitle={isMatched ? 'Kalan Süre' : 'Bağlanıyor...'}
          title={isMatched ? 'Görüşme Başladı' : 'Seni anlayacak biri aranıyor...'}
          tone="purple"
          totalSeconds={isMatched ? Math.max(CALL_SECONDS, remainingSeconds) : SEARCH_SECONDS}
        />

        <Pressable
          disabled={!isMatched}
          onPress={() => setGiftVisible(true)}
          style={[styles.floatingGiftButton, !isMatched && styles.floatingGiftButtonDisabled]}
        >
          <LinearGradient colors={['rgba(255, 79, 185, 0.92)', 'rgba(123, 71, 255, 0.92)']} style={styles.floatingGiftGradient}>
            <Ionicons color={colors.text} name="gift" size={28} />
            <Text style={styles.floatingGiftText}>Hediye{'\n'}Gönder</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.listeningRow}>
        <Ionicons color={colors.pink} name="pulse" size={24} />
        <Text style={styles.listeningText}>{partnerMuted ? 'Karşı kullanıcı sessizde.' : 'Seni dinliyor...'}</Text>
      </View>

      <GlassCard style={styles.topicsCard}>
        <Text style={styles.topicsTitle}>Konuşmak istediğiniz konuyu seçebilirsiniz</Text>
        <View style={styles.topicsRow}>
          {topics.map((topic) => (
            <TopicChip key={topic} icon={topicIcons[topic]} label={topic} onPress={() => setActiveTopic(topic)} selected={activeTopic === topic} />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.appreciationCard}>
        <View style={styles.appreciationCopy}>
          <Ionicons color={colors.goldSoft} name="sparkles" size={26} />
          <View style={styles.appreciationTextWrap}>
            <Text style={styles.appreciationTitle}>İyi bir sohbet, iyi bir ruh haline iyi gelir.</Text>
            <Text style={styles.appreciationSubtitle}>Birbirine değer kat.</Text>
          </View>
        </View>

        <Pressable disabled={!isMatched} onPress={handleAppreciation} style={[styles.likeButton, !isMatched && styles.likeButtonDisabled]}>
          <LinearGradient colors={['rgba(255, 76, 172, 0.94)', 'rgba(149, 74, 255, 0.94)']} style={styles.likeButtonGradient}>
            <Ionicons color={colors.text} name="heart" size={24} />
            <Text style={styles.likeButtonText}>Beğen</Text>
          </LinearGradient>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.controlsShell}>
        <View style={styles.controlsLeft}>
          <AudioControl active={micEnabled} icon={micEnabled ? 'mic' : 'mic-off'} label="Mikrofon" onPress={() => setMicEnabled((current) => !current)} />
          <AudioControl active={speakerEnabled} icon={speakerEnabled ? 'volume-high' : 'volume-mute'} label="Hoparlör" onPress={() => setSpeakerEnabled((current) => !current)} />

          <Pressable onPress={handleConversationFinished} style={styles.endCallControl}>
            <LinearGradient colors={['#FF6A8B', '#D82253']} style={styles.endCallGradient}>
              <Ionicons color={colors.text} name="call" size={34} style={styles.endCallIcon} />
            </LinearGradient>
            <Text style={styles.endCallLabel}>Görüşmeyi Bitir</Text>
          </Pressable>
        </View>

        <Pressable onPress={handlePass} style={styles.skipCard}>
          <LinearGradient colors={['rgba(139, 58, 255, 0.92)', 'rgba(255, 77, 181, 0.92)']} style={styles.skipGradient}>
            <Ionicons color={colors.text} name="play-skip-forward" size={32} />
            <View style={styles.skipCopy}>
              <Text style={styles.skipTitle}>Pas Geç</Text>
              <Text style={styles.skipSubtitle}>Sonraki kişiye geç</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </GlassCard>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={celebrationVisible} />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setFriendModalVisible(false), variant: 'secondary' }]}
        message="Arkadaşlık isteği gönderildi."
        title="İstek gönderildi"
        visible={friendModalVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Şikayet Et', onPress: () => setSafetyModalVisible(false), variant: 'gold' },
          { label: 'Engelle', onPress: () => setSafetyModalVisible(false), variant: 'secondary' },
          { label: 'Vazgeç', onPress: () => setSafetyModalVisible(false), variant: 'ghost' },
        ]}
        message="Bu kullanıcı için güvenlik işlemi başlatmak ister misin?"
        title="Engelle / Şikayet Et"
        visible={safetyModalVisible}
      />

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
            onPress: () => {
              setReviewVisible(false);
              setSafetyModalVisible(true);
            },
            variant: 'gold',
          },
        ]}
        message="Bu görüşmeyi nasıl değerlendirirsin?"
        title="Görüşme değerlendir"
        visible={reviewVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setAppreciationVisible(false), variant: 'secondary' }]}
        message="Bu kişi sana iyi geldi olarak işaretlendi."
        title="Beğeni gönderildi"
        visible={appreciationVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setAppreciationLimitVisible(false), variant: 'secondary' }]}
        message="Hakkınız bitmiştir. Günlük olarak yenilenmektedir."
        title="Beğeni hakkı doldu"
        visible={appreciationLimitVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(164, 122, 255, 0.26)',
    backgroundColor: 'rgba(24, 18, 46, 0.82)',
  },
  headerCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerSignal: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 79, 185, 0.08)',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: colors.text,
    fontSize: 13,
  },
  reportButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 138, 0.42)',
    backgroundColor: 'rgba(42, 10, 28, 0.82)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  profileLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 126,
    height: 126,
  },
  onlineDot: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3EF887',
    borderWidth: 3,
    borderColor: colors.background,
  },
  partnerInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  partnerBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerBadgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  partnerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerStatText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  partnerDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(176, 113, 255, 0.22)',
    backgroundColor: 'rgba(72, 38, 112, 0.4)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPillText: {
    color: '#D3A6FF',
    fontSize: 13,
    fontWeight: '700',
  },
  profileActions: {
    width: 170,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  profileActionButton: {
    minHeight: 62,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileActionButtonDanger: {
    borderColor: 'rgba(255, 94, 138, 0.18)',
    backgroundColor: 'rgba(64, 14, 35, 0.7)',
  },
  profileActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  autoContinueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  autoContinueCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  autoContinueIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  autoContinueTextWrap: {
    flex: 1,
    gap: 2,
  },
  autoContinueTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  autoContinueSubtitle: {
    color: colors.muted,
    lineHeight: 18,
  },
  toggle: {
    width: 86,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(141, 67, 255, 0.28)',
    borderColor: 'rgba(166, 122, 255, 0.42)',
  },
  toggleKnob: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.text,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  ringSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  floatingGiftButton: {
    position: 'absolute',
    right: 0,
    bottom: 26,
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  floatingGiftButtonDisabled: {
    opacity: 0.55,
  },
  floatingGiftGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  floatingGiftText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  listeningText: {
    color: colors.muted,
    fontSize: 16,
  },
  topicsCard: {
    gap: spacing.md,
  },
  topicsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicChipSelected: {
    backgroundColor: 'rgba(153, 70, 255, 0.24)',
    borderColor: 'rgba(199, 128, 255, 0.48)',
    shadowColor: colors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  topicChipLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  topicChipLabelSelected: {
    color: colors.text,
  },
  appreciationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  appreciationCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appreciationTextWrap: {
    flex: 1,
    gap: 4,
  },
  appreciationTitle: {
    color: '#DAB5FF',
    fontSize: 16,
    fontWeight: '700',
  },
  appreciationSubtitle: {
    color: colors.muted,
    lineHeight: 18,
  },
  likeButton: {
    minWidth: 148,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  likeButtonDisabled: {
    opacity: 0.55,
  },
  likeButtonGradient: {
    minHeight: 70,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  likeButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  controlsShell: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  controlsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  audioControl: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 82,
  },
  audioControlCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(111, 74, 255, 0.3)',
    backgroundColor: 'rgba(46, 28, 92, 0.65)',
  },
  audioControlCircleActive: {
    shadowColor: colors.purple,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  audioControlLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  audioControlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  audioControlDotActive: {
    backgroundColor: '#3EF887',
  },
  endCallControl: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 108,
  },
  endCallGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#FF557E',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
  endCallLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  skipCard: {
    width: 170,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  skipGradient: {
    flex: 1,
    minHeight: 162,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  skipCopy: {
    alignItems: 'center',
    gap: 4,
  },
  skipTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  skipSubtitle: {
    color: colors.text,
    fontSize: 14,
    opacity: 0.86,
    textAlign: 'center',
  },
});
