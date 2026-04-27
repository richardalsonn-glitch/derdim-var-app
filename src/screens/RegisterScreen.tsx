import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';

export function RegisterScreen({ navigation }: AppScreenProps<'Register'>) {
  const { profile, updateProfile } = useAppState();
  const [username, setUsername] = useState(profile.username);
  const [email, setEmail] = useState(profile.email ?? 'gizli@derdimvar.app');
  const [password, setPassword] = useState('12345678');

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Hızlı kayıt, anonim başlangıç" title="Kayıt Ol" />
      <ProgressDots current={1} total={4} />

      <GlassCard style={styles.card}>
        <FormInput icon="person-outline" label="Kullanıcı adı" onChangeText={setUsername} placeholder="takma ad seç" value={username} />
        <FormInput icon="lock-closed-outline" label="Şifre" onChangeText={setPassword} placeholder="şifre oluştur" secureTextEntry value={password} />
        <FormInput icon="mail-outline" label="E-posta" onChangeText={setEmail} placeholder="opsiyonel" value={email} />
        <GradientButton
          onPress={() => {
            updateProfile({ username, email });
            navigation.navigate('ProfileInfo');
          }}
          title="Devam Et"
        />
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
