import { StyleSheet, Text, View } from 'react-native';

import { ChoiceChip } from '../components/ChoiceChip';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';

export function ProfileInfoScreen({ navigation }: AppScreenProps<'ProfileInfo'>) {
  const { profile, updateProfile } = useAppState();

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Profil detaylarını tamamla" title="Profil Bilgilerin" />
      <ProgressDots current={2} total={4} />

      <GlassCard style={styles.card}>
        <View style={styles.block}>
          <Text style={styles.label}>Cinsiyet</Text>
          <View style={styles.row}>
            {(['Kadın', 'Erkek'] as const).map((gender) => (
              <ChoiceChip key={gender} label={gender} onPress={() => updateProfile({ gender })} selected={profile.gender === gender} />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Yaş</Text>
          <View style={styles.row}>
            {[22, 24, 27].map((age) => (
              <ChoiceChip key={age} label={String(age)} onPress={() => updateProfile({ age })} selected={profile.age === age} />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Medeni durum</Text>
          <View style={styles.row}>
            {['Bekar', 'İlişki', 'Karışık'].map((status) => (
              <ChoiceChip
                key={status}
                label={status}
                onPress={() => updateProfile({ relationshipStatus: status })}
                selected={profile.relationshipStatus === status}
              />
            ))}
          </View>
        </View>

        <GradientButton onPress={() => navigation.navigate('AvatarSelection')} title="Devam Et" />
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
});
