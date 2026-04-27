import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const quickActions = [
  { label: 'Gece Modu', subtitle: '22:00 - 02:00', icon: 'moon', route: 'NightMode' as const },
  { label: 'Sessiz Çığlık', subtitle: 'Dert Sıra Gecesi', icon: 'mic', route: 'SilentScream' as const },
  { label: 'Anonim Mektup Kutusu', subtitle: 'Sana gelen mektuplar', icon: 'mail', route: 'Letters' as const },
  { label: 'Paketler', subtitle: 'Plus ve VIP avantajları', icon: 'diamond', route: 'Packages' as const },
  { label: 'Tekrar Eşleşme', subtitle: 'Kaçırdığın biri mi vardı?', icon: 'refresh', route: 'Rematch' as const },
  { label: 'Rozet Sistemi', subtitle: 'İlerlemeni ve ödülleri gör', icon: 'ribbon', route: 'Badges' as const },
];

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const { profile, setActiveRole, updateProfile } = useAppState();
  const [selectedMood, setSelectedMood] = useState(profile.mood);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [pendingRole, setPendingRole] = useState<MatchRole | null>(null);
  const avatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);

  const proceedToMatching = (role: MatchRole) => {
    setActiveRole(role);
    updateProfile({ mood: selectedMood });
    navigation.navigate('Matching');
  };

  const startVoiceFlow = async (role: MatchRole) => {
    setPendingRole(role);
    const result = await requestMicrophonePermission();

    if (result.granted) {
      proceedToMatching(role);
      return;
    }

    setPermissionModalVisible(true);
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

          <Pressable onPress={() => navigation.navigate('Profile')} style={styles.profileButton}>
            <Ionicons color={colors.text} name="person-outline" size={20} />
          </Pressable>
        </View>

        <LinearGradient colors={[...gradients.surface]} style={styles.counterPill}>
          <Ionicons color={colors.cyan} name="sparkles" size={18} />
          <Text style={styles.counterText}>Bugün {helpedToday} kişiye iyi geldin</Text>
        </LinearGradient>

        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Anonim kal, içini dök, seni anlayacak biriyle eşleş.</Text>
          <Text style={styles.heroSubtitle}>Sosyal destek odaklı sesli dertleşme deneyimi. Terapi hizmeti değildir.</Text>
        </View>
      </GlassCard>

      <View style={styles.ctaStack}>
        <GradientButton
          icon="heart"
          onPress={() => startVoiceFlow('derdim-var')}
          subtitle="Sesli olarak içini dökmek istiyorum"
          title="Derdim Var"
        />
        <GradientButton
          icon="headset"
          onPress={() => startVoiceFlow('derman-olan')}
          subtitle="Birini dinleyip iyi gelmek istiyorum"
          title="Derman Ol"
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        {quickActions.map((action) => (
          <Pressable key={action.label} onPress={() => navigation.navigate(action.route)}>
            <GlassCard style={styles.actionRow}>
              <LinearGradient colors={[...gradients.surface]} style={styles.actionIcon}>
                <Ionicons color={colors.text} name={action.icon as keyof typeof Ionicons.glyphMap} size={17} />
              </LinearGradient>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={16} />
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <GlassCard style={styles.moodCard}>
        <Text style={styles.moodTitle}>Bugün ruh halin ne?</Text>
        <View style={styles.moodRow}>
          {moodOptions.map((mood) => (
            <ChoiceChip
              key={mood}
              label={mood}
              onPress={() => {
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
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
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
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSubtitle: {
    color: colors.muted,
    lineHeight: 21,
  },
  ctaStack: {
    gap: spacing.sm,
  },
  section: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 12,
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
});
