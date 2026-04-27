import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';

export function SettingsScreen({ navigation }: AppScreenProps<'Settings'>) {
  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Demo güvenlik ve hesap ayarları" title="Ayarlar" />

      <GlassCard style={styles.card}>
        <Text style={styles.title}>Hesap</Text>
        <Text style={styles.text}>Sosyal giriş, moderasyon ve daha gelişmiş ayarlar ileride gerçek servislerle bağlanacak.</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.title}>Destek notu</Text>
        <Text style={styles.text}>Acil durumlarda profesyonel destek alman önemlidir.</Text>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  text: {
    color: colors.muted,
    lineHeight: 21,
  },
});
