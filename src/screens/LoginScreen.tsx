import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Anonim ses odasına giriş yap" title="Giriş Yap" />

      <GlassCard style={styles.card}>
        <FormInput icon="person-outline" label="Kullanıcı adı" placeholder="derdimvar_01" value="derdimvar_01" />
        <FormInput icon="eye-outline" label="Şifre" placeholder="••••••••" secureTextEntry value="12345678" />
        <GradientButton onPress={() => navigation.replace('Home')} title="Devam Et" />
      </GlassCard>

      <Text style={styles.meta}>Demo akışında backend yok. Tüm ekranlar premium UI mantığıyla mock data üzerinden ilerler.</Text>

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt Ol</Text>
      </Pressable>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  meta: {
    color: colors.muted,
    lineHeight: 20,
  },
  link: {
    color: colors.pink,
    textAlign: 'center',
    fontWeight: '700',
  },
});
