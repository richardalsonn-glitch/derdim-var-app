import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { NoticeModal } from '../components/NoticeModal';
import { isLiveKitEnabled } from '../config/features';
import { colors, gradients, layout, radius } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { getCurrentUser } from '../services/authService';
import { getActiveMatch, leaveQueue } from '../services/matchService';
import { requestMicrophonePermission } from '../services/permissionsService';
import { joinRoom, leaveRoom, toggleMute, toggleSpeaker } from '../services/voiceService';
import { FriendRequestItem, FriendSummary, Gender, GiftItem, MembershipPlan, TopicTag } from '../types';

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
  compact: boolean;
  onPress: () => void;
};

type ControlButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  size: number;
  onPress: () => void;
};

type Metrics = {
  horizontalPadding: number;
  verticalPadding: number;
  gap: number;
  tinyGap: number;
  headerButton: number;
  reportHeight: number;
  reportWidth: number;
  avatar: number;
  profileMaxHeight: number;
  sideButtonHeight: number;
  sideColumnWidth: number;
  autoHeight: number;
  ring: number;
  gift: number;
  topicHeight: number;
  likeHeight: number;
  bottomHeight: number;
  controlSize: number;
  endSize: number;
  skipWidth: number;
  compact: boolean;
  short: boolean;
};

const SEARCH_SECONDS = 2;
const CALL_SECONDS = 60;
const COUNTDOWN_AUDIO_SOURCE = require('../../assets/audio/gerisayim-1.m4a');
const RINGING_AUDIO_SOURCE = require('../../assets/audio/ringing.m4a');

const partners: MatchPartner[] = [
  { id: 'luna', username: 'Luna_24', avatarId: 'f-2', gender: 'Kadın', plan: 'vip', dermanScore: 4.8, level: 3 },
  { id: 'atlas', username: 'Atlas_28', avatarId: 'm-1', gender: 'Erkek', plan: 'plus', dermanScore: 4.6, level: 2 },
  { id: 'nova', username: 'Nova_23', avatarId: 'f-1', gender: 'Kadın', plan: 'plus', dermanScore: 4.7, level: 3 },
  { id: 'eren', username: 'Eren_31', avatarId: 'm-2', gender: 'Erkek', plan: 'vip', dermanScore: 4.9, level: 4 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMetrics(width: number, height: number): Metrics {
  const compact = width < 360 || height < 760;
  const short = height < 700;
  const horizontalPadding = width < 350 ? 12 : 16;
  const gap = short ? 6 : compact ? 8 : 10;
  const tinyGap = short ? 4 : 6;
  const usableWidth = Math.min(layout.maxWidth, width) - horizontalPadding * 2;
  const ring = clamp(Math.min(usableWidth - 122, height * 0.325) * 1.07, short ? 224 : 236, compact ? 252 : 266);

  return {
    horizontalPadding,
    verticalPadding: short ? 8 : 10,
    gap,
    tinyGap,
    headerButton: compact ? 40 : 44,
    reportHeight: compact ? 36 : 38,
    reportWidth: compact ? 126 : 138,
    avatar: short ? 72 : compact ? 76 : 82,
    profileMaxHeight: short ? 128 : 142,
    sideButtonHeight: short ? 42 : 46,
    sideColumnWidth: compact ? 100 : 110,
    autoHeight: short ? 58 : 64,
    ring,
    gift: short ? 52 : compact ? 56 : 60,
    topicHeight: short ? 72 : 80,
    likeHeight: short ? 62 : 70,
    bottomHeight: short ? 96 : 106,
    controlSize: short ? 56 : 60,
    endSize: short ? 66 : 70,
    skipWidth: short ? 96 : 106,
    compact,
    short,
  };
}

function getBadge(plan: MembershipPlan) {
  if (plan === 'vip') {
    return {
      label: 'VIP',
      icon: 'trophy' as const,
      colors: ['#8B5C00', '#E7BC4E'] as const,
    };
  }

  return {
    label: 'Plus',
    icon: 'flash' as const,
    colors: ['#277BFF', '#725DFF'] as const,
  };
}

function getUntilNextReset() {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}s ${minutes}dk`;
}

function buildRealtimePartner() {
  const activeMatch = getActiveMatch();
  const partnerProfile = activeMatch?.partnerProfile;

  if (!partnerProfile) {
    return null;
  }

  return {
    id: partnerProfile.userId,
    username: partnerProfile.username,
    avatarId: partnerProfile.avatarId,
    gender: getAvatarById(partnerProfile.avatarId).gender,
    plan: partnerProfile.plan,
    dermanScore: 4.8,
    level: 2,
  } satisfies MatchPartner;
}

function TopicChip({ label, selected, compact, onPress }: TopicChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.topicChip, compact && styles.topicChipCompact, selected && styles.topicChipSelected]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={[styles.topicChipText, compact && styles.topicChipTextCompact, selected && styles.topicChipTextSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ControlButton({ icon, label, active, size, onPress }: ControlButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.controlButton}>
      <View style={[styles.controlCircle, { width: size, height: size, borderRadius: size / 2 }, active && styles.controlCircleActive]}>
        <Ionicons color={colors.text} name={icon} size={size * 0.48} />
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.controlLabel}>
        {label}
      </Text>
      <View style={[styles.controlDot, active && styles.controlDotActive]} />
    </Pressable>
  );
}

export function VoiceCallScreen({ navigation, route }: AppScreenProps<'VoiceCall'>) {
  const {
    activeTopic,
    setActiveTopic,
    profile,
    rewardMatch,
    penalizeMatch,
    registerSkip,
    skipCount,
    dailyAppreciationLimit,
    dailyAppreciationUsed,
    blockedUserIds,
    countdownAlertsEnabled,
    friendRequests,
    useDailyAppreciation,
    renewDailyAppreciation,
    blockUser,
    sendFriendRequest,
    receiveFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useAppState();
  const { width, height } = useWindowDimensions();
  const metrics = useMemo(() => getMetrics(width, height), [width, height]);
  const realtimePartner = useMemo(() => buildRealtimePartner(), []);
  const isRealtimeSession = Boolean(route.params?.matchReady && realtimePartner);
  const [phase, setPhase] = useState<CallPhase>(isRealtimeSession ? 'matched' : 'searching');
  const [matchSeed, setMatchSeed] = useState(0);
  const [searchRemaining, setSearchRemaining] = useState(isRealtimeSession ? 0 : SEARCH_SECONDS);
  const [autoContinue, setAutoContinue] = useState(true);
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giftOverlayVisible, setGiftOverlayVisible] = useState(false);
  const [friendNoticeVisible, setFriendNoticeVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [likeNoticeVisible, setLikeNoticeVisible] = useState(false);
  const [likeNoticeMessage, setLikeNoticeMessage] = useState('Bu kişi sana iyi geldi olarak işaretlendi.');
  const [likeLimitVisible, setLikeLimitVisible] = useState(false);
  const [likeResetCountdown, setLikeResetCountdown] = useState(getUntilNextReset());
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [peerMuted, setPeerMuted] = useState(false);
  const [microphonePermissionGranted, setMicrophonePermissionGranted] = useState(false);
  const [permissionNoticeVisible, setPermissionNoticeVisible] = useState(false);
  const [voiceErrorVisible, setVoiceErrorVisible] = useState(false);
  const [voiceErrorMessage, setVoiceErrorMessage] = useState('Sesli gorusme baglantisi kurulurken bir hata olustu.');
  const [partner, setPartner] = useState<MatchPartner>(realtimePartner ?? partners[0]);
  const [partnerScore, setPartnerScore] = useState((realtimePartner ?? partners[0]).dermanScore);
  const [partnerLiked, setPartnerLiked] = useState(false);
  const [likedThisMatch, setLikedThisMatch] = useState(false);
  const [incomingFriendRequestId, setIncomingFriendRequestId] = useState<string | null>(null);
  const [incomingFriendPrompted, setIncomingFriendPrompted] = useState(false);
  const isMatched = phase === 'matched';
  const partnerAvatar = useMemo(() => getAvatarById(partner.avatarId), [partner.avatarId]);
  const partnerBadge = getBadge(partner.plan);
  const giftBonusSeconds = 600;
  const lastCountdownAlertRef = useRef<number | null>(null);
  const countdownAudioStartedRef = useRef(false);
  const countdownAudioRef = useRef<AudioPlayer | null>(null);
  const ringingAudioRef = useRef<AudioPlayer | null>(null);
  const ringingFallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceJoinedRef = useRef(false);
  const remainingLikes = Math.max(0, dailyAppreciationLimit - dailyAppreciationUsed);
  const blockedIdsKey = blockedUserIds.join('|');

  const { remainingSeconds, addSeconds, reset, setIsRunning } = useCountdownTimer({
    initialSeconds: CALL_SECONDS,
    autoStart: false,
    onExpire: () => {
      finishConversation();
    },
  });

  const incomingFriendRequest = useMemo(
    () =>
      friendRequests.find(
        (request) => request.id === incomingFriendRequestId && request.direction === 'incoming' && request.status === 'pending',
      ) ?? null,
    [friendRequests, incomingFriendRequestId],
  );

  async function disconnectVoiceRoom() {
    voiceJoinedRef.current = false;
    const result = await leaveRoom();

    if (result.error) {
      console.warn('[voice] leaveRoom failed:', result.error.message);
    }
  }

  async function leaveRealtimeMatchAndGoHome() {
    await disconnectVoiceRoom();
    const result = await leaveQueue();

    if (result.error) {
      console.warn('[match] leaveQueue failed:', result.error.message);
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }

  function showVoiceError(message: string) {
    setVoiceErrorMessage(message);
    setVoiceErrorVisible(true);
  }

  async function handleToggleMute() {
    const result = await toggleMute();

    if (result.error || !result.data) {
      showVoiceError(result.error?.message ?? 'Mikrofon durumu guncellenemedi.');
      return;
    }

    setMicEnabled(!result.data.muted);
  }

  async function handleToggleSpeaker() {
    const result = await toggleSpeaker();

    if (result.error || !result.data) {
      showVoiceError(result.error?.message ?? 'Hoparlor durumu guncellenemedi.');
      return;
    }

    setSpeakerEnabled(result.data.speakerEnabled);
  }

  function stopRingingFallback() {
    if (ringingFallbackIntervalRef.current) {
      clearInterval(ringingFallbackIntervalRef.current);
      ringingFallbackIntervalRef.current = null;
    }
  }

  function startRingingFallback() {
    if (ringingFallbackIntervalRef.current) {
      return;
    }

    ringingFallbackIntervalRef.current = setInterval(() => {
      Vibration.vibrate(35);
    }, 2200);
  }

  function stopRingingSound(resetPlayback = true) {
    stopRingingFallback();
    ringingAudioRef.current?.pause();

    if (resetPlayback) {
      ringingAudioRef.current?.seekTo(0).catch(() => undefined);
    }
  }

  function startRingingSound() {
    if (!isLiveKitEnabled) {
      return;
    }

    const player = ringingAudioRef.current;

    if (!player) {
      startRingingFallback();
      return;
    }

    player.volume = 0.35;
    player.loop = true;
    player.seekTo(0).then(() => {
      player.play();
    }).catch(() => {
      try {
        player.play();
      } catch {
        startRingingFallback();
      }
    });
  }

  useEffect(() => {
    if (!isLiveKitEnabled) {
      countdownAudioRef.current = null;
      ringingAudioRef.current = null;
      return;
    }

    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    const countdownPlayer = createAudioPlayer(COUNTDOWN_AUDIO_SOURCE);
    countdownPlayer.volume = 0.5;
    countdownAudioRef.current = countdownPlayer;
    const ringingPlayer = createAudioPlayer(RINGING_AUDIO_SOURCE);
    ringingPlayer.volume = 0.35;
    ringingPlayer.loop = true;
    ringingAudioRef.current = ringingPlayer;

    return () => {
      stopRingingSound();
      countdownPlayer.pause();
      countdownPlayer.remove();
      ringingPlayer.pause();
      ringingPlayer.remove();
      countdownAudioRef.current = null;
      ringingAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setLikeResetCountdown(getUntilNextReset());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    let mounted = true;

    const prepareVoice = async () => {
      if (!isLiveKitEnabled) {
        setMicrophonePermissionGranted(true);
        return;
      }

      const permission = await requestMicrophonePermission();

      if (!mounted) {
        return;
      }

      if (!permission.granted) {
        setMicrophonePermissionGranted(false);
        setPermissionNoticeVisible(true);
        return;
      }

      setMicrophonePermissionGranted(true);
      await setAudioModeAsync({
        allowsRecording: true,
        interruptionMode: 'duckOthers',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      }).catch((error) => {
        if (mounted) {
          showVoiceError(error instanceof Error ? error.message : 'Ses oturumu hazirlanamadi.');
        }
      });
    };

    void prepareVoice();

    return () => {
      mounted = false;
      void disconnectVoiceRoom();
    };
  }, []);

  useEffect(() => {
    if (!isRealtimeSession || !realtimePartner) {
      return;
    }

    setPartner(realtimePartner);
    setPartnerScore(realtimePartner.dermanScore);
    setPartnerLiked(false);
    setLikedThisMatch(false);
    setIncomingFriendRequestId(null);
    setIncomingFriendPrompted(false);
    setGiftVisible(false);
    setGiftOverlayVisible(false);
    setSelectedGift(null);
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPeerMuted(false);
    reset(CALL_SECONDS, true);
    setIsRunning(true);
  }, [isRealtimeSession, realtimePartner, reset, setIsRunning]);

  useEffect(() => {
    if (!microphonePermissionGranted || !isMatched || voiceJoinedRef.current) {
      return;
    }

    let cancelled = false;

    const connectVoice = async () => {
      if (!isLiveKitEnabled) {
        const joinResult = await joinRoom(partner.id);

        if (cancelled) {
          return;
        }

        if (joinResult.error || !joinResult.data) {
          showVoiceError(joinResult.error?.message ?? 'Mock sesli gorusme baslatilamadi.');
          return;
        }

        voiceJoinedRef.current = true;
        setMicEnabled(!joinResult.data.muted);
        setSpeakerEnabled(joinResult.data.speakerEnabled);
        return;
      }

      const currentUserResult = await getCurrentUser();

      if (cancelled) {
        return;
      }

      if (currentUserResult.error || !currentUserResult.data?.id) {
        showVoiceError(currentUserResult.error?.message ?? 'Sesli gorusme icin kullanici bulunamadi.');
        return;
      }

      const joinResult = await joinRoom(partner.id);

      if (cancelled) {
        if (joinResult.data) {
          await disconnectVoiceRoom();
        }

        return;
      }

      if (joinResult.error || !joinResult.data) {
        showVoiceError(joinResult.error?.message ?? 'Sesli gorusme odasina baglanilamadi.');
        return;
      }

      voiceJoinedRef.current = true;
      setMicEnabled(!joinResult.data.muted);
      setSpeakerEnabled(joinResult.data.speakerEnabled);
    };

    void connectVoice();

    return () => {
      cancelled = true;
    };
  }, [isMatched, microphonePermissionGranted]);

  useEffect(() => {
    if (isMatched) {
      return;
    }

    void disconnectVoiceRoom();
  }, [isMatched]);

  useEffect(() => {
    if (phase !== 'searching') {
      stopRingingSound();
      return;
    }

    if (!isLiveKitEnabled) {
      return;
    }

    startRingingSound();
    const fallbackTimerId = setTimeout(() => {
      if (!ringingAudioRef.current?.isLoaded) {
        startRingingFallback();
      }
    }, 900);

    return () => {
      clearTimeout(fallbackTimerId);
      stopRingingSound();
    };
  }, [phase]);

  useEffect(() => {
    if (!isMatched || remainingSeconds > 10 || remainingSeconds <= 0) {
      lastCountdownAlertRef.current = null;
      countdownAudioStartedRef.current = false;
      countdownAudioRef.current?.pause();
      countdownAudioRef.current?.seekTo(0).catch(() => undefined);
      return;
    }

    if (lastCountdownAlertRef.current === remainingSeconds) {
      return;
    }

    lastCountdownAlertRef.current = remainingSeconds;

    // TODO: production countdown beep audio asset eklenecek.
    // TODO: bu geri sayım uyarısı ileride realtime ile iki taraf için senkron tetiklenecek.
    if (countdownAlertsEnabled) {
      Vibration.vibrate(45);
    }

    if (remainingSeconds === 10 && !countdownAudioStartedRef.current) {
      countdownAudioStartedRef.current = true;
      countdownAudioRef.current?.seekTo(0).then(() => {
        countdownAudioRef.current?.play();
      }).catch(() => {
        countdownAudioRef.current?.play();
      });
    }
  }, [countdownAlertsEnabled, isMatched, remainingSeconds]);

  function getPartnerSummary(matchPartner: MatchPartner): FriendSummary {
    return {
      id: matchPartner.id,
      username: matchPartner.username,
      avatarId: matchPartner.avatarId,
      plan: matchPartner.plan,
    };
  }

  function selectPartner(nextSeed: number) {
    for (let offset = 0; offset < partners.length; offset += 1) {
      const candidate = partners[(nextSeed + skipCount + offset) % partners.length];

      if (!blockedUserIds.includes(candidate.id)) {
        return candidate;
      }
    }

    return partners[(nextSeed + skipCount) % partners.length];
  }

  function startSearch(nextSeed: number) {
    if (isRealtimeSession) {
      return;
    }

    stopRingingSound();
    const nextPartner = selectPartner(nextSeed);
    setPartner(nextPartner);
    setPartnerScore(nextPartner.dermanScore);
    setPartnerLiked((nextSeed + nextPartner.level) % 2 === 0);
    setLikedThisMatch(false);
    setPhase('searching');
    setSearchRemaining(SEARCH_SECONDS);
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPeerMuted(false);
    setGiftVisible(false);
    setGiftOverlayVisible(false);
    setSelectedGift(null);
    setIncomingFriendRequestId(null);
    setIncomingFriendPrompted(false);
    reset(CALL_SECONDS, false);
    setIsRunning(false);
  }

  useEffect(() => {
    if (isRealtimeSession) {
      return;
    }

    startSearch(matchSeed);
  }, [blockedIdsKey, isRealtimeSession, matchSeed, skipCount]);

  useEffect(() => {
    if (isRealtimeSession) {
      return;
    }

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
  }, [isRealtimeSession, phase, reset]);

  useEffect(() => {
    if (!isMatched || incomingFriendPrompted) {
      return;
    }

    const timerId = setTimeout(() => {
      const request = receiveFriendRequest(getPartnerSummary(partner));
      setIncomingFriendRequestId(request.id);
      setIncomingFriendPrompted(true);
    }, 9000);

    return () => clearTimeout(timerId);
  }, [incomingFriendPrompted, isMatched, partner, receiveFriendRequest]);

  useEffect(() => () => {
    if (isRealtimeSession) {
      void leaveQueue();
    }
  }, [isRealtimeSession]);

  function beginNextMatch() {
    if (isRealtimeSession) {
      void leaveRealtimeMatchAndGoHome();
      return;
    }

    setReviewVisible(false);
    setMatchSeed((current) => current + 1);
  }

  function finishConversation() {
    stopRingingSound();
    setIsRunning(false);
    void disconnectVoiceRoom();

    if (isRealtimeSession) {
      setReviewVisible(true);
      return;
    }

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
    if (likedThisMatch) {
      return;
    }

    const result = useDailyAppreciation();

    if (!result.allowed) {
      setLikeLimitVisible(true);
      return;
    }

    const mutualLike = partnerLiked;
    const secondsBonus = profile.plan === 'free' ? (mutualLike ? 60 : 30) : mutualLike ? 90 : 45;
    setPartnerScore((current) => Math.min(5, Number((current + (mutualLike ? 0.2 : 0.1)).toFixed(1))));
    addSeconds(secondsBonus);
    setLikedThisMatch(true);
    setLikeNoticeMessage(
      mutualLike
        ? `Karşılıklı beğeniyle +${secondsBonus} sn kazandınız.`
        : `Tek taraflı beğeniyle +${secondsBonus} sn kazandınız.`,
    );
    setLikeNoticeVisible(true);
  }

  function handlePass() {
    stopRingingSound();
    void disconnectVoiceRoom();

    if (isRealtimeSession) {
      void leaveRealtimeMatchAndGoHome();
      return;
    }

    registerSkip();
    beginNextMatch();
  }

  function handleBlockConfirmed() {
    stopRingingSound();
    void disconnectVoiceRoom();
    blockUser(getPartnerSummary(partner));
    setBlockConfirmVisible(false);
    setReviewVisible(false);

    if (isRealtimeSession) {
      void leaveRealtimeMatchAndGoHome();
      return;
    }

    setIsRunning(false);
    beginNextMatch();
  }

  function handleFriendRequestSend() {
    sendFriendRequest(getPartnerSummary(partner));
    setFriendNoticeVisible(true);
  }

  function handleIncomingFriendRequest(action: 'accept' | 'reject' | 'ignore') {
    if (!incomingFriendRequest) {
      return;
    }

    if (action === 'accept') {
      acceptFriendRequest(incomingFriendRequest.id);
    }

    if (action === 'reject') {
      rejectFriendRequest(incomingFriendRequest.id);
    }

    setIncomingFriendRequestId(null);
  }

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.screen}>
      <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbMiddle]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.shell,
            {
              paddingHorizontal: metrics.horizontalPadding,
              paddingVertical: metrics.verticalPadding,
              gap: metrics.gap,
            },
          ]}
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  stopRingingSound();
                  if (isRealtimeSession) {
                    void leaveRealtimeMatchAndGoHome();
                    return;
                  }

                  navigation.goBack();
                }}
                style={[styles.backButton, { width: metrics.headerButton, height: metrics.headerButton, borderRadius: metrics.headerButton / 2 }]}
              >
                <Ionicons color={colors.text} name="chevron-back" size={metrics.headerButton * 0.55} />
              </Pressable>

              <View style={styles.headerCopy}>
                <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.headerTitle}>
                  Eşleştirme
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.headerSubtitle}>
                  Seni anlayacak biri aranıyor...
                </Text>
              </View>

              <Pressable onPress={() => setBlockConfirmVisible(true)} style={[styles.reportButton, { height: metrics.reportHeight, width: metrics.reportWidth }]}>
                <Ionicons color={colors.danger} name="alert-circle" size={15} />
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.reportButtonText}>
                  Engelle / Şikayet
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.profileSection}>
            <View style={[styles.profileCard, { maxHeight: metrics.profileMaxHeight, padding: metrics.compact ? 10 : 12, gap: metrics.gap }]}>
              <View style={styles.profileMain}>
                <View style={[styles.avatarWrap, { width: metrics.avatar, height: metrics.avatar }]}>
                  <Avatar avatar={partnerAvatar} size={metrics.avatar} />
                  <View style={styles.onlineDot} />
                  <LinearGradient colors={[...partnerBadge.colors]} style={styles.avatarBadge}>
                    <Ionicons color={colors.text} name={partnerBadge.icon} size={13} />
                  </LinearGradient>
                </View>

                <View style={styles.profileInfo}>
                  <View style={styles.nameRow}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.partnerName, metrics.compact && styles.partnerNameCompact]}>
                      {partner.username}
                    </Text>
                    <Ionicons color={partner.gender === 'Kadın' ? colors.pink : colors.cyan} name={partner.gender === 'Kadın' ? 'female' : 'male'} size={16} />
                  </View>

                  <LinearGradient colors={[...partnerBadge.colors]} style={styles.memberBadge}>
                    <Ionicons color={colors.text} name={partnerBadge.icon} size={11} />
                    <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.memberBadgeText}>
                      {partnerBadge.label}
                    </Text>
                  </LinearGradient>

                  <View style={[styles.profileMetaRow, { gap: metrics.tinyGap }]}>
                    <View style={[styles.rolePill, metrics.compact && styles.rolePillCompact]}>
                      <Ionicons color={colors.pink} name="heart-circle" size={12} />
                      <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={1} style={styles.rolePillText}>
                        Derman Oluyor
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statsRow, { gap: metrics.tinyGap }]}>
                    <View style={styles.statItem}>
                      <Ionicons color={colors.goldSoft} name="star" size={14} />
                      <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.statText}>
                        {partnerScore.toFixed(1)} Derman
                      </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Ionicons color={colors.cyan} name="ribbon" size={14} />
                      <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.statText}>
                        Level {partner.level}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.sideActions, { width: metrics.sideColumnWidth, gap: metrics.tinyGap }]}>
                <Pressable onPress={handleFriendRequestSend} style={[styles.sideActionButton, { height: metrics.sideButtonHeight }]}>
                  <Ionicons color={colors.text} name="person-add" size={16} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.sideActionText}>
                    Arkadaş Ekle
                  </Text>
                </Pressable>

                <Pressable onPress={() => setPeerMuted((current) => !current)} style={[styles.sideActionButton, styles.sideActionDanger, { height: metrics.sideButtonHeight }]}>
                  <Ionicons color={colors.danger} name={peerMuted ? 'volume-high' : 'volume-mute'} size={16} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.sideActionText}>
                    {peerMuted ? 'Sesini Aç' : 'Sessize Al'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.autoSection}>
            <View style={[styles.autoCard, { height: metrics.autoHeight, paddingHorizontal: metrics.compact ? 10 : 12 }]}>
              <View style={styles.autoCopy}>
                <Text adjustsFontSizeToFit minimumFontScale={0.88} numberOfLines={1} style={styles.autoTitle}>
                  Otomatik eşleşmeye devam et
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.autoSubtitle}>
                  Görüşme bitince sıradaki kişiye geç.
                </Text>
              </View>

              <Pressable onPress={() => setAutoContinue((current) => !current)} style={[styles.toggle, autoContinue && styles.toggleActive]}>
                <View style={[styles.toggleKnob, autoContinue && styles.toggleKnobActive]} />
              </Pressable>
            </View>
          </View>

          <View style={styles.ringSection}>
            <View style={[styles.ringWrap, { minHeight: metrics.ring + metrics.gift * 0.5, marginBottom: metrics.short ? 12 : 14 }]}>
              <View
                style={[
                  styles.ringCluster,
                  {
                    width: '100%',
                    height: metrics.ring + metrics.gift * 0.5,
                  },
                ]}
              >
              <CountdownRing
                promoText={isMatched ? 'Hediye +10 dk' : undefined}
                promoIcon="gift"
                remainingSeconds={isMatched ? remainingSeconds : searchRemaining}
                segmentCount={76}
                size={metrics.ring}
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
                    width: metrics.gift,
                    height: metrics.gift,
                    borderRadius: metrics.gift / 2,
                    left: '50%',
                    marginLeft: metrics.ring * 0.39,
                    top: metrics.ring * 0.84,
                  },
                  !isMatched && styles.giftButtonDisabled,
                ]}
              >
                <LinearGradient colors={['rgba(255, 84, 176, 0.98)', 'rgba(126, 74, 255, 0.96)']} style={styles.giftGradient}>
                  <Ionicons color={colors.text} name="gift" size={metrics.short ? 17 : 19} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={2} style={styles.giftButtonText}>
                    Hediye{'\n'}Gönder
                  </Text>
                </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.bottomSection}>
            <View style={[styles.topicCard, styles.topicCardHidden, { height: metrics.topicHeight, paddingHorizontal: metrics.compact ? 10 : 12, paddingVertical: metrics.short ? 8 : 10 }]}>
              <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.topicTitle}>
                Konu seç
              </Text>
              <View style={[styles.topicRow, { gap: metrics.tinyGap }]}>
                {topics.map((topic) => (
                  <TopicChip
                    key={topic}
                    compact={metrics.compact}
                    label={topic}
                    onPress={() => setActiveTopic(topic)}
                    selected={activeTopic === topic}
                  />
                ))}
              </View>
            </View>

            <View style={[styles.likeCard, { height: metrics.likeHeight, paddingHorizontal: metrics.compact ? 10 : 12 }]}>
              <View style={styles.likeCopy}>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.likeText}>
                  Beğenirseniz süre uzar.
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.likeSubtext}>
                  Tek taraflı beğeni +30 sn, karşılıklı beğeni +60 sn kazandırır.
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.likeLimitText}>
                  Bugünkü hak: {remainingLikes}/{dailyAppreciationLimit}
                </Text>
              </View>

              <Pressable disabled={!isMatched || likedThisMatch} onPress={handleLike} style={[styles.likeButton, (!isMatched || likedThisMatch) && styles.likeButtonDisabled]}>
                <LinearGradient colors={['rgba(255, 84, 176, 0.98)', 'rgba(156, 71, 255, 0.98)']} style={styles.likeGradient}>
                  <Ionicons color={colors.text} name="heart" size={18} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.likeButtonText}>
                    Beğen
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.bottomBar, { height: metrics.bottomHeight, paddingHorizontal: metrics.compact ? 10 : 12, paddingVertical: metrics.short ? 8 : 10 }]}>
              <View style={styles.bottomLeft}>
                <ControlButton
                  active={micEnabled}
                  icon={micEnabled ? 'mic' : 'mic-off'}
                  label="Mikrofon"
                  onPress={() => void handleToggleMute()}
                  size={metrics.controlSize}
                />
                <ControlButton
                  active={speakerEnabled}
                  icon={speakerEnabled ? 'volume-high' : 'volume-mute'}
                  label="Hoparlör"
                  onPress={() => void handleToggleSpeaker()}
                  size={metrics.controlSize}
                />
                <Pressable onPress={finishConversation} style={styles.endCallButton}>
                  <LinearGradient colors={['#FF6E8B', '#D61E50']} style={[styles.endCallGradient, { width: metrics.endSize, height: metrics.endSize, borderRadius: metrics.endSize / 2 }]}>
                    <Ionicons color={colors.text} name="call" size={metrics.endSize * 0.42} style={styles.endCallIcon} />
                  </LinearGradient>
                  <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.endCallText}>
                    Bitir
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={handlePass} style={[styles.skipButton, { width: metrics.skipWidth }]}>
                <LinearGradient colors={['rgba(139, 53, 255, 0.98)', 'rgba(255, 81, 173, 0.98)']} style={styles.skipGradient}>
                  <Ionicons color={colors.text} name="play-skip-forward" size={20} />
                  <View style={styles.skipTextWrap}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.skipTitle}>
                      Pas Geç
                    </Text>
                    <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.skipSubtitle}>
                      Sonraki
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <GiftModal onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay gift={selectedGift} visible={giftOverlayVisible} />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setFriendNoticeVisible(false), variant: 'secondary' }]}
        message="Arkadaşlık isteği gönderildi."
        title="İstek gönderildi"
        visible={friendNoticeVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setPermissionNoticeVisible(false), variant: 'secondary' }]}
        message="Mikrofon izni olmadan konuÅŸma yapÄ±lamaz"
        title="Mikrofon izni gerekli"
        visible={permissionNoticeVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setVoiceErrorVisible(false), variant: 'secondary' }]}
        message={voiceErrorMessage}
        title="Sesli gorusme hatasi"
        visible={voiceErrorVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Evet, engelle', onPress: handleBlockConfirmed, variant: 'gold' },
          { label: 'Hayır', onPress: () => setBlockConfirmVisible(false), variant: 'ghost' },
        ]}
        message="Evet dersen görüşme hemen biter ve yeni eşleşme aranmaya başlanır."
        title="Bu kullanıcıyı engellemek istiyor musun?"
        visible={blockConfirmVisible}
      />

      <NoticeModal
        actions={[
          {
            label: 'Bana iyi geldi',
            onPress: () => {
              rewardMatch();
              setReviewVisible(false);
              if (isRealtimeSession) {
                void leaveRealtimeMatchAndGoHome();
                return;
              }

              navigation.navigate('Home');
            },
            variant: 'secondary',
          },
          {
            label: 'Uyum sağlamadı',
            onPress: () => {
              penalizeMatch();
              setReviewVisible(false);
              if (isRealtimeSession) {
                void leaveRealtimeMatchAndGoHome();
                return;
              }

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
        message={likeNoticeMessage}
        title="Beğeni gönderildi"
        visible={likeNoticeVisible}
      />

      <NoticeModal
        actions={[
          {
            label: '19.99 TRY ile yenile',
            onPress: () => {
              renewDailyAppreciation();
              setLikeLimitVisible(false);
            },
            variant: 'gold',
          },
          {
            label: 'Plus / VIP’a geç',
            onPress: () => {
              setLikeLimitVisible(false);
              navigation.navigate('Packages');
            },
            variant: 'secondary',
          },
          { label: 'Vazgeç', onPress: () => setLikeLimitVisible(false), variant: 'ghost' },
        ]}
        message={`Hakkın günlük yenilenir. Hemen devam etmek için hakkını yenileyebilir veya Plus/VIP’a geçebilirsin.\n\nYenilenmeye kalan: ${likeResetCountdown}`}
        title="Günlük beğenme hakkın bitti"
        visible={likeLimitVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Kabul et', onPress: () => handleIncomingFriendRequest('accept'), variant: 'secondary' },
          { label: 'Reddet', onPress: () => handleIncomingFriendRequest('reject'), variant: 'ghost' },
          { label: 'Yoksay', onPress: () => handleIncomingFriendRequest('ignore'), variant: 'gold' },
        ]}
        message={`${incomingFriendRequest?.username ?? 'Bu kullanıcı'} seni arkadaş olarak eklemek istiyor.`}
        title="Arkadaşlık isteği"
        visible={Boolean(incomingFriendRequest)}
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
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    top: -120,
    right: -40,
    width: 240,
    height: 240,
    backgroundColor: 'rgba(255, 83, 178, 0.12)',
  },
  orbMiddle: {
    top: '36%',
    left: -80,
    width: 200,
    height: 200,
    backgroundColor: 'rgba(120, 80, 255, 0.12)',
  },
  orbBottom: {
    bottom: 20,
    right: -60,
    width: 200,
    height: 200,
    backgroundColor: 'rgba(72, 179, 255, 0.1)',
  },
  headerSection: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(177, 133, 255, 0.28)',
    backgroundColor: 'rgba(18, 18, 44, 0.84)',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  headerTitle: {
    color: colors.pink,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: colors.text,
    fontSize: 12,
    opacity: 0.9,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 89, 143, 0.52)',
    backgroundColor: 'rgba(58, 15, 43, 0.82)',
    paddingHorizontal: 10,
  },
  reportButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  profileSection: {
    flex: 1.8,
    justifyContent: 'center',
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.24)',
    backgroundColor: 'rgba(17, 14, 42, 0.84)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  profileMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  onlineDot: {
    position: 'absolute',
    right: 3,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: '#44F47C',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  partnerName: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  partnerNameCompact: {
    fontSize: 18,
  },
  memberBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  memberBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rolePillCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rolePillText: {
    color: '#D6B7FF',
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  sideActions: {
    justifyContent: 'center',
  },
  sideActionButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sideActionDanger: {
    borderColor: 'rgba(255, 89, 143, 0.26)',
    backgroundColor: 'rgba(64, 16, 37, 0.76)',
  },
  sideActionText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  autoSection: {
    flex: 0.9,
    justifyContent: 'center',
  },
  autoCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  autoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  autoSubtitle: {
    color: colors.muted,
    fontSize: 11,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: 'rgba(139, 53, 255, 0.38)',
    borderColor: 'rgba(202, 128, 255, 0.44)',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  ringSection: {
    flex: 3.95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCluster: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  giftButton: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  giftButtonDisabled: {
    opacity: 0.55,
  },
  giftGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 6,
  },
  giftButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  bottomSection: {
    flex: 2.15,
    justifyContent: 'space-between',
  },
  topicCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
    justifyContent: 'center',
    gap: 8,
  },
  topicCardHidden: {
    display: 'none',
  },
  topicTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  topicRow: {
    flexDirection: 'row',
  },
  topicChip: {
    flex: 1,
    minWidth: 0,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  topicChipCompact: {
    height: 30,
  },
  topicChipSelected: {
    borderColor: 'rgba(209, 126, 255, 0.52)',
    backgroundColor: 'rgba(155, 67, 255, 0.28)',
  },
  topicChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  topicChipTextCompact: {
    fontSize: 10,
  },
  topicChipTextSelected: {
    color: colors.text,
  },
  likeCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  likeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  likeText: {
    color: '#D8B3FF',
    fontSize: 12,
    fontWeight: '800',
  },
  likeSubtext: {
    color: colors.text,
    fontSize: 9,
    opacity: 0.82,
  },
  likeLimitText: {
    color: colors.goldSoft,
    fontSize: 9,
    fontWeight: '700',
  },
  likeButton: {
    width: 102,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  likeButtonDisabled: {
    opacity: 0.55,
  },
  likeGradient: {
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  likeButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  bottomBar: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(181, 120, 255, 0.22)',
    backgroundColor: 'rgba(18, 16, 42, 0.86)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bottomLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  controlCircle: {
    borderWidth: 1,
    borderColor: 'rgba(122, 79, 255, 0.34)',
    backgroundColor: 'rgba(52, 26, 103, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleActive: {
    shadowColor: colors.purple,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  controlLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  controlDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  controlDotActive: {
    backgroundColor: '#3EF887',
  },
  endCallButton: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  endCallGradient: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF557E',
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  endCallIcon: {
    transform: [{ rotate: '135deg' }],
  },
  endCallText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  skipButton: {
    height: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexShrink: 0,
  },
  skipGradient: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  skipTextWrap: {
    minWidth: 0,
    alignItems: 'flex-start',
  },
  skipTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  skipSubtitle: {
    color: colors.text,
    fontSize: 10,
    opacity: 0.88,
  },
});
