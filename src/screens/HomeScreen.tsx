import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { ActionCard } from '../components/home/ActionCard';
import { AutoCallCard } from '../components/home/AutoCallCard';
import { BottomTabBar, BottomTabItem } from '../components/home/BottomTabBar';
import { DrawerMenu } from '../components/home/DrawerMenu';
import { FeatureGrid } from '../components/home/FeatureGrid';
import { ProfileCard } from '../components/home/ProfileCard';
import { ThemeToggle } from '../components/home/ThemeToggle';
import { DrawerItem, FeatureItem, HomePalette } from '../components/home/types';
import { NoticeModal } from '../components/NoticeModal';
import { colors, layout, radius } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { signOut } from '../services/authService';
import { joinQueue, leaveQueue, listenForMatch } from '../services/matchService';
import { requestMicrophonePermission } from '../services/permissionsService';
import { MatchRole, MatchmakingMode, UiTheme } from '../types';

const AUTO_CALL_SECONDS = 45;

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
  tabBarHeight: number;
  tabBarOffset: number;
  iconButton: number;
};

const drawerItems: DrawerItem[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'profile', label: 'Profilim', icon: 'person' },
  { key: 'chats', label: 'Sohbetler', icon: 'chatbubbles' },
  { key: 'friends', label: 'Arkadaşlar', icon: 'people' },
  { key: 'notifications', label: 'Bildirimler', icon: 'notifications' },
  { key: 'packages', label: 'Paketler', icon: 'diamond' },
  { key: 'badges', label: 'Rozet Sistemi', icon: 'shield-half' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
  { key: 'logout', label: 'Çıkış Yap', icon: 'log-out' },
];

const bottomTabs: BottomTabItem[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home' },
  { key: 'chats', label: 'Sohbetler', icon: 'chatbox-ellipses' },
  { key: 'gifts', label: 'Hediyeler', icon: 'gift' },
  { key: 'friends', label: 'Arkadaşlar', icon: 'people' },
  { key: 'notifications', label: 'Bildirimler', icon: 'notifications' },
];

function formatAutoCall(seconds: number) {
  return `00:${String(seconds).padStart(2, '0')}`;
}

function getMatchmakingMode(role: MatchRole): MatchmakingMode {
  return role === 'derdim-var' ? 'derdim' : 'derman';
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
  const compact = width < 380;
  const short = height < 760;
  const sidePadding = compact ? 14 : 18;
  const topPadding = compact ? 6 : 8;
  const gap = short ? 8 : 10;
  const ctaGap = 10;
  const tabBarHeight = 76;
  const tabBarOffset = 4;
  const contentPaddingBottom = tabBarHeight + tabBarOffset + 12;
  const available = height - insetsTop - topPadding - contentPaddingBottom - gap * 4;
  const topHeight = Math.round(Math.min(60, Math.max(48, available * 0.076)));
  const profileHeight = Math.round(Math.min(132, Math.max(110, available * 0.154)));
  const ctaCardHeightBase = Math.round(Math.min(220, Math.max(176, available * 0.215)));
  const ctaCardHeight = Math.max(88, Math.min(96, Math.round(ctaCardHeightBase * 0.82)));
  const ctaBlockHeight = ctaCardHeight * 2 + ctaGap;
  const autoHeight = Math.round(Math.min(84, Math.max(70, available * 0.094)));
  const featureOffset = compact ? 4 : 6;
  const featureBlockHeight = Math.max(192, available - topHeight - profileHeight - ctaBlockHeight - autoHeight - featureOffset);
  const featureCardHeight = Math.max(compact ? 58 : 62, Math.floor((featureBlockHeight - gap * 2) / 3));

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
    tabBarHeight,
    tabBarOffset,
    iconButton: compact ? 42 : 48,
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
  const avatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);
  const featureItems = useMemo(() => getFeatureItems(), []);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const metrics = useMemo(() => getMetrics(width, height, insets.top, insets.bottom), [height, insets.bottom, insets.top, width]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(AUTO_CALL_SECONDS);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonTitle, setComingSoonTitle] = useState('Bu alan');
  const [activeTab, setActiveTab] = useState('home');
  const [matchErrorVisible, setMatchErrorVisible] = useState(false);
  const [matchErrorMessage, setMatchErrorMessage] = useState('Eslesme su anda baslatilamadi.');
  const fadeValue = useRef(new Animated.Value(0)).current;
  const matchmakingRequestRef = useRef(0);
  const matchmakingPhaseRef = useRef<'idle' | 'waiting' | 'matched'>('idle');
  const matchListenerCleanupRef = useRef<null | (() => Promise<void>)>(null);

  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [fadeValue]);

  useEffect(() => {
    if (!profile.autoCallEnabled) {
      return;
    }

    if (autoCallCountdown <= 0) {
      navigation.navigate('VoiceCall');
      setAutoCallCountdown(AUTO_CALL_SECONDS);
      return;
    }

    const timerId = setTimeout(() => {
      setAutoCallCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [autoCallCountdown, navigation, profile.autoCallEnabled]);

  useEffect(() => {
    if (profile.autoCallEnabled) {
      setAutoCallCountdown(AUTO_CALL_SECONDS);
    }
  }, [profile.autoCallEnabled]);

  function resetAutoCall() {
    if (profile.autoCallEnabled) {
      setAutoCallCountdown(AUTO_CALL_SECONDS);
    }
  }

  async function stopMatchmaking() {
    matchmakingRequestRef.current += 1;
    matchmakingPhaseRef.current = 'idle';

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
    setMatchErrorMessage(message);
    setMatchErrorVisible(true);
  }

  function openMatchedVoiceCall() {
    matchmakingPhaseRef.current = 'matched';
    navigation.reset({
      index: 0,
      routes: [{ name: 'VoiceCall', params: { matchReady: true } }],
    });
  }

  async function startMatchmaking(role: MatchRole) {
    const requestId = Date.now();
    matchmakingRequestRef.current = requestId;
    matchmakingPhaseRef.current = 'waiting';
    setActiveRole(role);

    const joinResult = await joinQueue(getMatchmakingMode(role));

    if (matchmakingRequestRef.current !== requestId) {
      return;
    }

    if (joinResult.error || !joinResult.data) {
      matchmakingPhaseRef.current = 'idle';
      showMatchError(joinResult.error?.message ?? 'Eslesme kuyrugu baslatilamadi.');
      return;
    }

    if (joinResult.data.queue.status === 'matched') {
      openMatchedVoiceCall();
      return;
    }

    const listenResult = await listenForMatch(() => {
      if (matchmakingRequestRef.current !== requestId) {
        return;
      }

      matchListenerCleanupRef.current = null;
      openMatchedVoiceCall();
    });

    if (matchmakingRequestRef.current !== requestId) {
      return;
    }

    if (listenResult.error || !listenResult.data) {
      matchmakingPhaseRef.current = 'idle';
      await leaveQueue();
      showMatchError(listenResult.error?.message ?? 'Gercek zamanli eslesme dinleyicisi baslatilamadi.');
      return;
    }

    matchListenerCleanupRef.current = listenResult.data;
  }

  async function openVoiceRole(role: MatchRole) {
    resetAutoCall();
    setPendingAction({ type: 'role', role });
    const result = await requestMicrophonePermission();

    if (!result.granted) {
      setPermissionModalVisible(true);
      return;
    }

    await stopMatchmaking();
    await startMatchmaking(role);
  }

  async function openVoiceFeature(route: 'NightMode' | 'SilentScream') {
    resetAutoCall();
    setPendingAction({ type: 'route', route });

    if (route === 'NightMode') {
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
      console.error('[auth] signOut failed:', result.error.message);
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Splash' }],
    });
  }

  function handleFeaturePress(item: FeatureItem) {
    resetAutoCall();
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
    resetAutoCall();
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
        navigation.navigate('Profile');
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
    resetAutoCall();
    if (matchmakingPhaseRef.current === 'waiting') {
      void stopMatchmaking();
    }

    switch (item.key) {
      case 'home':
        return;
      case 'friends':
        navigation.navigate('Profile');
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

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Animated.View
          style={[
            styles.page,
            {
              paddingHorizontal: metrics.sidePadding,
              paddingTop: metrics.topPadding,
              paddingBottom: metrics.contentPaddingBottom,
              gap: metrics.gap,
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
                resetAutoCall();
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
            <ProfileCard avatar={avatar} compact={metrics.compact} data={profileData} onPress={() => navigation.navigate('Profile')} palette={palette} />
          </View>

          <View style={{ height: metrics.ctaBlockHeight, gap: metrics.ctaGap }}>
            <View style={{ height: metrics.ctaCardHeight }}>
              <ActionCard
              compact
              glowColor="rgba(255, 86, 180, 0.34)"
              gradient={['#FF4A7A', '#FF3FA7', '#9426C8']}
              height={metrics.ctaCardHeight}
              icon="heart"
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
            <FeatureGrid cardHeight={metrics.featureCardHeight} compact items={featureItems} onSelect={handleFeaturePress} palette={palette} />
          </View>
        </Animated.View>
      </SafeAreaView>

      <View
        pointerEvents="box-none"
        style={[
          styles.bottomTabBar,
          {
            bottom: 4,
          },
        ]}>
        <BottomTabBar activeKey={activeTab} compact={metrics.compact} items={bottomTabs} onSelect={handleBottomTabSelect} palette={palette} />
      </View>

      <DrawerMenu
        avatar={avatar}
        items={drawerItems}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleDrawerSelect}
        palette={palette}
        planLabel={`${profile.plan.toUpperCase()} • Level ${userLevel}`}
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
        message={`${comingSoonTitle} bölümü sonraki revizyonda tam ekran olarak bağlanacak.`}
        title="Yakında"
        visible={comingSoonVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setMatchErrorVisible(false), variant: 'secondary' }]}
        message={matchErrorMessage}
        title="Eslesme baslatilamadi"
        visible={matchErrorVisible}
      />
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
    position: 'absolute',
    left: 24,
    right: 24,
    height: 76,
    borderRadius: 28,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
});
