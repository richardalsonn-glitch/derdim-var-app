import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { NoticeModal } from '../components/NoticeModal';
import { colors, gradients, layout, radius, spacing } from '../constants/theme';
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
  selected: boolean;
  onPress: () => void;
};

type ControlButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
};

const SEARCH_SECONDS = 2;
const CALL_SECONDS = 60;

const topicIcons: Record<TopicTag, keyof typeof Ionicons.glyphMap> = {
  İlişki: 'heart',
  İş: 'briefcase',
  Para: 'cash',
  Sağlık: 'medkit',
  Genel: 'ellipsis-horizontal',
};

const partners: MatchPartner[] = [
  { id: 'luna', username: 'Luna_24', avatarId: 'f-2', gender: 'Kadın', plan: 'vip', dermanScore: 4.8, level: 3 },
  { id: 'atlas', username: 'Atlas_28', avatarId: 'm-1', gender: 'Erkek', plan: 'plus', dermanScore: 4.6, level: 2 },
  { id: 'nova', username: 'Nova_23', avatarId: 'f-1', gender: 'Kadın', plan: 'plus', dermanScore: 4.7, level: 3 },
  { id: 'eren', username: 'Eren_31', avatarId: 'm-2', gender: 'Erkek', plan: 'vip', dermanScore: 4.9, level: 4 },
];

function getInnerWidth(screenWidth: number) {
  return Math.min(layout.maxWidth, screenWidth) - spacing.lg * 2;
}

function getRingSize(innerWidth: number) {
  return Math.max(248, Math.min(innerWidth - 10, 360));
}

function getBadge(plan: MembershipPlan) {
  if (plan === 'vip') {
    return {
      label: 'VIP Üye',
      icon: 'trophy' as const,
      colors: ['#8B5C00', '#E7BC4E'] as const,
    };
  }

  return {
    label: 'Plus Üye',
    icon: 'flash' as const,
    colors: ['#277BFF', '#725DFF'] as const,
  };
}

function TopicChip({ label, selected, onPress }: TopicChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.topicChip, selected && styles.topicChipSelected]}>
      <Ionicons color={selected ? colors.text : colors.pink} name={topicIcons[label]} size={16} />
      <Text numberOfLines={1} style={[styles.topicChipText, selected && styles.topicChipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ControlButton({ icon, label, active, onPress }: ControlButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.controlButton}>
      <View style={[styles.controlCircle, active && styles.controlCircleActive]}>
        <Ionicons color={colors.text} name={icon} size={30} />
      </View>
      <Text numberOfLines={1} style={styles.controlLabel}>
        {label}
      </Text>
      <View style={[styles.controlDot, active && styles.controlDotActive]} />
    </Pressable>
  );
}

export function VoiceCallScreen({ navigation }: AppScreenProps<'VoiceCall'>) {
  const {
    activeTopic,
    setActiveTopic,
    profile,
    rewardMatch,
    penalizeMatch,
    registerSkip,
    skipCount,
    useDailyAppreciation,
  } = useAppState();
  const { width } = useWindowDimensions();
  const innerWidth = getInnerWidth(width);
  const compactMode = innerWidth < 352;
  const narrowBottomBar = innerWidth < 372;
  const actionColumnWidth = compactMode ? 112 : 134;
  const avatarSize = compactMode ? 88 : 112;
  const ringSize = getRingSize(innerWidth);
  const giftSize = compactMode ? 88 : 100;
  const [phase, setPhase] = useState<CallPhase>('searching');
  const [matchSeed, setMatchSeed] = useState(0);
  const [searchRemaining, setSearchRemaining] = useState(SEARCH_SECONDS);
  const [autoContinue, setAutoContinue] = useState(true);
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giftOverlayVisible, setGiftOverlayVisible] = useState(false);
  const [friendModalVisible, setFriendModalVisible] = useState(false);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [likeNoticeVisible, setLikeNoticeVisible] = useState(false);
  const [likeLimitVisible, setLikeLimitVisible] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [peerMuted, setPeerMuted] = useState(false);
  const [partner, setPartner] = useState<MatchPartner>(partners[0]);
  const [partnerScore, setPartnerScore] = useState(partners[0].dermanScore);

  const isMatched = phase === 'matched';
  const partnerAvatar = useMemo(() => getAvatarById(partner.avatarId), [partner.avatarId]);
  const partnerBadge = getBadge(partner.plan);
  const giftBonusSeconds = profile.plan === 'vip' ? 600 : 300;

  const { remainingSeconds, addSeconds, reset, setIsRunning } = useCountdownTimer({
    initialSeconds: CALL_SECONDS,
    autoStart: false,
    onExpire: () => {
      finishConversation();
    },
  });

  function selectPartner(nextSeed: number) {
    return partners[(nextSeed + skipCount) % partners.length];
  }

  function startSearch(nextSeed: number) {
    const nextPartner = selectPartner(nextSeed);
    setPartner(nextPartner);
    setPartnerScore(nextPartner.dermanScore);
    setPhase('searching');
    setSearchRemaining(SEARCH_SECONDS);
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPeerMuted(false);
    setGiftVisible(false);
    setGiftOverlayVisible(false);
    setSelectedGift(null);
    reset(CALL_SECONDS, false);
    setIsRunning(false);
  }

  useEffect(() => {
    startSearch(matchSeed);
  }, [matchSeed, skipCount]);

  useEffect(() => {
    if (phase !== 'searching') {
      return;
    }

    const timerId = setInterval(() => {
      setSearchRemaining((current) => {
        if (current <= 1) {
          clearInterval(timerId);
          setPhase('matched');
          reset(CALL_SECONDS, true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [phase, reset]);

  function beginNextMatch() {
    setReviewVisible(false);
    setMatchSeed((current) => current + 1);
  }

  function finishConversation() {
    setIsRunning(false);

    if (autoContinue) {
      beginNextMatch();
      return;
    }

    setReviewVisible(true);
  }

  function handleGiftSelect(gift: GiftItem) {
    setGiftVisible(false);
    setSelectedGift(gift);
    setGiftOverlayVisible(true);
    setTimeout(() => {
      setGiftOverlayVisible(false);
      addSeconds(giftBonusSeconds);
    }, 10000);
  }

  function handleLike() {
    const result = useDailyAppreciation();

    if (!result.allowed) {
      setLikeLimitVisible(true);
      return;
    }

    setPartnerScore((current) => Math.min(5, Number((current + 0.1).toFixed(1))));
    addSeconds(30);
    setLikeNoticeVisible(true);
  }

  function handlePass() {
    registerSkip();
    beginNextMatch();
  }

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.screen}>
      <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbCenter]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons color={colors.text} name="chevron-back" size={28} />
              </Pressable>

              <View style={styles.headerCenter}>
                <View style={styles.headerSignal}>
                  <Ionicons color={colors.pink} name="pulse" size={24} />
                </View>
                <View style={styles.headerCopy}>
                  <Text numberOfLines={1} style={styles.headerTitle}>
                    Eşleştirme aşaması
                  </Text>
                  <Text numberOfLines={1} style={styles.headerSubtitle}>
                    Seni anlayacak biri aranıyor...
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => setSafetyModalVisible(true)} style={styles.reportButton}>
                <Ionicons color={colors.danger} name="alert-circle" size={18} />
                <Text numberOfLines={1} style={styles.reportButtonText}>
                  Engelle / Şikayet Et
                </Text>
              </Pressable>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.profileLeft}>
                <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
                  <Avatar avatar={partnerAvatar} size={avatarSize} />
                  <View style={styles.onlineDot} />
                  <LinearGradient colors={[...partnerBadge.colors]} style={styles.avatarBadge}>
                    <Ionicons color={colors.text} name={partnerBadge.icon} size={15} />
                  </LinearGradient>
                </View>

                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.partnerName}>
                      {partner.username}
                    </Text>
                    <Ionicons
                      color={partner.gender === 'Kadın' ? colors.pink : colors.cyan}
                      name={partner.gender === 'Kadın' ? 'female' : 'male'}
                      size={18}
                    />
                  </View>

                  <LinearGradient colors={[...partnerBadge.colors]} style={styles.memberBadge}>
                    <Ionicons color={colors.text} name={partnerBadge.icon} size={13} />
                    <Text numberOfLines={1} style={styles.memberBadgeText}>
                      {partnerBadge.label}
                    </Text>
                  </LinearGradient>

                  <View style={styles.statsRow}>
                    <View style={styles.statBlock}>
                      <Ionicons color={colors.goldSoft} name="star" size={16} />
                      <Text numberOfLines={1} style={styles.statText}>
                        {partnerScore.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBlock}>
                      <Ionicons color={colors.cyan} name="ribbon" size={16} />
                      <Text numberOfLines={1} style={styles.statText}>
                        Level {partner.level}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.rolePill}>
                    <Ionicons color={colors.pink} name="heart-circle" size={16} />
                    <Text numberOfLines={1} style={styles.rolePillText}>
                      Derman oluyor
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.profileActions, { width: actionColumnWidth }]}>
                <Pressable onPress={() => setFriendModalVisible(true)} style={styles.sideActionButton}>
                  <Ionicons color={colors.text} name="person-add" size={18} />
                  <Text numberOfLines={2} style={styles.sideActionText}>
                    Arkadaş Ekle
                  </Text>
                </Pressable>

                <Pressable onPress={() => setPeerMuted((current) => !current)} style={[styles.sideActionButton, styles.sideActionDanger]}>
                  <Ionicons color={colors.danger} name={peerMuted ? 'volume-high' : 'volume-mute'} size={18} />
                  <Text numberOfLines={2} style={styles.sideActionText}>
                    {peerMuted ? 'Sesini Aç' : 'Sessize Al'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.autoCard}>
              <View style={styles.autoIconWrap}>
                <Ionicons color={colors.text} name="sync" size={28} />
              </View>

              <View style={styles.autoCopy}>
                <Text numberOfLines={1} style={styles.autoTitle}>
                  Otomatik eşleşmeye devam et
                </Text>
                <Text numberOfLines={2} style={styles.autoSubtitle}>
                  Görüşme bitince sıradaki kişiyle devam et.
                </Text>
              </View>

              <Pressable onPress={() => setAutoContinue((current) => !current)} style={[styles.toggle, autoContinue && styles.toggleActive]}>
                <View style={[styles.toggleKnob, autoContinue && styles.toggleKnobActive]} />
              </Pressable>
            </View>

            <View style={[styles.ringSection, { minHeight: ringSize + giftSize * 0.62 }]}>
              <CountdownRing
                promoText={isMatched ? `Hediye göndererek +${partner.plan === 'vip' ? '10' : '5'} dk kazan!` : undefined}
                promoIcon="gift"
                remainingSeconds={isMatched ? remainingSeconds : searchRemaining}
                size={ringSize}
                subtitle={isMatched ? 'Kalan Süre' : 'Bağlanıyor...'}
                title={isMatched ? 'Görüşme Başladı' : 'Seni anlayacak biri aranıyor...'}
                titleIcon={isMatched ? 'people' : 'pulse'}
                tone="purple"
                totalSeconds={isMatched ? Math.max(CALL_SECONDS, remainingSeconds) : SEARCH_SECONDS}
              />

              <Pressable
                disabled={!isMatched}
                onPress={() => setGiftVisible(true)}
                style={[
                  styles.giftButton,
                  {
                    width: giftSize,
                    height: giftSize,
                    borderRadius: giftSize / 2,
                  },
                  !isMatched && styles.giftButtonDisabled,
                ]}
              >
                <LinearGradient colors={['rgba(255, 85, 177, 0.98)', 'rgba(125, 72, 255, 0.96)']} style={styles.giftGradient}>
                  <Ionicons color={colors.text} name="gift" size={compactMode ? 24 : 28} />
                  <Text numberOfLines={2} style={styles.giftButtonText}>
                    Hediye Gönder
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.listenRow}>
              <Ionicons color={colors.pink} name="pulse" size={22} />
              <Text numberOfLines={1} style={styles.listenText}>
                {isMatched ? 'Seni dinliyor...' : 'Seni anlayacak biri aranıyor...'}
              </Text>
            </View>

            <View style={styles.topicCard}>
              <Text numberOfLines={2} style={styles.topicTitle}>
                Konuşmak istediğiniz konuyu seçebilirsiniz
              </Text>

              <View style={styles.topicGrid}>
                {topics.map((topic) => (
                  <TopicChip key={topic} label={topic} onPress={() => setActiveTopic(topic)} selected={activeTopic === topic} />
                ))}
              </View>
            </View>

            <View style={styles.likeCard}>
              <View style={styles.likeCopy}>
                <Ionicons color={colors.goldSoft} name="sparkles" size={22} />
                <View style={styles.likeTextWrap}>
                  <Text numberOfLines={2} style={styles.likeTitle}>
                    İyi bir sohbet, iyi bir ruh haline iyi gelir.
                  </Text>
                  <Text numberOfLines={1} style={styles.likeSubtitle}>
                    Birbirine değer kat.
                  </Text>
                </View>
              </View>

              <Pressable disabled={!isMatched} onPress={handleLike} style={[styles.likeButton, !isMatched && styles.likeButtonDisabled]}>
                <LinearGradient colors={['rgba(255, 84, 176, 0.98)', 'rgba(156, 71, 255, 0.98)']} style={styles.likeGradient}>
                  <Ionicons color={colors.text} name="heart" size={22} />
                  <Text numberOfLines={1} style={styles.likeButtonText}>
                    Beğen
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.bottomBar, narrowBottomBar && styles.bottomBarCompact]}>
              <View style={[styles.mainControls, narrowBottomBar && styles.mainControlsCompact]}>
                <ControlButton
                  active={micEnabled}
                  icon={micEnabled ? 'mic' : 'mic-off'}
                  label="Mikrofon"
                  onPress={() => setMicEnabled((current) => !current)}
                />
                <ControlButton
                  active={speakerEnabled}
                  icon={speakerEnabled ? 'volume-high' : 'volume-mute'}
                  label="Hoparlör"
                  onPress={() => setSpeakerEnabled((current) => !current)}
                />

                <Pressable onPress={finishConversation} style={styles.endCallButton}>
                  <LinearGradient colors={['#FF6E8B', '#D61E50']} style={styles.endCallGradient}>
                    <Ionicons color={colors.text} name="call" size={30} style={styles.endCallIcon} />
                  </LinearGradient>
                  <Text numberOfLines={2} style={styles.endCallText}>
                    Görüşmeyi Bitir
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={handlePass} style={[styles.skipButton, narrowBottomBar && styles.skipButtonCompact]}>
                <LinearGradient colors={['rgba(139, 53, 255, 0.98)', 'rgba(255, 81, 173, 0.98)']} style={styles.skipGradient}>
                  <Ionicons color={colors.text} name="play-skip-forward" size={30} />
                  <View style={styles.skipCopy}>
                    <Text numberOfLines={1} style={styles.skipTitle}>
                      Pas Geç
                    </Text>
                    <Text numberOfLines={2} style={styles.skipSubtitle}>
                      Sonraki kişiye geç
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={giftOverlayVisible} />

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
        ]}
        message="Bu görüşmeyi nasıl değerlendirirsin?"
        title="Görüşmeyi değerlendir"
        visible={reviewVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setLikeNoticeVisible(false), variant: 'secondary' }]}
        message="Bu kişi sana iyi geldi olarak işaretlendi."
        title="Beğeni gönderildi"
        visible={likeNoticeVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setLikeLimitVisible(false), variant: 'secondary' }]}
        message="Hakkınız bitmiştir. Günlük olarak yenilenmektedir."
        title="Beğeni hakkı doldu"
        visible={likeLimitVisible}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 32,
  },
  container: {
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
    gap: spacing.md,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    top: -110,
    right: -30,
    width: 260,
    height: 260,
    backgroundColor: 'rgba(255, 76, 176, 0.14)',
  },
  orbCenter: {
    top: 320,
    left: -70,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(114, 77, 255, 0.14)',
  },
  orbBottom: {
    bottom: 90,
    right: -70,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(78, 182, 255, 0.12)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(177, 133, 255, 0.28)',
    backgroundColor: 'rgba(18, 18, 44, 0.82)',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSignal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(102, 51, 255, 0.16)',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    color: colors.pink,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  headerSubtitle: {
    color: colors.text,
    fontSize: 13,
    opacity: 0.92,
    flexShrink: 1,
  },
  reportButton: {
    maxWidth: 172,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 89, 143, 0.56)',
    backgroundColor: 'rgba(58, 15, 43, 0.82)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reportButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.26)',
    backgroundColor: 'rgba(17, 14, 42, 0.84)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  profileLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    top: -6,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: '#44F47C',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    flexShrink: 1,
  },
  memberBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  statBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rolePillText: {
    color: '#D5B5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileActions: {
    gap: spacing.sm,
  },
  sideActionButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sideActionDanger: {
    borderColor: 'rgba(255, 89, 143, 0.26)',
    backgroundColor: 'rgba(64, 16, 37, 0.76)',
  },
  sideActionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
    flexShrink: 1,
  },
  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
  },
  autoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  autoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  autoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  autoSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  toggle: {
    width: 72,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(139, 53, 255, 0.38)',
    borderColor: 'rgba(202, 128, 255, 0.44)',
  },
  toggleKnob: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.text,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  ringSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    paddingTop: spacing.sm,
  },
  giftButton: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.44,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  giftButtonDisabled: {
    opacity: 0.55,
  },
  giftGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  giftButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  listenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  listenText: {
    color: '#CFC3FF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  topicCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  topicTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    minHeight: 42,
    minWidth: 88,
    maxWidth: '48%',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  topicChipSelected: {
    borderColor: 'rgba(209, 126, 255, 0.52)',
    backgroundColor: 'rgba(155, 67, 255, 0.28)',
  },
  topicChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  topicChipTextSelected: {
    color: colors.text,
  },
  likeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
  },
  likeCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  likeTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  likeTitle: {
    color: '#D9B0FF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    flexShrink: 1,
  },
  likeSubtitle: {
    color: colors.muted,
    fontSize: 14,
    flexShrink: 1,
  },
  likeButton: {
    minWidth: 138,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  likeButtonDisabled: {
    opacity: 0.55,
  },
  likeGradient: {
    minHeight: 62,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  likeButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.84)',
    marginBottom: 10,
  },
  bottomBarCompact: {
    flexDirection: 'column',
  },
  mainControls: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  mainControlsCompact: {
    justifyContent: 'space-around',
  },
  controlButton: {
    flex: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  controlCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: 'rgba(122, 79, 255, 0.34)',
    backgroundColor: 'rgba(52, 26, 103, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleActive: {
    shadowColor: colors.purple,
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  controlLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  controlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  controlDotActive: {
    backgroundColor: '#3EF887',
  },
  endCallButton: {
    flex: 1,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  endCallGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF557E',
    shadowOpacity: 0.46,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
  endCallText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  skipButton: {
    width: 172,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  skipButtonCompact: {
    width: '100%',
  },
  skipGradient: {
    flex: 1,
    minHeight: 148,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  skipCopy: {
    alignItems: 'center',
    gap: 4,
  },
  skipTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  skipSubtitle: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 18,
  },
});
