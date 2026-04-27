import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';

export function RegisterScreen({ navigation }: AppScreenProps<'Register'>) {
  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Hızlı kayıt, anonim başlangıç" title="Kayıt Ol" />
      <ProgressDots current={1} total={4} />

      <GlassCard style={styles.card}>
        <FormInput icon="person-outline" label="Kullanıcı adı" placeholder="takma ad seç" value="merve_24" />
        <FormInput icon="lock-closed-outline" label="Şifre" placeholder="şifre oluştur" secureTextEntry value="12345678" />
        <FormInput icon="mail-outline" label="E-posta" placeholder="opsiyonel" value="gizli@derdimvar.app" />
        <GradientButton onPress={() => navigation.navigate('ProfileInfo')} title="Devam Et" />
      </GlassCard>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Zaten hesabın var mı? Giriş Yap</Text>
      </Pressable>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  link: {
    color: colors.pink,
    textAlign: 'center',
    fontWeight: '700',
  },
});
