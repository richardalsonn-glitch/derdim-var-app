import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionCard } from '../components/home/ActionCard';
import { AutoCallCard } from '../components/home/AutoCallCard';
import { BottomTabBar, BottomTabItem } from '../components/home/BottomTabBar';
import { DrawerMenu } from '../components/home/DrawerMenu';
import { FeatureGrid } from '../components/home/FeatureGrid';
import { ProfileCard } from '../components/home/ProfileCard';
import { ThemeToggle } from '../components/home/ThemeToggle';
import { DrawerItem, FeatureItem, HomePalette } from '../components/home/types';
import { NoticeModal } from '../components/NoticeModal';
import { isLiveKitEnabled } from '../config/features';
import { colors, radius } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { listUnreadNotifications, subscribeToNotifications } from '../services/notificationService';
import { getCurrentUser, signOut } from '../services/authService';
import { findMatch, joinQueue, leaveQueue, listenForMatch } from '../services/matchService';
import { requestMicrophonePermission } from '../services/permissionsService';
import { listFriends, listThreads, subscribeToFriendships, subscribeToThreads } from '../services/socialService';
import { MatchRole, MatchmakingMode, UiTheme } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getScreenLayout } from '../utils/responsive';
import { getHomeResponsiveMetrics } from '../utils/voiceCallUiState';

const AUTO_CALL_SECONDS = 45;
const MATCH_WAIT_TIMEOUT_MS = 30000;
let autoCallDeadlineAt: number | null = null;

type PendingAction =
  | { type: 'role'; role: MatchRole }
  | { type: 'route'; route: 'NightMode' | 'SilentScream' }
  | null;

type HomeMetrics = {
  compact: boolean;
  short: boolean;
  sidePadding: number;
  topPadding: number;
  contentPaddingBottom: number;
  gap: number;
  ctaGap: number;
  topHeight: number;
  profileHeight: number;
  ctaBlockHeight: number;
  ctaCardHeight: number;
  autoHeight: number;
  featureBlockHeight: number;
  featureCardHeight: number;
  featureOffset: number;
  iconButton: number;
  veryShort: boolean;
  contentMaxWidth: number;
  bottomTab: ReturnType<typeof getScreenLayout>['bottomTab'];
};

const drawerItems: DrawerItem[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'profile', label: 'Profilim', icon: 'person' },
  { key: 'chats', label: 'Sohbetler', icon: 'chatbubbles' },
  { key: 'friends', label: 'Arkadaşlar', icon: 'people' },
  { key: 'packages', label: 'Paketler', icon: 'diamond' },
  { key: 'badges', label: 'Rozet Sistemi', icon: 'shield-half' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
  { key: 'logout', label: 'Çıkış Yap', icon: 'log-out' },
];

const baseBottomTabs: BottomTabItem[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'chats', label: 'Sohbetler', icon: 'chatbox-ellipses' },
  { key: 'gifts', label: 'Hediyeler', icon: 'gift' },
  { key: 'friends', label: 'Arkadaşlar', icon: 'people' },
  { key: 'notifications', label: 'Ayarlar', icon: 'settings' },
];

function formatAutoCall(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`;
}

function getAutoCallRemainingSeconds() {
  if (!autoCallDeadlineAt) {
    return AUTO_CALL_SECONDS;
  }

  return Math.max(0, Math.ceil((autoCallDeadlineAt - Date.now()) / 1000));
}

function startAutoCallDeadline() {
  autoCallDeadlineAt = Date.now() + AUTO_CALL_SECONDS * 1000;
}

function clearAutoCallDeadline() {
  autoCallDeadlineAt = null;
}

function getMatchmakingMode(role: MatchRole): MatchmakingMode {
  return role === 'derdim-var' ? 'derdim' : 'derman';
}

function getPlanDisplayName(plan: string) {
  if (plan === 'vip') {
    return 'VIP';
  }

  if (plan === 'plus') {
    return 'Plus';
  }

  return 'Ücretsiz';
}

function getPalette(theme: UiTheme): HomePalette {
  if (theme === 'light') {
    return {
      theme,
      background: ['#140C21', '#241537', '#30184A'],
      orbPrimary: 'rgba(255, 98, 193, 0.18)',
      orbSecondary: 'rgba(87, 164, 255, 0.18)',
      surface: 'rgba(255,255,255,0.10)',
      surfaceStrong: 'rgba(22, 16, 48, 0.94)',
      border: 'rgba(255,255,255,0.16)',
      text: '#FFF7FF',
      muted: '#DBC7F3',
      dim: '#B49ECB',
      pink: '#FF63C8',
      purple: '#A64BFF',
      blue: '#4E87FF',
      cyan: '#59D0FF',
      gold: '#FFD36B',
      green: '#40F080',
      tabInactive: '#BCAFD2',
      shadow: 'rgba(127, 74, 255, 0.38)',
    };
  }

  return {
    theme,
    background: ['#040713', '#090B20', '#110822'],
    orbPrimary: 'rgba(255, 79, 185, 0.16)',
    orbSecondary: 'rgba(69, 224, 255, 0.14)',
    surface: 'rgba(255,255,255,0.08)',
    surfaceStrong: 'rgba(11, 13, 35, 0.92)',
    border: 'rgba(190, 132, 255, 0.18)',
    text: '#F8EFFF',
    muted: '#BBB5D8',
    dim: '#7F7BA1',
    pink: '#FF4FB9',
    purple: '#9C49FF',
    blue: '#4E83FF',
    cyan: '#50D5FF',
    gold: '#FFD36B',
    green: '#36F07B',
    tabInactive: '#ABA6C5',
    shadow: 'rgba(101, 50, 194, 0.42)',
  };
}

function getFeatureItems(): FeatureItem[] {
  return [
    {
      key: 'night',
      title: 'Gece Modu',
      subtitle: '22:00 - 06:00',
      icon: 'moon',
      accent: '#F5C84D',
      glow: 'rgba(245, 200, 77, 0.3)',
    },
    {
      key: 'silent',
      title: 'Dert Sıra Gecesi',
      subtitle: 'En az 4 katılımcı gerekir',
      icon: 'mic',
      accent: '#FF5BB2',
      glow: 'rgba(255, 91, 178, 0.28)',
    },
    {
      key: 'packages',
      title: 'Paketler',
      subtitle: 'Plus ve VIP paketleri incele',
      icon: 'diamond',
      accent: '#5DAFFF',
      glow: 'rgba(93, 175, 255, 0.26)',
    },
    {
      key: 'rematch',
      title: 'Tekrar Eşleşme',
      subtitle: 'Kaçırdığın kişiyi tekrar bul',
      icon: 'refresh',
      accent: '#6AF2BD',
      glow: 'rgba(106, 242, 189, 0.24)',
    },
    {
      key: 'badges',
      title: 'Rozet Sistemi',
      subtitle: 'Level atla, rozetleri topla',
      icon: 'shield-half',
      accent: '#AF70FF',
      glow: 'rgba(175, 112, 255, 0.28)',
    },
    {
      key: 'letters',
      title: 'Anonim Mektup Kutusu',
      subtitle: 'Sana gelen iyi dilekler',
      icon: 'mail',
      accent: '#FF79C7',
      glow: 'rgba(255, 121, 199, 0.26)',
    },
  ];
}

function getMetrics(width: number, height: number, insetsTop: number, insetsBottom: number): HomeMetrics {
  const screen = getScreenLayout(
    { width, height },
    { top: insetsTop, bottom: insetsBottom, left: 0, right: 0 },
    { bottomInsetMode: 'bottom-tab' },
  );
  const responsive = getHomeResponsiveMetrics({ width, height });
  const compact = responsive.compact;
  const short = responsive.short;
  const sidePadding = screen.horizontalPadding;
  const topPadding = screen.contentTopPadding;
  const gap = responsive.gap;
  const ctaGap = responsive.ctaGap;
  const contentPaddingBottom = screen.contentBottomPadding;
  const available = height - topPadding - contentPaddingBottom - gap * 4;
  const topHeight = Math.round(Math.min(responsive.veryShort ? 46 : 60, Math.max(responsive.veryShort ? 40 : 48, available * 0.07)));
  const profileHeight = Math.round(Math.min(responsive.veryShort ? 104 : 132, Math.max(responsive.veryShort ? 92 : 110, available * 0.145)));
  const ctaCardHeightBase = Math.round(Math.min(220, Math.max(responsive.veryShort ? 96 : 176, available * 0.215)));
  const ctaCardHeight = Math.max(responsive.ctaCardMinHeight, Math.min(responsive.ctaCardMaxHeight, Math.round(ctaCardHeightBase * 0.82)));
  const ctaBlockHeight = ctaCardHeight * 2 + ctaGap;
  const autoHeight = Math.round(Math.min(responsive.autoMaxHeight, Math.max(responsive.autoMinHeight, available * 0.086)));
  const featureOffset = responsive.featureOffset;
  const featureBlockHeight = Math.max(responsive.featureBlockMinHeight, available - topHeight - profileHeight - ctaBlockHeight - autoHeight - featureOffset);
  const featureCardHeight = Math.max(responsive.featureCardMinHeight, Math.floor((featureBlockHeight - gap * 2) / 3));
  const contentMaxWidth = screen.contentMaxWidth;

  return {
    compact,
    short,
    sidePadding,
    topPadding,
    contentPaddingBottom,
    gap,
    ctaGap,
    topHeight,
    profileHeight,
    ctaBlockHeight,
    ctaCardHeight,
    autoHeight,
    featureBlockHeight,
    featureCardHeight,
    featureOffset,
    iconButton: responsive.iconButton,
    contentMaxWidth,
    bottomTab: screen.bottomTab,
    veryShort: responsive.veryShort,
  };
}

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const {
    profile,
    setActiveRole,
    setAutoCallEnabled,
    uiTheme,
    toggleUiTheme,
    userScore,
    userLevel,
  } = useAppState();
  const palette = useMemo(() => getPalette(uiTheme), [uiTheme]);
  const featureItems = useMemo(() => getFeatureItems(), []);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = useMemo(() => getMetrics(width, height, insets.top, insets.bottom), [height, insets.bottom, insets.top, width]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(getAutoCallRemainingSeconds);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState('Bu alan');
  const [activeTab, setActiveTab] = useState('home');
  const [matchErrorVisible, setMatchErrorVisible] = useState(false);
  const [matchErrorMessage, setMatchErrorMessage] = useState('Eşleşme şu anda başlatılamadı.');
  const [matchWaitingVisible, setMatchWaitingVisible] = useState(false);
  const [isJoiningQueue, setIsJoiningQueue] = useState(false);
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fadeValue = useRef(new Animated.Value(0)).current;
  const matchmakingRequestRef = useRef(0);
  const matchmakingPhaseRef = useRef<'idle' | 'waiting' | 'matched'>('idle');
  const isJoiningQueueRef = useRef(false);
  const matchListenerCleanupRef = useRef<null | (() => Promise<void>)>(null);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomTabs = useMemo(
    () =>
      baseBottomTabs.map((item) => {
        if (item.key === 'friends') {
          return { ...item, badgeCount: pendingFriendRequestCount };
        }

        if (item.key === 'chats') {
          return { ...item, badgeCount: unreadChatCount };
        }

        if (item.key === 'notifications') {
          return { ...item, badgeCount: unreadNotificationCount };
        }

        return item;
      }),
    [pendingFriendRequestCount, unreadChatCount, unreadNotificationCount],
  );

  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fadeValue]);

  useEffect(() => {
    let mounted = true;

    async function resolveCurrentUser() {
      const userResult = await getCurrentUser();

      if (!mounted) {
        return;
      }

      setCurrentUserId(userResult.data?.id ?? null);
    }

    void resolveCurrentUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    let mounted = true;

    async function refreshBadges() {
      const [friendResult, threadResult, notificationResult] = await Promise.all([
        listFriends(),
        listThreads(),
        listUnreadNotifications(currentUserId ?? undefined),
      ]);

      if (!mounted) {
        return;
      }

      setPendingFriendRequestCount(friendResult.data?.incomingRequests.length ?? 0);
      setUnreadChatCount((threadResult.data ?? []).reduce((total, thread) => total + thread.unreadCount, 0));
      setUnreadNotificationCount(notificationResult.data?.length ?? 0);
    }

    void refreshBadges();
    const friendChannel = subscribeToFriendships(() => {
      void refreshBadges();
    }, currentUserId);
    const threadChannel = subscribeToThreads(() => {
      void refreshBadges();
    }, currentUserId);
    const notificationChannel = subscribeToNotifications(currentUserId, () => {
      void refreshBadges();
    });
    const refreshInterval = setInterval(() => {
      void refreshBadges();
    }, 45000);

    return () => {
      mounted = false;
      clearInterval(refreshInterval);

      if (friendChannel) {
        void friendChannel.unsubscribe();
      }

      if (threadChannel) {
        void threadChannel.unsubscribe();
      }

      if (notificationChannel) {
        void notificationChannel.unsubscribe();
      }
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!profile.autoCallEnabled) {
      clearAutoCallDeadline();
      setAutoCallCountdown(AUTO_CALL_SECONDS);
      return;
    }

    if (!autoCallDeadlineAt) {
      startAutoCallDeadline();
      setAutoCallCountdown(getAutoCallRemainingSeconds());
    }

    const remainingSeconds = getAutoCallRemainingSeconds();

    if (remainingSeconds <= 0) {
      void openVoiceRole('derdim-var');
      startAutoCallDeadline();
      setAutoCallCountdown(getAutoCallRemainingSeconds());
      return;
    }

    const timerId = setTimeout(() => {
      setAutoCallCountdown(getAutoCallRemainingSeconds());
    }, 1000);

    return () => clearTimeout(timerId);
  }, [autoCallCountdown, navigation, profile.autoCallEnabled]);

  useEffect(() => {
    if (profile.autoCallEnabled) {
      if (!autoCallDeadlineAt) {
        startAutoCallDeadline();
      }

      setAutoCallCountdown(getAutoCallRemainingSeconds());
      return;
    }

    clearAutoCallDeadline();
    setAutoCallCountdown(AUTO_CALL_SECONDS);
  }, [profile.autoCallEnabled]);

  function resetAutoCall() {
    if (profile.autoCallEnabled) {
      startAutoCallDeadline();
      setAutoCallCountdown(getAutoCallRemainingSeconds());
    }
  }

  function clearMatchTimeout() {
    if (matchTimeoutRef.current) {
      clearTimeout(matchTimeoutRef.current);
      matchTimeoutRef.current = null;
    }
  }

  function clearMatchPoll() {
    if (matchPollRef.current) {
      clearInterval(matchPollRef.current);
      matchPollRef.current = null;
    }
  }

  async function stopMatchmaking() {
    matchmakingRequestRef.current += 1;
    matchmakingPhaseRef.current = 'idle';
    clearMatchTimeout();
    clearMatchPoll();
    setMatchWaitingVisible(false);

    const cleanup = matchListenerCleanupRef.current;
    matchListenerCleanupRef.current = null;

    if (cleanup) {
      await cleanup();
    }

    const result = await leaveQueue();

    if (result.error) {
      console.warn('[match] leaveQueue failed:', result.error.message);
    }
  }

  function showMatchError(message: string) {
    setMatchWaitingVisible(false);
    setMatchErrorMessage(message);
    setMatchErrorVisible(true);
  }

  function openMatchedVoiceCall(state?: Awaited<ReturnType<typeof findMatch>>['data']) {
    matchmakingPhaseRef.current = 'matched';
    clearMatchTimeout();
    clearMatchPoll();
    setMatchWaitingVisible(false);
    const partner = state?.partnerProfile;

    navigation.reset({
      index: 0,
      routes: [{
        name: 'VoiceCall',
        params: {
          matchReady: true,
          matchedUserId: partner?.userId,
          partnerName: partner?.username,
          partnerAvatarId: partner?.avatarId,
          matchRoomId: state?.queue.match_room_id ?? state?.queue.room_id ?? undefined,
        },
      }],
    });
  }

  async function startMatchmaking(role: MatchRole) {
    const requestId = Date.now();
    matchmakingRequestRef.current = requestId;
    matchmakingPhaseRef.current = 'waiting';
    setMatchWaitingVisible(true);
    setActiveRole(role);

    const joinResult = await joinQueue(getMatchmakingMode(role));

    if (matchmakingRequestRef.current !== requestId) {
      return;
    }

    if (joinResult.error || !joinResult.data) {
      matchmakingPhaseRef.current = 'idle';
      showMatchError(getFriendlyErrorMessage(joinResult.error, 'Eşleşme başlatılamadı. Lütfen tekrar deneyin.'));
      return;
    }

    if (joinResult.data.queue.status === 'matched') {
      openMatchedVoiceCall(joinResult.data);
      return;
    }

    clearMatchTimeout();
    matchTimeoutRef.current = setTimeout(() => {
      if (matchmakingRequestRef.current !== requestId || matchmakingPhaseRef.current !== 'waiting') {
        return;
      }

      void stopMatchmaking();
      showMatchError('Şu anda uygun kullanıcı bulunamadı. Biraz sonra tekrar deneyebilirsin.');
    }, MATCH_WAIT_TIMEOUT_MS);

    clearMatchPoll();
    matchPollRef.current = setInterval(async () => {
      if (matchmakingRequestRef.current !== requestId || matchmakingPhaseRef.current !== 'waiting') {
        return;
      }

      const pollResult = await findMatch();

      if (pollResult.data?.queue.status === 'matched') {
        openMatchedVoiceCall(pollResult.data);
      }
    }, 1500);

    const listenResult = await listenForMatch((state) => {
      if (matchmakingRequestRef.current !== requestId) {
        return;
      }

      matchListenerCleanupRef.current = null;
      openMatchedVoiceCall(state);
    });

    if (matchmakingRequestRef.current !== requestId) {
      return;
    }

    if (listenResult.error || !listenResult.data) {
      matchmakingPhaseRef.current = 'idle';
      await leaveQueue();
      showMatchError(getFriendlyErrorMessage(listenResult.error, 'Eşleşme başlatılamadı. Lütfen tekrar deneyin.'));
      return;
    }

    matchListenerCleanupRef.current = listenResult.data;
  }

  async function openVoiceRole(role: MatchRole) {
    if (profile.isFrozen) {
      navigation.reset({ index: 0, routes: [{ name: 'FrozenAccount' }] });
      return;
    }

    if (isJoiningQueueRef.current) {
      return;
    }

    isJoiningQueueRef.current = true;
    setIsJoiningQueue(true);
    resetAutoCall();
    setPendingAction({ type: 'role', role });

    try {
      if (isLiveKitEnabled) {
        const result = await requestMicrophonePermission();

        if (!result.granted) {
          setPermissionModalVisible(true);
          return;
        }
      }

      await stopMatchmaking();
      await startMatchmaking(role);
    } finally {
      isJoiningQueueRef.current = false;
      setIsJoiningQueue(false);
    }
  }

  async function openVoiceFeature(route: 'NightMode' | 'SilentScream') {
    setPendingAction({ type: 'route', route });

    if (route === 'NightMode' && isLiveKitEnabled) {
      const result = await requestMicrophonePermission();

      if (!result.granted) {
        setPermissionModalVisible(true);
        return;
      }
    }

    navigation.navigate(route);
  }

  function showComingSoon(title: string) {
    setComingSoonTitle(title);
    setComingSoonVisible(true);
  }

  async function handleLogout() {
    await stopMatchmaking();
    const result = await signOut();

    if (result.error) {
      console.warn('[auth] signOut failed:', result.error.message);
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Splash' }],
    });
  }

  function handleFeaturePress(item: FeatureItem) {
    if (matchmakingPhaseRef.current === 'waiting') {
      void stopMatchmaking();
    }

    switch (item.key) {
      case 'night':
        void openVoiceFeature('NightMode');
        break;
      case 'silent':
        void openVoiceFeature('SilentScream');
        break;
      case 'packages':
        navigation.navigate('Packages');
        break;
      case 'rematch':
        navigation.navigate('Rematch');
        break;
      case 'badges':
        navigation.navigate('Badges');
        break;
      case 'letters':
        navigation.navigate('Letters');
        break;
      default:
        showComingSoon(item.title);
    }
  }

  function handleDrawerSelect(item: DrawerItem) {
    setDrawerVisible(false);
    if (matchmakingPhaseRef.current === 'waiting') {
      void stopMatchmaking();
    }

    switch (item.key) {
      case 'home':
        return;
      case 'profile':
        navigation.navigate('Profile');
        return;
      case 'friends':
        navigation.navigate('Friends');
        return;
      case 'chats':
        navigation.navigate('Chat');
        return;
      case 'notifications':
        navigation.navigate('Settings');
        return;
      case 'packages':
        navigation.navigate('Packages');
        return;
      case 'badges':
        navigation.navigate('Badges');
        return;
      case 'settings':
        navigation.navigate('Settings');
        return;
      case 'logout':
        void handleLogout();
        return;
      default:
        showComingSoon(item.label);
    }
  }

  function handleBottomTabSelect(item: BottomTabItem) {
    setActiveTab(item.key);
    if (matchmakingPhaseRef.current === 'waiting') {
      void stopMatchmaking();
    }

    switch (item.key) {
      case 'home':
        return;
      case 'friends':
        navigation.navigate('Friends');
        return;
      case 'chats':
        navigation.navigate('Chat');
        return;
      case 'gifts':
        navigation.navigate('Gifts');
        return;
      case 'notifications':
        navigation.navigate('Settings');
        return;
      default:
        showComingSoon(item.label);
    }
  }

  async function retryPendingAction() {
    setPermissionModalVisible(false);

    if (!pendingAction) {
      return;
    }

    if (pendingAction.type === 'role') {
      await openVoiceRole(pendingAction.role);
      return;
    }

    await openVoiceFeature(pendingAction.route);
  }

  useEffect(() => () => {
    if (matchmakingPhaseRef.current === 'waiting') {
      void stopMatchmaking();
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && matchmakingPhaseRef.current === 'waiting') {
        void stopMatchmaking();
      }
    });

    return () => subscription.remove();
  }, []);

  const profileData = {
    username: profile.username,
    plan: profile.plan,
    score: userScore / 20,
    level: userLevel,
    progress: Math.max(0.14, Math.min(0.96, (userScore % 100) / 100 || 0.65)),
    message: 'Bugün sana iyi gelecek birisini bulabilirsin.',
  } as const;

  return (
    <LinearGradient colors={[...palette.background]} style={styles.screen}>
      <View pointerEvents="none" style={[styles.orb, styles.orbTop, { backgroundColor: palette.orbPrimary }]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbRight, { backgroundColor: palette.orbSecondary }]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom, { backgroundColor: palette.orbPrimary }]} />

      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: metrics.contentPaddingBottom,
              paddingHorizontal: metrics.sidePadding,
              paddingTop: metrics.topPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.page,
              {
                gap: metrics.gap,
                maxWidth: metrics.contentMaxWidth,
                minHeight: height - metrics.topPadding - metrics.contentPaddingBottom,
                opacity: fadeValue,
                transform: [
                  {
                    translateY: fadeValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
        >
          <View style={[styles.topBar, { height: metrics.topHeight }]}>
            <Pressable
              onPress={() => {
                setDrawerVisible(true);
              }}
              style={[
                styles.iconButton,
                {
                  width: metrics.iconButton,
                  height: metrics.iconButton,
                  borderRadius: metrics.iconButton / 2,
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                },
              ]}
            >
              <Ionicons color={palette.text} name="menu" size={22} />
            </Pressable>

            <ThemeToggle compact={metrics.compact} mode={uiTheme} onToggle={toggleUiTheme} palette={palette} />
          </View>

          <View style={{ height: metrics.profileHeight }}>
            <ProfileCard
              avatarId={profile.avatarId}
              compact={metrics.compact}
              currentUserId={currentUserId}
              data={profileData}
              fallbackGender={profile.gender}
              onPress={() => navigation.navigate('Profile')}
              palette={palette}
            />
          </View>

          <View style={{ height: metrics.ctaBlockHeight, gap: metrics.ctaGap }}>
            <View style={{ height: metrics.ctaCardHeight }}>
              <ActionCard
              compact
              glowColor="rgba(255, 86, 180, 0.34)"
              gradient={['#FF4A7A', '#FF3FA7', '#9426C8']}
              height={metrics.ctaCardHeight}
              icon="heart"
              dense={metrics.veryShort}
              disabled={isJoiningQueue}
              onPress={() => void openVoiceRole('derdim-var')}
              palette={palette}
              subtitle="İçimi dökmek istiyorum"
              title="DERDİM VAR"
              />
            </View>
            <View style={{ height: metrics.ctaCardHeight }}>
              <ActionCard
              compact
              glowColor="rgba(79, 131, 255, 0.3)"
              gradient={['#8A3CFF', '#5D34FF', '#245CFF']}
              height={metrics.ctaCardHeight}
              icon="headset"
              dense={metrics.veryShort}
              disabled={isJoiningQueue}
              onPress={() => void openVoiceRole('derman-olan')}
              palette={palette}
              subtitle="Birini dinlemek istiyorum"
              title="DERMAN OL"
              />
            </View>
          </View>

          <View style={{ height: metrics.autoHeight, marginTop: 2 }}>
            <AutoCallCard
              compact
              dense={metrics.veryShort}
              counterLabel={profile.autoCallEnabled ? formatAutoCall(autoCallCountdown) : 'Kapalı'}
              enabled={profile.autoCallEnabled}
              onToggle={() => {
                setAutoCallEnabled(!profile.autoCallEnabled);
                setAutoCallCountdown(AUTO_CALL_SECONDS);
              }}
              palette={palette}
            />
          </View>

          <View style={{ height: metrics.featureBlockHeight, marginTop: metrics.featureOffset }}>
            <FeatureGrid cardHeight={metrics.featureCardHeight} compact dense={metrics.veryShort} items={featureItems} onSelect={handleFeaturePress} palette={palette} />
          </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <View
        pointerEvents="box-none"
        style={[
          styles.bottomTabBar,
          {
            bottom: 0,
            height: metrics.bottomTab.containerHeight,
            paddingBottom: metrics.bottomTab.bottomInset,
            paddingHorizontal: metrics.bottomTab.sideMargin,
          },
        ]}>
        <View style={[styles.bottomTabInner, { height: metrics.bottomTab.barHeight, maxWidth: metrics.bottomTab.maxWidth }]}>
          <BottomTabBar activeKey={activeTab} compact={metrics.compact} items={bottomTabs} onSelect={handleBottomTabSelect} palette={palette} />
        </View>
      </View>

      <DrawerMenu
        avatarId={profile.avatarId}
        currentUserId={currentUserId}
        fallbackGender={profile.gender}
        items={drawerItems}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleDrawerSelect}
        palette={palette}
        planLabel={`${getPlanDisplayName(profile.plan)} • Level ${userLevel}`}
        username={profile.username}
        visible={drawerVisible}
      />

      <NoticeModal
        actions={[
          { label: 'Tekrar Dene', onPress: () => void retryPendingAction(), variant: 'secondary' },
          { label: 'Şimdilik Vazgeç', onPress: () => setPermissionModalVisible(false), variant: 'ghost' },
        ]}
        message="Sesli deneyim için mikrofon izni gerekli."
        title="Mikrofon izni gerekli"
        visible={permissionModalVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setComingSoonVisible(false), variant: 'secondary' }]}
        message={`${comingSoonTitle} alanı güvenli kullanım için hazırlandı. Ana akışlar aktif; destek ve moderasyon kayıtları güvenli şekilde alınır.`}
        title="Bilgi"
        visible={comingSoonVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setMatchErrorVisible(false), variant: 'secondary' }]}
        message={matchErrorMessage}
        title="Eşleşme"
        visible={matchErrorVisible}
      />

      <NoticeModal
        actions={[{ label: 'İptal Et', onPress: () => void stopMatchmaking(), variant: 'ghost' }]}
        message="Uygun kullanıcı aranıyor..."
        title="Seni anlayacak biri aranıyor..."
        visible={matchWaitingVisible}
      >
        <ActivityIndicator color={palette.cyan} size="large" />
      </NoticeModal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
  },
  safeArea: {
    flex: 1,
  },
  page: {
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    top: -90,
    left: -40,
    width: 220,
    height: 220,
  },
  orbRight: {
    top: 160,
    right: -80,
    width: 240,
    height: 240,
  },
  orbBottom: {
    bottom: -50,
    left: 20,
    width: 200,
    height: 200,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#A44DFF',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  bottomTabBar: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    justifyContent: 'flex-end',
    right: 0,
    zIndex: 100,
  },
  bottomTabInner: {
    width: '100%',
  },
});
