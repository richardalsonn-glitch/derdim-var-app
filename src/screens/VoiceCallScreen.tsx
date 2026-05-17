import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { NoticeModal } from '../components/NoticeModal';
import { UserAvatar } from '../components/UserAvatar';
import { isDemoMode, isLiveKitEnabled } from '../config/features';
import { colors, gradients, radius } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { gifts, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getContentMaxWidth, getHorizontalPadding, getScreenLayout, getScreenMetrics } from '../utils/responsive';
import { shouldClearGiftOverlayTimerBeforeEnqueue, shouldLeaveRandomQueueOnUnmount } from '../utils/voiceCallUiState';
import { buildFriendCallAvatarLog } from '../utils/avatarLogger';
import { resolveAvatarMeta } from '../utils/avatarResolver';
import { getCurrentUser } from '../services/authService';
import { stopAllCallSounds } from '../services/callSoundService';
import { endFriendCallInvite, getFriendCallInviteByRoom, getFriendCallPeerProfile, subscribeToFriendCallRoom } from '../services/friendCallService';
import { endMatchSessionReliable, getActiveMatch, getMatchSessionCloseState, leaveQueue, listenForMatchSessionEndReliable } from '../services/matchService';
import { requestMicrophonePermission } from '../services/permissionsService';
import { consumeGiftCredit, listFriends, listGiftBalances, purchaseGiftCredit, sendFriendshipRequest } from '../services/socialService';
import { isVoiceSessionActive, joinRoom, leaveRoom, restoreVoiceAudioSession, toggleMute, toggleRemoteMute, toggleSpeaker } from '../services/voiceService';
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

type CallBonusPayload = {
  type?: 'time_bonus' | 'gift_bonus' | 'remote_mute';
  eventId?: string;
  seconds?: number;
  bonusSeconds?: number;
  senderId?: string | null;
  senderUsername?: string | null;
  roomId?: string | null;
  muted?: boolean;
  giftId?: string | null;
  giftName?: string | null;
  giftSymbol?: string | null;
  giftAccent?: [string, string] | string[] | null;
  createdAt?: string;
};

type GiftOverlayQueueItem = {
  caption: string;
  gift: GiftItem;
};

type Metrics = {
  horizontalPadding: number;
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
const WAITING_SECONDS = 30;
const GIFT_MESSAGE_DURATION_MS = 5000;
const GIFT_OVERLAY_DURATION_MS = 3000;
const REMOTE_MUTE_NOTICE_DURATION_MS = 3000;
const COUNTDOWN_AUDIO_SOURCE = require('../../assets/audio/gerisayim-1.m4a');
const RINGING_AUDIO_SOURCE = require('../../assets/audio/ringing.m4a');

const demoPartners: MatchPartner[] = [
  { id: 'luna', username: 'Luna_24', avatarId: 'athena', gender: 'Kadın', plan: 'vip', dermanScore: 4.8, level: 3 },
  { id: 'atlas', username: 'Atlas_28', avatarId: 'apollo', gender: 'Erkek', plan: 'plus', dermanScore: 4.6, level: 2 },
  { id: 'nova', username: 'Nova_23', avatarId: 'aphrodite', gender: 'Kadın', plan: 'plus', dermanScore: 4.7, level: 3 },
  { id: 'eren', username: 'Eren_31', avatarId: 'hermes', gender: 'Erkek', plan: 'vip', dermanScore: 4.9, level: 4 },
];

const waitingPartner: MatchPartner = {
  id: 'waiting',
  username: 'Uygun kullanıcı aranıyor',
  avatarId: 'aphrodite',
  gender: 'Kadın',
  plan: 'free',
  dermanScore: 0,
  level: 1,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMetrics(width: number, height: number): Metrics {
  const screen = getScreenMetrics({ width, height });
  const compact = screen.isCompactPhone || height <= 844;
  const tiny = width < 360;
  const short = height < 740;
  const veryShort = height < 700;
  const horizontalPadding = Math.min(getHorizontalPadding(width), 20);
  const gap = veryShort ? 4 : short ? 6 : compact ? 8 : 10;
  const tinyGap = veryShort ? 3 : short ? 4 : 6;
  const usableWidth = Math.min(getContentMaxWidth(width), width) - horizontalPadding * 2;
  const ring = clamp(
    Math.min(usableWidth - (tiny ? 96 : 112), height * (veryShort ? 0.28 : 0.315)) * 1.06,
    veryShort ? 190 : short ? 204 : 226,
    tiny ? 224 : compact ? 246 : 266,
  );

  return {
    horizontalPadding,
    gap,
    tinyGap,
    headerButton: compact ? 40 : 44,
    reportHeight: compact ? 36 : 38,
    reportWidth: compact ? 126 : 138,
    avatar: veryShort ? 62 : short ? 68 : compact ? 76 : 82,
    profileMaxHeight: veryShort ? 112 : short ? 124 : 142,
    sideButtonHeight: veryShort ? 38 : short ? 42 : 46,
    sideColumnWidth: tiny ? 92 : compact ? 100 : 110,
    autoHeight: veryShort ? 52 : short ? 58 : 64,
    ring,
    gift: veryShort ? 48 : short ? 52 : compact ? 56 : 60,
    topicHeight: veryShort ? 64 : short ? 72 : 80,
    likeHeight: veryShort ? 56 : short ? 62 : 70,
    bottomHeight: veryShort ? 88 : short ? 96 : 106,
    controlSize: veryShort ? 50 : short ? 56 : 60,
    endSize: veryShort ? 60 : short ? 66 : 70,
    skipWidth: tiny ? 86 : short ? 96 : 106,
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

function formatLiveKitValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim() || 'empty';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return 'null';
  }

  return String(value);
}

function logLiveKitScreen(functionName: string, event: Record<string, unknown>) {
  const message = Object.entries(event)
    .map(([key, value]) => `${key}:${formatLiveKitValue(value)}`)
    .join(' ');

  logSafeDebug('[livekit]', message, { functionName });
}

function getLiveKitTokenEndpointForLog() {
  const explicitEndpoint = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT?.trim();

  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return supabaseUrl ? `${supabaseUrl}/functions/v1/livekit-token` : '';
}

function buildRealtimePartner(routePartner?: {
  matchedUserId?: string;
  partnerName?: string;
  partnerAvatarId?: string;
}) {
  if (routePartner?.matchedUserId && routePartner.partnerName) {
    const avatarMeta = resolveAvatarMeta(routePartner.partnerAvatarId);
    const avatarId = avatarMeta.canonicalId;
    return {
      id: routePartner.matchedUserId,
      username: routePartner.partnerName,
      avatarId,
      gender: avatarMeta.gender,
      plan: 'free',
      dermanScore: 4.7,
      level: 1,
    } satisfies MatchPartner;
  }

  const activeMatch = getActiveMatch();
  const partnerProfile = activeMatch?.partnerProfile;

  if (!partnerProfile) {
    return null;
  }

  return {
    id: partnerProfile.userId,
    username: partnerProfile.username,
    avatarId: partnerProfile.avatarId,
    gender: resolveAvatarMeta(partnerProfile.avatarId).gender,
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
  const insets = useSafeAreaInsets();
  const metrics = useMemo(() => getMetrics(width, height), [width, height]);
  const screenLayout = getScreenLayout({ width, height }, insets);
  const activeMatchSnapshot = useMemo(() => getActiveMatch(), []);
  const realtimePartner = useMemo(() => buildRealtimePartner(route.params), [route.params]);
  const isFriendCallSession = Boolean(route.params?.friendCall || route.params?.mode === 'friend_call');
  const matchRoomId = useMemo(() => {
    const fromRoute = route.params?.matchRoomId;
    const fromLegacyRoute = (route.params as { roomId?: string } | undefined)?.roomId;
    const fromActiveMatch = activeMatchSnapshot?.queue.match_room_id ?? activeMatchSnapshot?.queue.room_id;
    const resolved = fromRoute ?? fromLegacyRoute ?? fromActiveMatch ?? null;
    return typeof resolved === 'string' && resolved.trim().length > 0 ? resolved.trim() : null;
  }, [activeMatchSnapshot?.queue.match_room_id, activeMatchSnapshot?.queue.room_id, route.params]);
  const isRealtimeSession = Boolean(route.params?.matchReady && realtimePartner);
  const isDemoSession = isDemoMode && !isRealtimeSession;
  const [phase, setPhase] = useState<CallPhase>(isRealtimeSession ? 'matched' : 'searching');
  const [matchSeed, setMatchSeed] = useState(0);
  const [searchRemaining, setSearchRemaining] = useState(isRealtimeSession ? 0 : SEARCH_SECONDS);
  const [autoContinue, setAutoContinue] = useState(true);
  const [giftVisible, setGiftVisible] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giftOverlayVisible, setGiftOverlayVisible] = useState(false);
  const [giftOverlayCaption, setGiftOverlayCaption] = useState('Süreye bonus ekleniyor...');
  const [giftPersistentMessage, setGiftPersistentMessage] = useState('');
  const [remoteMuteNoticeMessage, setRemoteMuteNoticeMessage] = useState('');
  const [giftInventory, setGiftInventory] = useState<Record<string, number>>({});
  const [friendNoticeVisible, setFriendNoticeVisible] = useState(false);
  const [friendNoticeMessage, setFriendNoticeMessage] = useState('Arkadaşlık isteği gönderildi.');
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const initialPartner = realtimePartner ?? (isDemoMode ? demoPartners[0] : waitingPartner);
  const [partner, setPartner] = useState<MatchPartner>(initialPartner);
  const [partnerScore, setPartnerScore] = useState(initialPartner.dermanScore);
  const [partnerLiked, setPartnerLiked] = useState(false);
  const [likedThisMatch, setLikedThisMatch] = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [incomingFriendRequestId, setIncomingFriendRequestId] = useState<string | null>(null);
  const [incomingFriendPrompted, setIncomingFriendPrompted] = useState(false);
  const [waitingExpired, setWaitingExpired] = useState(false);
  const isMatched = phase === 'matched';
  const partnerBadge = getBadge(partner.plan);
  const callDurationSeconds = route.params?.durationSeconds ?? CALL_SECONDS;
  const lastCountdownAlertRef = useRef<number | null>(null);
  const countdownAudioStartedRef = useRef(false);
  const countdownAudioRef = useRef<AudioPlayer | null>(null);
  const ringingAudioRef = useRef<AudioPlayer | null>(null);
  const ringingFallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const callBonusChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const processedBonusEventsRef = useRef<Set<string>>(new Set());
  const processedGiftEventsRef = useRef<Set<string>>(new Set());
  const giftBonusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giftMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giftOverlayQueueRef = useRef<GiftOverlayQueueItem[]>([]);
  const giftOverlayActiveRef = useRef(false);
  const remoteMuteNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceJoinedRef = useRef(false);
  const hasLeftCallRef = useRef(false);
  const isEndingRef = useRef(false);
  const cleanupCompletedRef = useRef(false);
  const sessionEndCleanupRef = useRef<null | (() => Promise<void>)>(null);
  const sessionEndPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionStartedRef = useRef<string | null>(null);
  const activeCallRoomIdRef = useRef<string | null>(matchRoomId);
  const remainingLikes = Math.max(0, dailyAppreciationLimit - dailyAppreciationUsed);
  const blockedIdsKey = blockedUserIds.join('|');

  const { remainingSeconds, addSeconds, reset, setIsRunning } = useCountdownTimer({
    initialSeconds: callDurationSeconds,
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

  function normalizeCallRoomId(value: string | null | undefined) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  function getActiveCallRoomId() {
    return normalizeCallRoomId(activeCallRoomIdRef.current ?? matchRoomId);
  }

  function logCallNavigation(reason: string, source: string, status?: string | null) {
    logSafeDebug(
      '[call-navigation]',
      `closeVoiceScreen reason:${reason} source:${source} roomId:${matchRoomId ?? 'none'} activeRoomId:${getActiveCallRoomId() ?? 'none'} status:${status ?? 'unknown'} friendCall:${isFriendCallSession}`,
    );
  }

  function shouldAcceptEndEvent(
    type: 'friend' | 'match',
    eventRoomId: string | null | undefined,
    status: string | null | undefined,
    source: string,
    extra = '',
  ) {
    const activeRoomId = getActiveCallRoomId();
    const normalizedEventRoomId = normalizeCallRoomId(eventRoomId);
    const terminal = status === 'ended' || status === 'cancelled' || status === 'expired';
    const matches = Boolean(activeRoomId && normalizedEventRoomId && activeRoomId === normalizedEventRoomId);
    const ignored = !terminal || !matches || cleanupCompletedRef.current || isEndingRef.current;

    logSafeDebug(
      '[call-end-guard]',
      `eventReceived type:${type} source:${source} eventRoomId:${normalizedEventRoomId ?? 'none'} activeRoomId:${activeRoomId ?? 'none'} status:${status ?? 'unknown'} matches:${matches} ignored:${ignored}${extra ? ` ${extra}` : ''}`,
    );

    if (type === 'match') {
      logSafeDebug(
        '[match-end]',
        ignored
          ? `ignoredStaleEndEvent:true eventRoomId:${normalizedEventRoomId ?? 'none'} activeRoomId:${activeRoomId ?? 'none'} matches:${matches} status:${status ?? 'unknown'} source:${source}`
          : `remoteEndEventReceived:true eventRoomId:${normalizedEventRoomId ?? 'none'} activeRoomId:${activeRoomId ?? 'none'} matches:${matches} status:${status ?? 'unknown'} source:${source}`,
      );
    }

    return !ignored;
  }

  function getPayloadEventId(payload: CallBonusPayload) {
    return typeof payload.eventId === 'string' && payload.eventId.trim().length > 0
      ? payload.eventId.trim()
      : null;
  }

  function rememberRealtimeEvent(processedEvents: Set<string>, eventId: string | null) {
    if (!eventId) {
      return true;
    }

    if (processedEvents.has(eventId)) {
      return false;
    }

    processedEvents.add(eventId);

    if (processedEvents.size > 80) {
      const firstEventId = processedEvents.values().next().value;

      if (firstEventId) {
        processedEvents.delete(firstEventId);
      }
    }

    return true;
  }

  function hideGiftOverlay() {
    if (giftBonusTimeoutRef.current) {
      clearTimeout(giftBonusTimeoutRef.current);
      giftBonusTimeoutRef.current = null;
    }

    giftOverlayQueueRef.current = [];
    giftOverlayActiveRef.current = false;
    setGiftOverlayVisible(false);
    setSelectedGift(null);
    logSafeDebug('[gift]', 'giftOverlayCleared:true');
    setGiftOverlayCaption('Süreye bonus ekleniyor...');
  }

  function clearGiftMessageTimeout() {
    if (giftMessageTimeoutRef.current) {
      clearTimeout(giftMessageTimeoutRef.current);
      giftMessageTimeoutRef.current = null;
    }
  }

  function hideGiftMessage() {
    clearGiftMessageTimeout();
    setGiftPersistentMessage('');
    logSafeDebug('[gift]', 'giftMessageHidden:true');
  }

  function startGiftOverlay(item: GiftOverlayQueueItem) {
    giftOverlayActiveRef.current = true;
    setSelectedGift(item.gift);
    setGiftOverlayCaption(item.caption);
    setGiftOverlayVisible(true);
    logSafeDebug('[gift]', `giftOverlayStart:true giftId:${item.gift.id} durationMs:${GIFT_OVERLAY_DURATION_MS}`);

    giftBonusTimeoutRef.current = setTimeout(() => {
      giftBonusTimeoutRef.current = null;
      logSafeDebug('[gift]', `giftOverlayTimeout:true giftId:${item.gift.id}`);
      logSafeDebug('[gift]', `giftOverlayComplete:true giftId:${item.gift.id}`);

      const nextItem = giftOverlayQueueRef.current.shift() ?? null;

      if (nextItem) {
        logSafeDebug('[gift]', `giftQueueNext:true queueLength:${giftOverlayQueueRef.current.length}`);
        startGiftOverlay(nextItem);
        return;
      }

      giftOverlayActiveRef.current = false;
      setGiftOverlayVisible(false);
      setSelectedGift(null);
      logSafeDebug('[gift]', 'giftQueueEmpty:true');
      logSafeDebug('[gift]', 'giftOverlayCleared:true');
    }, GIFT_OVERLAY_DURATION_MS);
  }

  function enqueueGiftOverlay(item: GiftOverlayQueueItem) {
    if (giftOverlayActiveRef.current) {
      giftOverlayQueueRef.current.push(item);
      logSafeDebug('[gift]', `giftQueued:true giftId:${item.gift.id} queueLength:${giftOverlayQueueRef.current.length}`);
      return;
    }

    if (shouldClearGiftOverlayTimerBeforeEnqueue(giftOverlayActiveRef.current) && giftBonusTimeoutRef.current) {
      clearTimeout(giftBonusTimeoutRef.current);
      giftBonusTimeoutRef.current = null;
    }

    logSafeDebug('[gift]', `giftQueued:true giftId:${item.gift.id} queueLength:0`);
    startGiftOverlay(item);
  }

  function clearRemoteMuteNoticeTimeout() {
    if (remoteMuteNoticeTimeoutRef.current) {
      clearTimeout(remoteMuteNoticeTimeoutRef.current);
      remoteMuteNoticeTimeoutRef.current = null;
    }
  }

  function hideRemoteMuteNotice() {
    clearRemoteMuteNoticeTimeout();
    setRemoteMuteNoticeMessage('');
    logSafeDebug('[remote-mute]', 'remoteMuteNoticeHidden:true');
  }

  function setGiftMessageFromPayload(payload: CallBonusPayload, gift: GiftItem, forceLocalGift = false) {
    const senderUsername = typeof payload.senderUsername === 'string' && payload.senderUsername.trim().length > 0
      ? payload.senderUsername.trim()
      : partner.username;
    const isLocalSender = forceLocalGift || Boolean(payload.senderId && payload.senderId === currentUserIdRef.current);
    const message = isLocalSender
      ? `${gift.name} hediyesi gönderdiniz.`
      : `${senderUsername} size ${gift.name} hediyesi gönderdi.`;

    clearGiftMessageTimeout();
    setGiftPersistentMessage(message);
    logSafeDebug('[gift]', `giftPersistentMessageSet:true giftId:${gift.id} senderName:${senderUsername} local:${isLocalSender}`);
    logSafeDebug('[gift]', `giftMessageShown:true durationMs:${GIFT_MESSAGE_DURATION_MS}`);
    giftMessageTimeoutRef.current = setTimeout(() => {
      giftMessageTimeoutRef.current = null;
      setGiftPersistentMessage('');
      logSafeDebug('[gift]', 'giftMessageHidden:true');
    }, GIFT_MESSAGE_DURATION_MS);
  }

  function getGiftFromPayload(payload: CallBonusPayload): GiftItem | null {
    const giftId = typeof payload.giftId === 'string' && payload.giftId.trim().length > 0
      ? payload.giftId.trim()
      : null;
    const catalogGift = giftId ? gifts.find((gift) => gift.id === giftId) : null;

    if (catalogGift) {
      return catalogGift;
    }

    const giftName = typeof payload.giftName === 'string' && payload.giftName.trim().length > 0
      ? payload.giftName.trim()
      : null;
    const giftSymbol = typeof payload.giftSymbol === 'string' && payload.giftSymbol.trim().length > 0
      ? payload.giftSymbol.trim()
      : null;

    if (!giftName && !giftSymbol) {
      return null;
    }

    const firstAccent = Array.isArray(payload.giftAccent) && typeof payload.giftAccent[0] === 'string'
      ? payload.giftAccent[0]
      : '#FF4FB9';
    const secondAccent = Array.isArray(payload.giftAccent) && typeof payload.giftAccent[1] === 'string'
      ? payload.giftAccent[1]
      : '#8F46FF';

    return {
      id: giftId ?? `remote-gift-${giftName ?? 'gift'}`,
      name: giftName ?? 'Hediye',
      symbol: giftSymbol ?? '🎁',
      price: '',
      priceTry: 0,
      bonusSeconds: Math.max(0, Math.floor(Number(payload.bonusSeconds ?? payload.seconds ?? 0))),
      caption: '',
      accent: [firstAccent, secondAccent],
    };
  }

  function showGiftOverlayFromPayload(payload: CallBonusPayload, forceLocalGift = false) {
    const gift = getGiftFromPayload(payload);

    if (!gift) {
      return;
    }

    const eventId = getPayloadEventId(payload);

    if (!rememberRealtimeEvent(processedGiftEventsRef.current, eventId)) {
      return;
    }

    const senderUsername = typeof payload.senderUsername === 'string' && payload.senderUsername.trim().length > 0
      ? payload.senderUsername.trim()
      : partner.username;
    const isLocalSender = forceLocalGift || Boolean(payload.senderId && payload.senderId === currentUserIdRef.current);
    const caption = isLocalSender ? `${gift.name} gönderildi` : `${senderUsername} sana ${gift.name} gönderdi`;

    setGiftMessageFromPayload(payload, gift, forceLocalGift);
    enqueueGiftOverlay({ caption, gift });
    logSafeDebug('[gift]', `giftBroadcastReceived giftId:${gift.id} senderName:${senderUsername} displayAnimationMs:${GIFT_OVERLAY_DURATION_MS}`);

  }

  function applyCallBonus(payload: CallBonusPayload) {
    const seconds = Math.floor(Number(payload.bonusSeconds ?? payload.seconds ?? 0));

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    if (!rememberRealtimeEvent(processedBonusEventsRef.current, getPayloadEventId(payload))) {
      return;
    }

    addSeconds(seconds);
  }

  function handleCallBonusPayload(payload: CallBonusPayload, options?: { forceLocalGift?: boolean }) {
    if (payload.roomId && matchRoomId && payload.roomId !== matchRoomId) {
      logSafeDebug('[gift]', `ignoredStaleGiftEvent:true eventRoomId:${payload.roomId} activeRoomId:${matchRoomId}`);
      return;
    }

    showGiftOverlayFromPayload(payload, options?.forceLocalGift ?? false);
    applyCallBonus(payload);
  }

  function handleRemoteMutePayload(payload: CallBonusPayload) {
    if (payload.roomId && matchRoomId && payload.roomId !== matchRoomId) {
      logSafeDebug('[remote-mute]', `ignoredStaleRemoteMuteEvent:true eventRoomId:${payload.roomId} activeRoomId:${matchRoomId}`);
      return;
    }

    if (payload.senderId && payload.senderId === currentUserIdRef.current) {
      return;
    }

    const senderUsername = typeof payload.senderUsername === 'string' && payload.senderUsername.trim().length > 0
      ? payload.senderUsername.trim()
      : partner.username;
    const nextMessage = payload.muted
      ? `${senderUsername} sizi sessize aldı.`
      : `${senderUsername} sesinizi tekrar açtı.`;

    clearRemoteMuteNoticeTimeout();
    setRemoteMuteNoticeMessage(nextMessage);
    logSafeDebug('[remote-mute]', `remoteMuteNoticeReceived:true senderName:${senderUsername} muted:${Boolean(payload.muted)}`);
    logSafeDebug('[remote-mute]', `remoteMuteNoticeShown:true durationMs:${REMOTE_MUTE_NOTICE_DURATION_MS}`);
    remoteMuteNoticeTimeoutRef.current = setTimeout(() => {
      remoteMuteNoticeTimeoutRef.current = null;
      setRemoteMuteNoticeMessage('');
      logSafeDebug('[remote-mute]', 'remoteMuteNoticeHidden:true');
    }, REMOTE_MUTE_NOTICE_DURATION_MS);
  }

  function sendCallBroadcast(event: 'time_bonus' | 'remote_mute', payload: CallBonusPayload, functionName: string) {
    if (!isRealtimeSession || !matchRoomId || !callBonusChannelRef.current) {
      return;
    }

    callBonusChannelRef.current.send({
      type: 'broadcast',
      event,
      payload,
    }).then((status) => {
      if (status !== 'ok') {
        logSafeDebug(`[${event}] broadcast skipped`, `status:${status}`);
      }
    }).catch((error) => {
      logSafeDebug(`[${event}] broadcast failed`, error, {
        functionName,
        source: 'supabase_realtime',
      });
    });
  }

  function sendCallBonus(seconds: number, gift: GiftItem) {
    const eventId = `gift-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload: CallBonusPayload = {
      type: 'gift_bonus',
      eventId,
      seconds,
      bonusSeconds: seconds,
      senderId: currentUserIdRef.current,
      senderUsername: profile.username,
      roomId: matchRoomId,
      giftId: gift.id,
      giftName: gift.name,
      giftSymbol: gift.symbol,
      giftAccent: gift.accent,
      createdAt: new Date().toISOString(),
    };

    handleCallBonusPayload(payload, { forceLocalGift: true });

    sendCallBroadcast('time_bonus', payload, 'sendCallBonus');
  }

  async function disconnectVoiceRoom(reason = 'unspecified') {
    voiceJoinedRef.current = false;
    connectionStartedRef.current = null;
    const result = await leaveRoom({ reason, force: reason === 'screen-unmount' });

    if (result.error) {
      logSafeDebug('[voice] leaveRoom skipped', result.error);
    }
  }

  async function cleanupRealtimeSessionAndGoHome(
    notifyPeer: boolean,
    closeReason = notifyPeer ? 'user-ended-call' : isFriendCallSession ? 'friend-call-ended-event' : 'match-ended-event',
    source = 'cleanupRealtimeSessionAndGoHome',
    status?: string | null,
  ) {
    if (cleanupCompletedRef.current || hasLeftCallRef.current || isEndingRef.current) {
      return;
    }

    logCallNavigation(closeReason, source, status);
    isEndingRef.current = true;
    hasLeftCallRef.current = true;
    stopAllCallSounds();
    stopRingingSound();
    setIsRunning(false);

    const cleanup = sessionEndCleanupRef.current;
    sessionEndCleanupRef.current = null;

    if (cleanup) {
      await cleanup();
    }

    if (notifyPeer) {
      const endResult = isFriendCallSession
        ? await endFriendCallInvite(matchRoomId)
        : await endMatchSessionReliable(matchRoomId, closeReason);

      if (endResult.error) {
        logSafeDebug('[call] end session local cleanup fallback', endResult.error);
      }
    }

    await disconnectVoiceRoom(closeReason);

    const shouldLeaveQueue = shouldLeaveRandomQueueOnUnmount({
      hasLeftCall: false,
      isFriendCallSession,
      isMatched,
      isRealtimeSession,
    });
    logSafeDebug(
      '[match-lifecycle]',
      `unmountCleanup mode:${isFriendCallSession ? 'friend_call' : 'random_match'} roomId:${matchRoomId ?? 'none'} isMatched:${isMatched} shouldLeaveQueue:${shouldLeaveQueue} reason:${closeReason}`,
    );

    if (shouldLeaveQueue) {
      const leaveResult = await leaveQueue();

      if (leaveResult.error) {
        logSafeDebug('[match] leave after end skipped', leaveResult.error);
      }
    }

    cleanupCompletedRef.current = true;
    isEndingRef.current = false;

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }

  async function leaveRealtimeMatchAndGoHome() {
    await cleanupRealtimeSessionAndGoHome(true, 'user-ended-call', 'leaveRealtimeMatchAndGoHome');
  }

  async function returnHomeSafely() {
    stopAllCallSounds();
    stopRingingSound();

    if (isRealtimeSession) {
      await leaveRealtimeMatchAndGoHome();
      return;
    }

    await disconnectVoiceRoom('return-home');
    logCallNavigation('return-home', 'returnHomeSafely');
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

  async function handleToggleRemoteMute() {
    const result = await toggleRemoteMute();

    if (result.error || !result.data) {
      showVoiceError(result.error?.message ?? 'Karşı tarafın sesi güncellenemedi.');
      return;
    }

    setPeerMuted(result.data.remoteMuted);
    logSafeDebug('[remote-mute]', `remoteMuteLocalChanged muted:${result.data.remoteMuted} roomId:${matchRoomId ?? 'none'}`);

    const payload: CallBonusPayload = {
      type: 'remote_mute',
      eventId: `remote-mute-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: currentUserIdRef.current,
      senderUsername: profile.username,
      roomId: matchRoomId,
      muted: result.data.remoteMuted,
      createdAt: new Date().toISOString(),
    };

    sendCallBroadcast('remote_mute', payload, 'handleToggleRemoteMute');
    logSafeDebug('[remote-mute]', `remoteMuteNoticeSent:true muted:${result.data.remoteMuted} roomId:${matchRoomId ?? 'none'}`);
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
    if (!isLiveKitEnabled || isVoiceSessionActive()) {
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
    if (!isLiveKitEnabled || isRealtimeSession) {
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
  }, [isRealtimeSession]);

  useEffect(() => {
    activeCallRoomIdRef.current = matchRoomId;
  }, [matchRoomId]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setLikeResetCountdown(getUntilNextReset());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => () => {
    if (giftBonusTimeoutRef.current) {
      clearTimeout(giftBonusTimeoutRef.current);
      giftBonusTimeoutRef.current = null;
    }

    clearGiftMessageTimeout();
    clearRemoteMuteNoticeTimeout();
  }, []);

  useEffect(() => {
    let mounted = true;

    void getCurrentUser().then((result) => {
      if (mounted) {
        setCurrentUserId(result.data?.id ?? null);
        currentUserIdRef.current = result.data?.id ?? null;
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isFriendCallSession || !isMatched || !partner.id || partner.id === 'waiting') {
      setAlreadyFriends(false);
      return;
    }

    let mounted = true;

    void listFriends().then((result) => {
      if (!mounted) {
        return;
      }

      setAlreadyFriends(Boolean(result.data?.friends.some((friend) => friend.id === partner.id)));
    });

    return () => {
      mounted = false;
    };
  }, [isFriendCallSession, isMatched, partner.id]);

  useEffect(() => {
    if (!isMatched) {
      return;
    }

    let mounted = true;
    void listGiftBalances().then((result) => {
      if (mounted && result.data) {
        setGiftInventory(result.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isMatched]);

  useEffect(() => {
    if (!isFriendCallSession || !route.params?.matchedUserId) {
      return;
    }

    logSafeDebug(
      '[friend-call-avatar] voicecall peer resolved',
      buildFriendCallAvatarLog({
        screen: 'voicecall',
        peerUserId: partner.id,
        rawAvatarId: partner.avatarId,
      }),
    );
  }, [isFriendCallSession, partner.avatarId, partner.id]);

  useEffect(() => {
    if (!isFriendCallSession) {
      return;
    }

    const peerUserId = route.params?.partnerUserId ?? route.params?.matchedUserId;

    if (!peerUserId) {
      return;
    }

    let active = true;

    void getFriendCallPeerProfile(peerUserId).then((result) => {
      if (!active || !result.data) {
        return;
      }

      const resolvedProfile = result.data;
      const avatarMeta = resolveAvatarMeta(resolvedProfile.avatarId);

      setPartner((currentPartner) => {
        if (currentPartner.id !== peerUserId) {
          return currentPartner;
        }

        return {
          ...currentPartner,
          username: resolvedProfile.username || currentPartner.username,
          avatarId: avatarMeta.canonicalId,
          gender: avatarMeta.gender,
          plan: resolvedProfile.plan || currentPartner.plan,
        };
      });
    });

    return () => {
      active = false;
    };
  }, [isFriendCallSession, route.params?.matchedUserId, route.params?.partnerUserId]);

  useEffect(() => {
    let mounted = true;

    const prepareVoice = async () => {
      const tokenEndpoint = getLiveKitTokenEndpointForLog();
      logLiveKitScreen('VoiceCallScreen.prepareVoice', {
        livekitEnabled: isLiveKitEnabled,
        livekitUrlExists: Boolean(process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim()),
        tokenEndpointExists: Boolean(tokenEndpoint),
        tokenEndpoint: tokenEndpoint || 'missing',
      });

      if (!isLiveKitEnabled) {
        logLiveKitScreen('VoiceCallScreen.prepareVoice', {
          mockCall: true,
          reason: 'livekit-disabled-before-permission',
        });
        setMicrophonePermissionGranted(true);
        return;
      }

      const permission = await requestMicrophonePermission();
      logLiveKitScreen('VoiceCallScreen.prepareVoice', {
        microphonePermission: permission.granted ? 'granted' : 'denied',
      });

      if (!mounted) {
        return;
      }

      if (!permission.granted) {
        setMicrophonePermissionGranted(false);
        setPermissionNoticeVisible(true);
        return;
      }

      setMicrophonePermissionGranted(true);
    };

    void prepareVoice();

    return () => {
      mounted = false;
      stopAllCallSounds();
      stopRingingSound();
      logCallNavigation('screen-unmount', 'VoiceCallScreen.unmount', voiceJoinedRef.current ? 'joined' : 'not-joined');
      void disconnectVoiceRoom('screen-unmount');
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
    setAlreadyFriends(false);
    setIncomingFriendRequestId(null);
    setIncomingFriendPrompted(false);
    setGiftVisible(false);
    hideGiftMessage();
    hideRemoteMuteNotice();
    hideGiftOverlay();
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPeerMuted(false);
    reset(callDurationSeconds, true);
    setIsRunning(true);
  }, [callDurationSeconds, isRealtimeSession, realtimePartner, reset, setIsRunning]);

  useEffect(() => {
    if (!isRealtimeSession || !matchRoomId) {
      if (isRealtimeSession && !matchRoomId) {
        logSafeDebug('[match] missing matchRoomId in VoiceCallScreen', {
          routeMatchRoomId: route.params?.matchRoomId,
          routeRoomId: (route.params as { roomId?: string } | undefined)?.roomId,
          activeMatchRoomId: activeMatchSnapshot?.queue.match_room_id,
          activeRoomId: activeMatchSnapshot?.queue.room_id,
        });
      }
      return undefined;
    }

    if (isFriendCallSession) {
      const channel = subscribeToFriendCallRoom(matchRoomId, (invite) => {
        if (shouldAcceptEndEvent('friend', invite.roomId, invite.status, 'friend-realtime')) {
          void cleanupRealtimeSessionAndGoHome(false, 'friend-call-ended-event', 'friend-realtime', invite.status);
        }
      });

      sessionEndCleanupRef.current = channel
        ? async () => {
          await supabase.removeChannel(channel);
        }
        : null;

      sessionEndPollingRef.current = setInterval(() => {
        if (cleanupCompletedRef.current || isEndingRef.current) {
          return;
        }

        void getFriendCallInviteByRoom(matchRoomId).then((result) => {
          if (!result.data) {
            shouldAcceptEndEvent('friend', matchRoomId, 'missing', 'friend-poll');
            return;
          }

          if (shouldAcceptEndEvent('friend', result.data.roomId, result.data.status, 'friend-poll')) {
            void cleanupRealtimeSessionAndGoHome(false, 'friend-call-ended-event', 'friend-poll', result.data.status);
          }
        });
      }, 2000);

      return () => {
        if (sessionEndPollingRef.current) {
          clearInterval(sessionEndPollingRef.current);
          sessionEndPollingRef.current = null;
        }

        const cleanup = sessionEndCleanupRef.current;
        sessionEndCleanupRef.current = null;

        if (cleanup) {
          void cleanup();
        }
      };
    }

    logSafeDebug('[match] listen end session start', { matchRoomId }, { functionName: 'VoiceCallScreen.listenForMatchSessionEndReliable', table: 'matchmaking_queue', rpc: 'end_match_session' });
    const listenResult = listenForMatchSessionEndReliable(matchRoomId, (event) => {
      logSafeDebug('[match] realtime ended event received', { matchRoomId }, { functionName: 'VoiceCallScreen.realtimeEndHandler', table: 'matchmaking_queue' });

      if (shouldAcceptEndEvent('match', event?.eventRoomId ?? matchRoomId, event?.status ?? 'unknown', 'match-realtime')) {
        void cleanupRealtimeSessionAndGoHome(false, 'match-ended-event', 'match-realtime', event?.status);
      }
    });

    sessionEndCleanupRef.current = listenResult.data;
    sessionEndPollingRef.current = setInterval(() => {
      if (cleanupCompletedRef.current || isEndingRef.current) {
        return;
      }

      void getMatchSessionCloseState(matchRoomId).then((result) => {
        const state = result.data;
        const status = state?.status ?? (result.error ? 'error' : 'unknown');

        if (state?.isClosed && shouldAcceptEndEvent(
          'match',
          state.eventRoomId ?? matchRoomId,
          status,
          'match-poll',
          `rows:${state.rowCount} activeRows:${state.activeRows} terminalRows:${state.terminalRows}`,
        )) {
          logSafeDebug('[match-end]', `pollingEndDetected:true activeRoomId:${getActiveCallRoomId() ?? 'none'} eventRoomId:${state.eventRoomId ?? matchRoomId} status:${status}`);
          logSafeDebug('[match] polling ended event received', { matchRoomId }, { functionName: 'VoiceCallScreen.pollSessionEnd', table: 'matchmaking_queue' });
          void cleanupRealtimeSessionAndGoHome(false, 'match-ended-event', 'match-poll', status);
          return;
        }

        shouldAcceptEndEvent(
          'match',
          state?.eventRoomId ?? matchRoomId,
          status,
          'match-poll',
          state ? `rows:${state.rowCount} activeRows:${state.activeRows} terminalRows:${state.terminalRows}` : '',
        );
      });
    }, 2000);

    return () => {
      if (sessionEndPollingRef.current) {
        clearInterval(sessionEndPollingRef.current);
        sessionEndPollingRef.current = null;
      }

      const cleanup = sessionEndCleanupRef.current;
      sessionEndCleanupRef.current = null;

      if (cleanup) {
        void cleanup();
      }
    };
  }, [activeMatchSnapshot?.queue.match_room_id, activeMatchSnapshot?.queue.room_id, isFriendCallSession, isRealtimeSession, matchRoomId, route.params]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isRealtimeSession || !matchRoomId) {
      return undefined;
    }

    const channel = supabase
      .channel(`call-bonus:${matchRoomId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on('broadcast', { event: 'time_bonus' }, ({ payload }) => {
        handleCallBonusPayload(payload as CallBonusPayload);
      })
      .on('broadcast', { event: 'remote_mute' }, ({ payload }) => {
        handleRemoteMutePayload(payload as CallBonusPayload);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logSafeDebug('[call-bonus] realtime reconnect', `status:${status}`);
        }
      });

    callBonusChannelRef.current = channel;

    return () => {
      if (callBonusChannelRef.current === channel) {
        callBonusChannelRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [isRealtimeSession, matchRoomId]);

  useEffect(() => {
    if (!microphonePermissionGranted || !isMatched || voiceJoinedRef.current) {
      return;
    }

    const mode = isFriendCallSession ? 'friend_call' : 'random_match';
    const currentUserReady = Boolean(currentUserId);
    const partnerReady = Boolean(partner.id);
    const roomReady = Boolean(matchRoomId);
    const connectionKey = currentUserReady && partnerReady && roomReady
      ? `${mode}:${currentUserId}:${partner.id}:${matchRoomId}`
      : null;
    const alreadyStarted = Boolean(connectionKey && connectionStartedRef.current === connectionKey);

    logLiveKitScreen('VoiceCallScreen.connectGuard', {
      currentUserReady,
      partnerReady,
      roomReady,
      connectionKey: connectionKey ?? 'missing',
      alreadyStarted,
    });

    if (!connectionKey || alreadyStarted) {
      return;
    }

    connectionStartedRef.current = connectionKey;
    let cancelled = false;

    const connectVoice = async () => {
      stopAllCallSounds();
      stopRingingSound();
      countdownAudioRef.current?.pause();
      countdownAudioRef.current?.seekTo(0).catch(() => undefined);

      logLiveKitScreen('VoiceCallScreen.connectVoice', {
        mode,
        connectVoiceStart: true,
        livekitEnabled: isLiveKitEnabled,
        currentUserId,
        peerUserId: partner.id,
        partnerId: partner.id,
        partnerUsername: partner.username,
        matchRoomId,
        roomId: matchRoomId,
      });

      if (!isLiveKitEnabled) {
        const joinResult = await joinRoom(partner.id, matchRoomId);

        if (cancelled) {
          if (connectionStartedRef.current === connectionKey) {
            connectionStartedRef.current = null;
          }
          return;
        }

        if (joinResult.error || !joinResult.data) {
          logLiveKitScreen('VoiceCallScreen.connectVoice', {
            mode,
            connectVoiceError: joinResult.error?.message ?? 'mock join failed',
            livekitEnabled: isLiveKitEnabled,
            matchRoomId,
            roomId: matchRoomId,
            partnerId: partner.id,
            partnerUsername: partner.username,
          });
          showVoiceError(joinResult.error?.message ?? 'Mock sesli gorusme baslatilamadi.');
          return;
        }

        voiceJoinedRef.current = true;
        setMicEnabled(!joinResult.data.muted);
        setSpeakerEnabled(joinResult.data.speakerEnabled);
        setPeerMuted(joinResult.data.remoteMuted);
        logLiveKitScreen('VoiceCallScreen.connectVoice', {
          mode,
          connectVoiceSuccess: true,
          livekitEnabled: isLiveKitEnabled,
          matchRoomId,
          roomId: matchRoomId,
          partnerId: partner.id,
          partnerUsername: partner.username,
        });
        return;
      }

      const currentUserResult = await getCurrentUser();

      if (cancelled) {
        if (connectionStartedRef.current === connectionKey) {
          connectionStartedRef.current = null;
        }
        return;
      }

      if (currentUserResult.error || !currentUserResult.data?.id) {
        logLiveKitScreen('VoiceCallScreen.connectVoice', {
          mode,
          connectVoiceError: currentUserResult.error?.message ?? 'current user missing',
          livekitEnabled: isLiveKitEnabled,
          matchRoomId,
          roomId: matchRoomId,
          partnerId: partner.id,
          partnerUsername: partner.username,
        });
        showVoiceError(currentUserResult.error?.message ?? 'Sesli gorusme icin kullanici bulunamadi.');
        return;
      }

      const joinResult = await joinRoom(partner.id, matchRoomId);

      if (cancelled) {
        if (connectionStartedRef.current === connectionKey) {
          connectionStartedRef.current = null;
        }
        return;
      }

      if (joinResult.error || !joinResult.data) {
        logLiveKitScreen('VoiceCallScreen.connectVoice', {
          mode,
          connectVoiceError: joinResult.error?.message ?? 'join failed',
          livekitEnabled: isLiveKitEnabled,
          matchRoomId,
          peerUserId: partner.id,
          partnerId: partner.id,
          partnerUsername: partner.username,
          roomId: matchRoomId,
        });
        if (connectionStartedRef.current === connectionKey) {
          connectionStartedRef.current = null;
        }
        showVoiceError(joinResult.error?.message ?? 'Sesli gorusme baslatilamadi. Lutfen tekrar dene.');
        return;
      }

      voiceJoinedRef.current = true;
      setMicEnabled(!joinResult.data.muted);
      setSpeakerEnabled(joinResult.data.speakerEnabled);
      setPeerMuted(joinResult.data.remoteMuted);
      void restoreVoiceAudioSession('voice-call-screen-join-success');
      logLiveKitScreen('VoiceCallScreen.connectVoice', {
        mode,
        connectVoiceSuccess: true,
        livekitEnabled: isLiveKitEnabled,
        matchRoomId,
        roomId: matchRoomId,
        partnerId: partner.id,
        partnerUsername: partner.username,
      });
    };

    void connectVoice();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isFriendCallSession, isMatched, matchRoomId, microphonePermissionGranted, partner.id]);

  useEffect(() => {
    if (isMatched) {
      return;
    }

    if (isRealtimeSession && voiceJoinedRef.current) {
      logSafeDebug(
        '[call-navigation]',
        `phaseNotMatchedIgnored source:VoiceCallScreen.phaseGuard roomId:${matchRoomId ?? 'none'} activeRoomId:${getActiveCallRoomId() ?? 'none'}`,
      );
      return;
    }

    void disconnectVoiceRoom('phase-not-matched');
  }, [isMatched, isRealtimeSession, matchRoomId]);

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

    if (isLiveKitEnabled) {
      return;
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
    for (let offset = 0; offset < demoPartners.length; offset += 1) {
      const candidate = demoPartners[(nextSeed + skipCount + offset) % demoPartners.length];

      if (!blockedUserIds.includes(candidate.id)) {
        return candidate;
      }
    }

    return demoPartners[(nextSeed + skipCount) % demoPartners.length];
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
    setAlreadyFriends(false);
    setPhase('searching');
    setSearchRemaining(SEARCH_SECONDS);
    setMicEnabled(true);
    setSpeakerEnabled(true);
    setPeerMuted(false);
    setGiftVisible(false);
    hideGiftMessage();
    hideRemoteMuteNotice();
    hideGiftOverlay();
    setIncomingFriendRequestId(null);
    setIncomingFriendPrompted(false);
    reset(callDurationSeconds, false);
    setIsRunning(false);
  }

  useEffect(() => {
    if (isRealtimeSession) {
      return;
    }

    if (!isDemoSession) {
      return;
    }

    startSearch(matchSeed);
  }, [blockedIdsKey, isDemoSession, isRealtimeSession, matchSeed, skipCount]);

  useEffect(() => {
    if (isRealtimeSession || !isDemoSession) {
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
          reset(callDurationSeconds, true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [isDemoSession, isRealtimeSession, phase, reset]);

  useEffect(() => {
    if (!isDemoSession || !isMatched || incomingFriendPrompted) {
      return;
    }

    const timerId = setTimeout(() => {
      const request = receiveFriendRequest(getPartnerSummary(partner));
      setIncomingFriendRequestId(request.id);
      setIncomingFriendPrompted(true);
    }, 9000);

    return () => clearTimeout(timerId);
  }, [incomingFriendPrompted, isDemoSession, isMatched, partner, receiveFriendRequest]);

  useEffect(() => {
    if (isRealtimeSession || isDemoSession) {
      return;
    }

    const timerId = setTimeout(() => {
      setWaitingExpired(true);
    }, WAITING_SECONDS * 1000);

    return () => clearTimeout(timerId);
  }, [isDemoSession, isRealtimeSession]);

  useEffect(() => () => {
    const shouldLeaveQueue = shouldLeaveRandomQueueOnUnmount({
      hasLeftCall: hasLeftCallRef.current,
      isFriendCallSession,
      isMatched,
      isRealtimeSession,
    });
    logSafeDebug(
      '[match-lifecycle]',
      `unmountCleanup mode:${isFriendCallSession ? 'friend_call' : 'random_match'} roomId:${matchRoomId ?? 'none'} isMatched:${isMatched} shouldLeaveQueue:${shouldLeaveQueue} reason:screen-unmount`,
    );

    if (shouldLeaveQueue) {
      void leaveQueue();
    }
  }, [isFriendCallSession, isMatched, isRealtimeSession, matchRoomId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      void returnHomeSafely();
      return true;
    });

    return () => subscription.remove();
  }, [isRealtimeSession]);

  function beginNextMatch() {
    if (isRealtimeSession) {
      void cleanupRealtimeSessionAndGoHome(true, 'user-ended-call', 'beginNextMatch');
      return;
    }

    setReviewVisible(false);
    setMatchSeed((current) => current + 1);
  }

  function finishConversation(reason: 'timer-expired' | 'user-ended-call' = 'timer-expired') {
    stopAllCallSounds();
    stopRingingSound();
    setIsRunning(false);

    if (isRealtimeSession) {
      void cleanupRealtimeSessionAndGoHome(true, reason, 'finishConversation');
      return;
    }

    void disconnectVoiceRoom(reason);

    if (autoContinue) {
      beginNextMatch();
      return;
    }

    setReviewVisible(true);
  }

  async function handleGiftSelect(gift: GiftItem) {
    setGiftVisible(false);
    let nextInventory = giftInventory;

    if ((giftInventory[gift.id] ?? 0) <= 0) {
      const purchaseResult = await purchaseGiftCredit(gift, 1);

      if (purchaseResult.error || !purchaseResult.data) {
        showVoiceError(purchaseResult.error?.message ?? 'Hediye hakkı alınamadı.');
        return;
      }

      nextInventory = purchaseResult.data;
      setGiftInventory(purchaseResult.data);
    }

    const consumeResult = await consumeGiftCredit(gift, {
      relatedCallRoomId: matchRoomId,
      recipientUserId: partner.id,
    });

    if (consumeResult.error || !consumeResult.data) {
      showVoiceError(consumeResult.error?.message ?? 'Hediye hakkı kullanılamadı.');
      return;
    }

    setGiftInventory({
      ...nextInventory,
      [gift.id]: consumeResult.data.remaining,
    });
    sendCallBonus(gift.bonusSeconds, gift);
  }

  function handleLike() {
    if (isFriendCallSession || likedThisMatch) {
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
    stopAllCallSounds();
    stopRingingSound();

    if (isRealtimeSession) {
      void cleanupRealtimeSessionAndGoHome(true, 'pass-next-match', 'handlePass');
      return;
    }

    void disconnectVoiceRoom('pass-next-match');
    registerSkip();
    beginNextMatch();
  }

  function handleBlockConfirmed() {
    stopAllCallSounds();
    stopRingingSound();
    blockUser(getPartnerSummary(partner));
    setBlockConfirmVisible(false);
    setReviewVisible(false);

    if (isRealtimeSession) {
      void cleanupRealtimeSessionAndGoHome(true, 'block-user', 'handleBlockConfirmed');
      return;
    }

    void disconnectVoiceRoom('block-user');
    setIsRunning(false);
    beginNextMatch();
  }

  async function handleFriendRequestSend() {
    if (isDemoSession) {
      sendFriendRequest(getPartnerSummary(partner));
      setFriendNoticeMessage('Arkadaşlık isteği gönderildi.');
      setFriendNoticeVisible(true);
      return;
    }

    const result = await sendFriendshipRequest(partner.id);

    if (result.error || !result.data) {
      setFriendNoticeMessage(result.error?.message ?? 'Arkadaşlık isteği gönderilemedi.');
      setFriendNoticeVisible(true);
      return;
    }

    if (result.data === 'already_friends') {
      setFriendNoticeMessage('Bu kullanıcı zaten arkadaşın.');
    } else if (result.data === 'already_pending') {
      setFriendNoticeMessage('Arkadaşlık isteği zaten gönderilmiş.');
    } else {
      setFriendNoticeMessage('Arkadaşlık isteği gönderildi.');
    }

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

  if (!isRealtimeSession && !isDemoSession) {
    return (
      <LinearGradient colors={[...gradients.background]} style={styles.screen}>
        <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
          <View
            style={[
              styles.waitingShell,
              {
                paddingBottom: screenLayout.contentBottomPadding,
                paddingHorizontal: metrics.horizontalPadding,
                paddingTop: screenLayout.contentTopPadding,
              },
            ]}
          >
            <ActivityIndicator color={colors.cyan} size="large" />
            <Text style={styles.waitingTitle}>Seni anlayacak biri aranıyor...</Text>
            <Text style={styles.waitingSubtitle}>
              {waitingExpired
                ? 'Şu anda uygun kullanıcı bulunamadı. Biraz sonra tekrar deneyebilirsin.'
                : 'Uygun kullanıcı aranıyor...'}
            </Text>
            <Pressable onPress={() => void returnHomeSafely()} style={styles.waitingButton}>
              <Ionicons color={colors.text} name="close" size={18} />
              <Text style={styles.waitingButtonText}>{waitingExpired ? 'Geri Dön' : 'İptal Et'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.screen}>
      <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbMiddle]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View
          style={[
            styles.shell,
            {
              paddingHorizontal: metrics.horizontalPadding,
              paddingBottom: screenLayout.contentBottomPadding,
              paddingTop: screenLayout.contentTopPadding,
              gap: metrics.gap,
            },
          ]}
        >
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  void returnHomeSafely();
                }}
                style={[styles.backButton, { width: metrics.headerButton, height: metrics.headerButton, borderRadius: metrics.headerButton / 2 }]}
              >
                <Ionicons color={colors.text} name="chevron-back" size={metrics.headerButton * 0.55} />
              </Pressable>

              <View style={styles.headerCopy}>
                <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.headerTitle}>
                  {isFriendCallSession ? 'Arkadaş Görüşmesi' : 'Eşleştirme'}
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.headerSubtitle}>
                  {isFriendCallSession ? 'Arkadaşınla güvenli görüşme' : 'Seni anlayacak biri aranıyor...'}
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
                  <UserAvatar
                    avatarId={partner.avatarId}
                    avatarSourceType={route.params?.partnerAvatarId ? 'route-param' : 'peer-profile'}
                    currentUserId={currentUserId}
                    renderedUserId={partner.id}
                    screen="voicecall"
                    size={metrics.avatar}
                    username={partner.username}
                  />
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
                {!isFriendCallSession && alreadyFriends ? (
                  <View style={[styles.sideActionButton, styles.sideActionDisabled, { height: metrics.sideButtonHeight }]}>
                    <Ionicons color={colors.goldSoft} name="checkmark-circle" size={16} />
                    <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.sideActionText, styles.sideActionDisabledText]}>
                      Siz arkadaşsınız
                    </Text>
                  </View>
                ) : !isFriendCallSession ? (
                  <Pressable onPress={() => void handleFriendRequestSend()} style={[styles.sideActionButton, { height: metrics.sideButtonHeight }]}>
                    <Ionicons color={colors.text} name="person-add" size={16} />
                    <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.sideActionText}>
                      Arkadaş Ekle
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={() => void handleToggleRemoteMute()} style={[styles.sideActionButton, styles.sideActionDanger, { height: metrics.sideButtonHeight }]}>
                  <Ionicons color={colors.danger} name={peerMuted ? 'volume-high' : 'volume-mute'} size={16} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={styles.sideActionText}>
                    {peerMuted ? 'Sesi Aç' : 'Sessize Al'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {!isFriendCallSession ? (
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
          ) : null}

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
                remainingSeconds={isMatched ? remainingSeconds : searchRemaining}
                segmentCount={76}
                size={metrics.ring}
                subtitle={isMatched ? 'Kalan Süre' : 'Bağlanıyor...'}
                title={isMatched ? 'Görüşme Başladı' : 'Seni anlayacak biri aranıyor...'}
                titleIcon={isMatched ? 'people' : 'pulse'}
                tone="purple"
                totalSeconds={isMatched ? Math.max(callDurationSeconds, remainingSeconds) : SEARCH_SECONDS}
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
                  <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={2} style={styles.giftButtonText}>
                    Hediye{'\n'}Gönder
                  </Text>
                </LinearGradient>
                </Pressable>
              </View>
              {giftPersistentMessage || remoteMuteNoticeMessage ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.callInfoOverlay,
                    {
                      bottom: metrics.short ? -16 : -14,
                    },
                  ]}
                >
                  {giftPersistentMessage ? (
                    <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={styles.callInfoText}>
                      {giftPersistentMessage}
                    </Text>
                  ) : null}
                  {remoteMuteNoticeMessage ? (
                    <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={[styles.callInfoText, styles.remoteMuteInfoText]}>
                      {remoteMuteNoticeMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.bottomSection, isFriendCallSession && styles.bottomSectionFriend]}>
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

            {!isFriendCallSession ? (
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
            ) : null}

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
                  icon={speakerEnabled ? 'volume-high' : 'phone-portrait'}
                  label={speakerEnabled ? 'Hoparlör' : 'Ahize'}
                  onPress={() => void handleToggleSpeaker()}
                  size={metrics.controlSize}
                />
                <Pressable onPress={() => finishConversation('user-ended-call')} style={styles.endCallButton}>
                  <LinearGradient colors={['#FF6E8B', '#D61E50']} style={[styles.endCallGradient, { width: metrics.endSize, height: metrics.endSize, borderRadius: metrics.endSize / 2 }]}>
                    <Ionicons color={colors.text} name="call" size={metrics.endSize * 0.42} style={styles.endCallIcon} />
                  </LinearGradient>
                  <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.endCallText}>
                    Bitir
                  </Text>
                </Pressable>
              </View>

              {!isFriendCallSession ? (
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
              ) : null}
            </View>
          </View>
        </View>
      </SafeAreaView>

      <GiftModal inventory={giftInventory} onClose={() => setGiftVisible(false)} onSelect={handleGiftSelect} visible={giftVisible} />
      <GiftCelebrationOverlay caption={giftOverlayCaption} gift={selectedGift} visible={giftOverlayVisible} />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setFriendNoticeVisible(false), variant: 'secondary' }]}
        message={friendNoticeMessage}
        title="İstek gönderildi"
        visible={friendNoticeVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setPermissionNoticeVisible(false), variant: 'secondary' }]}
        message="Mikrofon izni olmadan konuşma yapılamaz"
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

              logCallNavigation('review-reward-home', 'reviewModal.reward', 'reviewed');
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

              logCallNavigation('review-penalty-home', 'reviewModal.penalty', 'reviewed');
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
        visible={!isFriendCallSession && likeNoticeVisible}
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
        visible={!isFriendCallSession && likeLimitVisible}
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
    maxWidth: 720,
    alignSelf: 'center',
  },
  waitingShell: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  waitingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  waitingSubtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  waitingButton: {
    minWidth: 136,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  waitingButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
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
  sideActionDisabled: {
    borderColor: 'rgba(255, 218, 138, 0.24)',
    backgroundColor: 'rgba(82, 61, 28, 0.36)',
  },
  sideActionText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  sideActionDisabledText: {
    color: colors.goldSoft,
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
  callInfoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
    zIndex: 6,
  },
  callInfoText: {
    width: '92%',
    maxWidth: 360,
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    textAlign: 'center',
  },
  remoteMuteInfoText: {
    color: colors.goldSoft,
  },
  bottomSection: {
    flex: 2.15,
    justifyContent: 'space-between',
  },
  bottomSectionFriend: {
    justifyContent: 'flex-end',
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
