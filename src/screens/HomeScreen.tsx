import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { ChoiceChip } from '../components/ChoiceChip';
import { GlassCard } from '../components/GlassCard';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { colors, gradients, radius, shadows, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, helpedToday, moodOptions } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { requestMicrophonePermission } from '../services/permissionsService';
import { MatchRole } from '../types';

const AUTO_CALL_SECONDS = 45;

const menuItems = [
  { label: 'Profil', icon: 'person' as const, route: 'Profile' as const },
  { label: 'Anonim Mektup Kutusu', icon: 'mail' as const, route: 'Letters' as const },
  { label: 'Paketler', icon: 'diamond' as const, route: 'Packages' as const },
  { label: 'Tekrar Eşleşme', icon: 'refresh' as const, route: 'Rematch' as const },
  { label: 'Rozet Sistemi', icon: 'ribbon' as const, route: 'Badges' as const },
  { label: 'Ayarlar', icon: 'settings' as const, route: 'Settings' as const },
  { label: 'Çıkış', icon: 'log-out' as const, route: 'Login' as const },
];

type MenuRoute = (typeof menuItems)[number]['route'];

type PrimaryActionCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string, string];
  onPress: () => void;
};

type QuickActionCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function formatAutoCallLabel(seconds: number) {
  return `${seconds} sn sonra otomatik çağrı`;
}

function PrimaryActionCard({ title, subtitle, icon, gradientColors, onPress }: PrimaryActionCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.primaryCardPressable}>
      <LinearGradient colors={[...gradientColors]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.primaryCard}>
        <View style={styles.primaryCardTop}>
          <View style={styles.primaryIconWrap}>
            <Ionicons color={colors.text} name={icon} size={24} />
          </View>
          <Ionicons color={colors.text} name="arrow-forward" size={18} />
        </View>
        <View style={styles.primaryCopy}>
          <Text style={styles.primaryTitle}>{title}</Text>
          <Text style={styles.primarySubtitle}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function QuickActionCard({ title, subtitle, icon, onPress }: QuickActionCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.quickCardWrap}>
      <GlassCard style={styles.quickCard}>
        <View style={styles.quickCardTop}>
          <View style={styles.quickIconWrap}>
            <Ionicons color={colors.text} name={icon} size={18} />
          </View>
          <Ionicons color={colors.muted} name="chevron-forward" size={16} />
        </View>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </GlassCard>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const { profile, setActiveRole, updateProfile, setAutoCallEnabled, userScore, userLevel } = useAppState();
  const [selectedMood, setSelectedMood] = useState(profile.mood);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingRole, setPendingRole] = useState<MatchRole | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(AUTO_CALL_SECONDS);
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
      navigation.navigate('VoiceCall');
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
    navigation.navigate('VoiceCall');
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

  const navigateMenu = (route: MenuRoute) => {
    setMenuVisible(false);
    resetAutoCall();

    if (route === 'Login') {
      navigation.replace('Login');
      return;
    }

    navigation.navigate(route);
  };

  return (
    <PremiumScreen contentStyle={styles.content}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              resetAutoCall();
              navigation.navigate('Profile');
            }}
            style={styles.profileChip}
          >
            <Avatar avatar={avatar} size={48} />
            <View style={styles.profileChipCopy}>
              <Text numberOfLines={1} style={styles.alias}>
                {profile.username}
              </Text>
              <Text style={styles.profileChipMeta}>
                Level {userLevel} • {profile.plan.toUpperCase()}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              resetAutoCall();
              setMenuVisible(true);
            }}
            style={styles.menuButton}
          >
            <Ionicons color={colors.text} name="menu" size={18} />
          </Pressable>
        </View>

        <GlassCard style={styles.heroCard} toned="strong">
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Bugün</Text>
            <Text style={styles.heroTitle}>Bugün sana iyi gelecek biri var.</Text>
            <Text style={styles.heroSubtitle}>Anonim kal, içini dök ya da birine derman ol.</Text>
          </View>

          <LinearGradient colors={[...gradients.surface]} style={styles.todayPill}>
            <Ionicons color={colors.cyan} name="sparkles" size={16} />
            <Text style={styles.todayText}>Bugün {helpedToday} kişiye iyi geldin</Text>
          </LinearGradient>

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

        <View style={styles.primaryGrid}>
          <PrimaryActionCard
            gradientColors={gradients.primary}
            icon="heart"
            onPress={() => startVoiceFlow('derdim-var')}
            subtitle="İçimi dökmek istiyorum"
            title="Derdim Var"
          />
          <PrimaryActionCard
            gradientColors={['#25307A', '#4D57FF', '#45E0FF']}
            icon="headset"
            onPress={() => startVoiceFlow('derman-olan')}
            subtitle="Birini dinlemek istiyorum"
            title="Derman Ol"
          />
        </View>

        <View style={styles.quickGrid}>
          <QuickActionCard
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
          />
          <QuickActionCard
            icon="mic"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('SilentScream');
            }}
            subtitle="Dert Sıra Gecesi"
            title="Sessiz Çığlık"
          />
          <QuickActionCard
            icon="mail"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('Letters');
            }}
            subtitle="Mektup Kutun"
            title="Anonim Mektup Kutusu"
          />
          <QuickActionCard
            icon="diamond"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('Packages');
            }}
            subtitle="Planını güçlendir"
            title="Paketler"
          />
          <QuickActionCard
            icon="refresh"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('Rematch');
            }}
            subtitle="Tanıdık biri çıksın"
            title="Tekrar Eşleşme"
          />
          <QuickActionCard
            icon="ribbon"
            onPress={() => {
              resetAutoCall();
              navigation.navigate('Badges');
            }}
            subtitle="Seviyeni büyüt"
            title="Rozet Sistemi"
          />
        </View>

        <GlassCard style={styles.autoCallCard}>
          <View style={styles.autoCallHeader}>
            <View style={styles.autoCallCopy}>
              <Text style={styles.autoCallTitle}>Otomatik çağrı al</Text>
              <Text style={styles.autoCallSubtitle}>45 sn işlem yapmazsan seni uygun bir ses odasına bağlarız.</Text>
            </View>
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

          <View style={styles.autoCallFooter}>
            <Text style={styles.autoCallCounter}>{profile.autoCallEnabled ? formatAutoCallLabel(autoCallCountdown) : 'Kapalı'}</Text>
            <Text style={styles.autoCallMeta}>Süre sabit: 45 sn</Text>
          </View>
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

      <Modal animationType="slide" onRequestClose={() => setMenuVisible(false)} statusBarTranslucent transparent visible={menuVisible}>
        <View style={styles.sheetBackdrop}>
          <Pressable onPress={() => setMenuVisible(false)} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(17, 20, 50, 0.98)', 'rgba(9, 11, 28, 0.98)']} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <View style={styles.sheetIdentity}>
                <Avatar avatar={avatar} size={56} />
                <View style={styles.sheetIdentityCopy}>
                  <Text style={styles.sheetTitle}>{profile.username}</Text>
                  <Text style={styles.sheetSubtitle}>
                    {profile.plan.toUpperCase()} • Level {userLevel} • {userScore} puan
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setMenuVisible(false)} style={styles.sheetCloseButton}>
                <Ionicons color={colors.text} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.sheetMenuList}>
              {menuItems.map((item) => (
                <Pressable key={item.label} onPress={() => navigateMenu(item.route)} style={styles.sheetMenuItem}>
                  <View style={styles.sheetMenuIcon}>
                    <Ionicons color={colors.text} name={item.icon} size={18} />
                  </View>
                  <Text style={styles.sheetMenuLabel}>{item.label}</Text>
                  <Ionicons color={colors.muted} name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          </LinearGradient>
        </View>
      </Modal>

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
    gap: spacing.md,
  },
  page: {
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  profileChip: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileChipCopy: {
    flex: 1,
    gap: 2,
  },
  alias: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  profileChipMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCard: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  heroCopy: {
    gap: 6,
  },
  heroEyebrow: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: colors.muted,
    lineHeight: 20,
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
    alignSelf: 'flex-start',
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
    minHeight: 64,
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
  primaryGrid: {
    gap: spacing.sm,
  },
  primaryCardPressable: {
    borderRadius: radius.xl,
    ...shadows.glow,
  },
  primaryCard: {
    minHeight: 132,
    borderRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  primaryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  primaryCopy: {
    gap: 4,
  },
  primaryTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  primarySubtitle: {
    color: 'rgba(247, 238, 255, 0.86)',
    fontSize: 14,
    lineHeight: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  quickCardWrap: {
    width: '48%',
  },
  quickCard: {
    minHeight: 124,
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: 'rgba(16, 18, 48, 0.74)',
  },
  quickCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  quickTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  quickSubtitle: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
  },
  autoCallCard: {
    gap: spacing.sm,
    backgroundColor: 'rgba(16, 18, 48, 0.72)',
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
  },
  autoCallKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: colors.cyan,
  },
  autoCallFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  autoCallCounter: {
    color: colors.cyan,
    fontWeight: '700',
  },
  autoCallMeta: {
    color: colors.dim,
    fontSize: 12,
  },
  moodCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 4, 12, 0.66)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetIdentityCopy: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  sheetCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sheetMenuList: {
    gap: 10,
  },
  sheetMenuItem: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetMenuLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
});
