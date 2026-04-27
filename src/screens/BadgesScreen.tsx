import { StyleSheet, Text, View } from 'react-native';

import { BadgePill } from '../components/BadgePill';
import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { badges } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function BadgesScreen({ navigation }: AppScreenProps<'Badges'>) {
  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Ne kadar çok iyi gelirsen, o kadar yükselirsin" title="Rozet Sistemi" />

      {badges.map((badge) => (
        <GlassCard key={badge.id} style={styles.item}>
          <BadgePill badge={badge} />
          <View style={styles.copy}>
            <Text style={styles.name}>{badge.name}</Text>
            <Text style={styles.description}>{badge.description}</Text>
          </View>
        </GlassCard>
      ))}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: spacing.sm,
  },
  copy: {
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
});
