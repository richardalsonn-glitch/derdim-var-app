import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { ChoiceChip } from '../components/ChoiceChip';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { SideDrawer } from '../components/SideDrawer';
import { colors, gradients, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, helpedToday, moodOptions } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { MatchRole } from '../types';
import { requestMicrophonePermission } from '../services/permissionsService';

const AUTO_CALL_SECONDS = 45;

const drawerItems = [
  { label: 'Profil', icon: 'person' as const, route: 'Profile' as const },
  { label: 'Anonim Mektup Kutusu', icon: 'mail' as const, route: 'Letters' as const },
  { label: 'Paketler', icon: 'diamond' as const, route: 'Packages' as const },
  { label: 'Tekrar Eşleşme', icon: 'refresh' as const, route: 'Rematch' as const },
  { label: 'Rozet Sistemi', icon: 'ribbon' as const, route: 'Badges' as const },
  { label: 'Ayarlar', icon: 'settings' as const, route: 'Settings' as const },
  { label: 'Çıkış', icon: 'log-out' as const, route: 'Login' as const },
];

function formatAutoCallLabel(seconds: number) {
  return `Otomatik çağrıya ${seconds} sn`;
}

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const { profile, setActiveRole, updateProfile, setAutoCallEnabled, userScore, userLevel } = useAppState();
  const [selectedMood, setSelectedMood] = useState(profile.mood);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingRole, setPendingRole] = useState<MatchRole | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(AUTO_CALL_SECONDS);
  const [themeMockEnabled, setThemeMockEnabled] = useState(false);
  const isFocused = useIsFocused();
  const avatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);

  const resetAutoCall = () => {
    if (profile.autoCallEnabled) {
      setAutoCallCountdown(AUTO_CALL_SECONDS);
    }
  };

  useEffect(() => {
    if (!profile.autoCallEnabled || !isFocused) {
      return;
    }

    if (autoCallCountdown <= 0) {
      navigation.navigate('Matching');
      setAutoCallCountdown(AUTO_CALL_SECONDS);
      return;
    }

    const timerId = setTimeout(() => {
      setAutoCallCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [autoCallCountdown, isFocused, navigation, profile.autoCallEnabled]);

  useEffect(() => {
    if (profile.autoCallEnabled && isFocused) {
      setAutoCallCountdown(AUTO_CALL_SECONDS);
    }
  }, [isFocused, profile.autoCallEnabled]);

  const proceedToMatching = (role: MatchRole) => {
    setActiveRole(role);
    updateProfile({ mood: selectedMood });
    resetAutoCall();
    navigation.navigate('Matching');
  };

  const startVoiceFlow = async (role: MatchRole) => {
    resetAutoCall();
    setPendingRole(role);
    const result = await requestMicrophonePermission();

    if (result.granted) {
      proceedToMatching(role);
      return;
    }

    setPermissionModalVisible(true);
  };

  const navigateMenu = (route: (typeof drawerItems)[number]['route']) => {
    setDrawerVisible(false);
    resetAutoCall();
    if (route === 'Login') {
      navigation.replace('Login');
      return;
    }

    navigation.navigate(route);
  };

  return (
    <PremiumScreen scroll={false} contentStyle={styles.content}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              resetAutoCall();
              setDrawerVisible(true);
            }}
            style={styles.drawerButton}
          >
            <Ionicons color={colors.text} name="menu" size={22} />
          </Pressable>

          <Pressable
            onPress={() => {
              resetAutoCall();
              setThemeMockEnabled((current) => !current);
            }}
            style={[styles.themeButton, themeMockEnabled && styles.themeButtonActive]}
          >
            <Ionicons color={themeMockEnabled ? colors.gold : colors.text} name={themeMockEnabled ? 'sunny' : 'moon'} size={20} />
          </Pressable>
        </View>

        <GlassCard style={styles.heroCard} toned="strong">
          <View style={styles.heroHeader}>
            <View style={styles.identity}>
              <Avatar avatar={avatar} size={68} />
              <View style={styles.identityCopy}>
                <Text style={styles.alias}>{profile.username}</Text>
                <Text style={styles.meta}>
                  {profile.plan.toUpperCase()} plan • {profile.age} yaş • {profile.gender}
                </Text>
                <Text style={styles.meta}>{profile.relationshipStatus}</Text>
              </View>
            </View>

            <LinearGradient colors={[...gradients.surface]} style={styles.todayPill}>
              <Ionicons color={colors.cyan} name="sparkles" size={16} />
              <Text style={styles.todayText}>Bugün {helpedToday} kişiye iyi geldin</Text>
            </LinearGradient>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{userScore}</Text>
              <Text style={styles.statLabel}>Derman Puanı</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>Level {userLevel}</Text>
              <Text style={styles.statLabel}>İyilik Seviyesi</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.primaryStack}>
          <LinearGradient colors={[...gradients.primary]} style={styles.primaryGlow}>
            <GradientButton
              icon="heart"
              large
              onPress={() => startVoiceFlow('derdim-var')}
              subtitle="İçimi dökmek istiyorum"
              title="Derdim Var"
            />
          </LinearGradient>

          <LinearGradient colors={[...gradients.secondary]} style={styles.primaryGlow}>
            <GradientButton
              icon="headset"
              large
              onPress={() => startVoiceFlow('derman-olan')}
              subtitle="Birini dinlemek istiyorum"
              title="Derman Ol"
              variant="secondary"
            />
          </LinearGradient>
        </View>

        <View style={styles.secondaryStack}>
          <GradientButton
            icon="moon"
            onPress={async () => {
              resetAutoCall();
              const result = await requestMicrophonePermission();
              if (!result.granted) {
                setPendingRole('derdim-var');
                setPermissionModalVisible(true);
                return;
              }
              navigation.navigate('NightMode');
            }}
            subtitle="22:00 - 02:00"
            title="Gece Modu"
            variant="secondary"
          />

          <GradientButton
            icon="mic"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('SilentScream');
            }}
            subtitle="Dert Sıra Gecesi"
            title="Sessiz Çığlık"
            variant="gold"
          />
        </View>

        <GlassCard style={styles.autoCallCard}>
          <View style={styles.autoCallHeader}>
            <View style={styles.autoCallCopy}>
              <Text style={styles.autoCallTitle}>Otomatik çağrı al</Text>
              <Text style={styles.autoCallSubtitle}>45 saniye işlem yapmazsan seni uygun bir ses odasına bağlarız.</Text>
            </View>
            <View style={styles.autoCallSwitchWrap}>
              <Pressable
                onPress={() => {
                  setAutoCallEnabled(!profile.autoCallEnabled);
                  setAutoCallCountdown(AUTO_CALL_SECONDS);
                }}
                style={[styles.autoCallSwitch, profile.autoCallEnabled && styles.autoCallSwitchActive]}
              >
                <View style={[styles.autoCallKnob, profile.autoCallEnabled && styles.autoCallKnobActive]} />
              </Pressable>
            </View>
          </View>
          {profile.autoCallEnabled ? <Text style={styles.autoCallCounter}>{formatAutoCallLabel(autoCallCountdown)}</Text> : null}
        </GlassCard>

        <GlassCard style={styles.moodCard}>
          <Text style={styles.moodTitle}>Bugün ruh halin ne?</Text>
          <View style={styles.moodRow}>
            {moodOptions.map((mood) => (
              <ChoiceChip
                key={mood}
                label={mood}
                onPress={() => {
                  resetAutoCall();
                  setSelectedMood(mood);
                  updateProfile({ mood });
                }}
                selected={selectedMood === mood}
              />
            ))}
          </View>
        </GlassCard>
      </View>

      <SideDrawer
        items={drawerItems.map((item) => ({
          label: item.label,
          icon: item.icon,
          action: () => navigateMenu(item.route),
        }))}
        onClose={() => setDrawerVisible(false)}
        profile={profile}
        userLevel={userLevel}
        userScore={userScore}
        visible={drawerVisible}
      />

      <NoticeModal
        actions={[
          {
            label: 'Tekrar Dene',
            onPress: async () => {
              setPermissionModalVisible(false);
              if (pendingRole) {
                await startVoiceFlow(pendingRole);
              }
            },
          },
          {
            label: 'Şimdilik Vazgeç',
            onPress: () => setPermissionModalVisible(false),
            variant: 'ghost',
          },
        ]}
        message="Sesli görüşme için mikrofon izni gerekli."
        title="Mikrofon izni gerekli"
        visible={permissionModalVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  page: {
    flex: 1,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  themeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  themeButtonActive: {
    borderColor: 'rgba(255, 215, 110, 0.38)',
    backgroundColor: 'rgba(255, 215, 110, 0.08)',
  },
  heroCard: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  identityCopy: {
    flex: 1,
    gap: 3,
  },
  alias: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statChip: {
    flex: 1,
    minHeight: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  primaryStack: {
    gap: spacing.sm,
  },
  primaryGlow: {
    borderRadius: radius.xl,
    padding: 1,
  },
  secondaryStack: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autoCallCard: {
    gap: spacing.xs,
  },
  autoCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  autoCallCopy: {
    flex: 1,
    gap: 4,
  },
  autoCallTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  autoCallSubtitle: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
  },
  autoCallSwitchWrap: {
    paddingLeft: spacing.xs,
  },
  autoCallSwitch: {
    width: 58,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  autoCallSwitchActive: {
    backgroundColor: 'rgba(69, 224, 255, 0.18)',
    borderColor: 'rgba(69, 224, 255, 0.38)',
  },
  autoCallKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    transform: [{ translateX: 0 }],
  },
  autoCallKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.cyan,
  },
  autoCallCounter: {
    color: colors.cyan,
    fontWeight: '700',
  },
  moodCard: {
    gap: spacing.sm,
  },
  moodTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
