import { useEffect, useMemo, useState } from 'react';
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
  const { profile, setAvatar, updateProfile } = useAppState();
  const [isCompleting, setIsCompleting] = useState(false);
  const filteredAvatars = useMemo(
    () => avatarOptions.filter((avatar) => avatar.gender === profile.gender),
    [profile.gender],
  );
  const selectedAvatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);

  useEffect(() => {
    if (!filteredAvatars.some((avatar) => avatar.id === profile.avatarId) && filteredAvatars[0]) {
      setAvatar(filteredAvatars[0].id);
    }
  }, [filteredAvatars, profile.avatarId, setAvatar]);

  const handleComplete = () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    updateProfile({ plan: 'free' });
    setIsCompleting(false);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        subtitle={profile.gender === 'Kadın' ? 'Senin için seçilmiş 4 kadın avatarı' : 'Senin için seçilmiş 4 erkek avatarı'}
        title="Avatarını Seç"
      />
      <ProgressDots current={3} total={4} />

      <GlassCard style={styles.gridCard}>
        <View style={styles.grid}>
          {filteredAvatars.map((avatar) => (
            <Avatar
              avatar={avatar}
              key={avatar.id}
              label={avatar.name}
              onPress={() => setAvatar(avatar.id)}
              selected={profile.avatarId === avatar.id}
              showCard
              size={72}
              style={styles.avatarCard}
              subtitle={avatar.vibe}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.selectionCard}>
        <Text style={styles.selectionTitle}>Seçili avatar</Text>
        <Text style={styles.selectionText}>
          {selectedAvatar.name} seçili. Profilinde, eşleşmede ve gece modu kartlarında bu avatar kullanılacak.
        </Text>
      </GlassCard>

      <GradientButton disabled={isCompleting} onPress={handleComplete} title={isCompleting ? 'Kayıt tamamlanıyor...' : 'Kaydı Tamamla'} />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  gridCard: {
    paddingVertical: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  avatarCard: {
    width: '48%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
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
