import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { ChoiceChip } from '../components/ChoiceChip';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { colors, gradients, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, helpedToday, moodOptions } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { MatchRole } from '../types';
import { requestMicrophonePermission } from '../services/permissionsService';

// TODO: Moderasyon ve sikayet paneli baglanacak

const menuItems = [
  { label: 'Anonim Mektup Kutusu', icon: 'mail', route: 'Letters' as const },
  { label: 'Paketler', icon: 'diamond', route: 'Packages' as const },
  { label: 'Tekrar Eşleşme', icon: 'refresh', route: 'Rematch' as const },
  { label: 'Rozet Sistemi', icon: 'ribbon', route: 'Badges' as const },
  { label: 'Profil', icon: 'person', route: 'Profile' as const },
  { label: 'Ayarlar', icon: 'settings', route: 'Settings' as const },
];

function formatAutoCallLabel(seconds: number) {
  return `Otomatik çağrıya ${seconds} sn`;
}

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const { profile, setActiveRole, updateProfile, setAutoCallEnabled } = useAppState();
  const [selectedMood, setSelectedMood] = useState(profile.mood);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingRole, setPendingRole] = useState<MatchRole | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [autoCallCountdown, setAutoCallCountdown] = useState(10);
  const avatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);

  const resetAutoCall = () => {
    if (profile.autoCallEnabled) {
      setAutoCallCountdown(10);
    }
  };

  useEffect(() => {
    if (!profile.autoCallEnabled) {
      return;
    }

    if (autoCallCountdown <= 0) {
      navigation.navigate('Matching');
      setAutoCallCountdown(10);
      return;
    }

    const timerId = setTimeout(() => {
      setAutoCallCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [autoCallCountdown, navigation, profile.autoCallEnabled]);

  useEffect(() => {
    if (profile.autoCallEnabled) {
      setAutoCallCountdown(10);
    }
  }, [profile.autoCallEnabled]);

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

  const navigateMenu = (route: (typeof menuItems)[number]['route']) => {
    setMenuVisible(false);
    resetAutoCall();
    navigation.navigate(route);
  };

  return (
    <PremiumScreen>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.identity}>
            <Avatar avatar={avatar} size={74} />
            <View style={styles.identityCopy}>
              <Text style={styles.alias}>{profile.username}</Text>
              <Text style={styles.meta}>
                {profile.plan.toUpperCase()} plan • {profile.age} yaş • {profile.gender}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              resetAutoCall();
              setMenuVisible(true);
            }}
            style={styles.menuButton}
          >
            <Ionicons color={colors.text} name="menu" size={22} />
          </Pressable>
        </View>

        <LinearGradient colors={[...gradients.surface]} style={styles.counterPill}>
          <Ionicons color={colors.cyan} name="sparkles" size={18} />
          <Text style={styles.counterText}>Bugün {helpedToday} kişiye iyi geldin</Text>
        </LinearGradient>
      </GlassCard>

      <View style={styles.primarySection}>
        <LinearGradient colors={[...gradients.primary]} style={styles.primaryGlow}>
          <GradientButton
            icon="heart"
            large
            onPress={() => startVoiceFlow('derdim-var')}
            subtitle="İçimi dökmek istiyorum"
            title="Derdim Var"
          />
        </LinearGradient>

        <LinearGradient colors={[...gradients.secondary]} style={styles.secondaryGlow}>
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

      <View style={styles.inlineActions}>
        <Pressable
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
          style={styles.inlineAction}
        >
          <Ionicons color={colors.text} name="moon" size={18} />
          <View style={styles.inlineActionCopy}>
            <Text style={styles.inlineActionTitle}>Gece Modu</Text>
            <Text style={styles.inlineActionSubtitle}>22:00 - 02:00</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => {
            resetAutoCall();
            navigation.navigate('SilentScream');
          }}
          style={styles.inlineAction}
        >
          <Ionicons color={colors.text} name="mic" size={18} />
          <View style={styles.inlineActionCopy}>
            <Text style={styles.inlineActionTitle}>Sessiz Çığlık</Text>
            <Text style={styles.inlineActionSubtitle}>Dert Sıra Gecesi</Text>
          </View>
        </Pressable>
      </View>

      <GlassCard style={styles.autoCallCard}>
        <View style={styles.autoCallHeader}>
          <View style={styles.autoCallCopy}>
            <Text style={styles.autoCallTitle}>Otomatik çağrı al</Text>
            <Text style={styles.autoCallSubtitle}>10 saniye işlem yapmazsan seni uygun bir ses odasına bağlarız.</Text>
          </View>
          <Switch
            onValueChange={(value) => {
              setAutoCallEnabled(value);
              setAutoCallCountdown(10);
            }}
            thumbColor={profile.autoCallEnabled ? colors.text : '#F1F1F1'}
            trackColor={{ false: 'rgba(255,255,255,0.14)', true: 'rgba(255,79,185,0.48)' }}
            value={profile.autoCallEnabled}
          />
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

      <Modal animationType="slide" transparent visible={menuVisible}>
        <View style={styles.menuBackdrop}>
          <Pressable onPress={() => setMenuVisible(false)} style={StyleSheet.absoluteFill} />
          <GlassCard style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Hızlı Menü</Text>
              <Pressable onPress={() => setMenuVisible(false)} style={styles.menuClose}>
                <Ionicons color={colors.text} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.menuList}>
              {menuItems.map((item) => (
                <Pressable key={item.label} onPress={() => navigateMenu(item.route)} style={styles.menuItem}>
                  <View style={styles.menuItemIcon}>
                    <Ionicons color={colors.text} name={item.icon as keyof typeof Ionicons.glyphMap} size={18} />
                  </View>
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  <Ionicons color={colors.muted} name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </View>
      </Modal>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  alias: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  menuButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  counterPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterText: {
    color: colors.text,
    fontWeight: '700',
  },
  primarySection: {
    gap: spacing.md,
  },
  primaryGlow: {
    borderRadius: radius.xl,
    padding: 1,
  },
  secondaryGlow: {
    borderRadius: radius.xl,
    padding: 1,
  },
  inlineActions: {
    gap: spacing.sm,
  },
  inlineAction: {
    minHeight: 72,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineActionCopy: {
    flex: 1,
    gap: 2,
  },
  inlineActionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  inlineActionSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  autoCallCard: {
    gap: spacing.sm,
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
    lineHeight: 20,
  },
  autoCallCounter: {
    color: colors.cyan,
    fontWeight: '700',
  },
  moodCard: {
    gap: spacing.md,
  },
  moodTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(3, 6, 16, 0.6)',
  },
  menuSheet: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  menuClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuList: {
    gap: spacing.xs,
  },
  menuItem: {
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuItemLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
});
