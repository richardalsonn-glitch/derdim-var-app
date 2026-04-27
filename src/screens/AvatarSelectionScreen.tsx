import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { avatarOptions, getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function AvatarSelectionScreen({ navigation }: AppScreenProps<'AvatarSelection'>) {
  const { profile, setAvatar } = useAppState();

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Toplam 8 premium avatar" title="Avatarını Seç" />
      <ProgressDots current={3} total={4} />

      <GlassCard style={styles.gridCard}>
        <View style={styles.grid}>
          {avatarOptions.map((avatar) => (
            <Avatar
              avatar={avatar}
              key={avatar.id}
              label={avatar.name}
              onPress={() => setAvatar(avatar.id)}
              selected={profile.avatarId === avatar.id}
              showCard
              style={styles.avatarCard}
              subtitle={`${avatar.gender} • ${avatar.vibe}`}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.selectionCard}>
        <Text style={styles.selectionTitle}>Seçili avatar</Text>
        <Text style={styles.selectionText}>
          {getAvatarById(profile.avatarId).name} seçili. Eşleşme, profil ve gece modu kartlarında bu avatar kullanılacak.
        </Text>
      </GlassCard>

      <GradientButton onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })} title="Kaydı Tamamla" />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    paddingVertical: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  avatarCard: {
    width: '48%',
  },
  selectionCard: {
    gap: 6,
  },
  selectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  selectionText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
