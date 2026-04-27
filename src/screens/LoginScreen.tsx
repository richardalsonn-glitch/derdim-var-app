import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { signInWithEmail } from '../services/authService';
import { AppScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  const { profile, updateProfile } = useAppState();
  const [username, setUsername] = useState(profile.username);
  const [password, setPassword] = useState('12345678');

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Anonim ses odasına giriş yap" title="Giriş Yap" />

      <GlassCard style={styles.card}>
        <FormInput icon="person-outline" label="Kullanıcı adı" onChangeText={setUsername} placeholder="derdimvar_01" value={username} />
        <FormInput icon="eye-outline" label="Şifre" onChangeText={setPassword} placeholder="••••••••" secureTextEntry value={password} />
        <GradientButton
          onPress={async () => {
            await signInWithEmail();
            updateProfile({ username });
            navigation.replace('Home');
          }}
          title="Demo olarak devam et"
        />
      </GlassCard>

      <Text style={styles.meta}>Bu uygulama terapi hizmeti sunmaz; anonim sosyal destek ve dertleşme alanı olarak konumlanır.</Text>
      <Text style={styles.support}>Acil durumlarda profesyonel destek alman önemlidir.</Text>

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
  support: {
    color: colors.dim,
    lineHeight: 19,
  },
  link: {
    color: colors.pink,
    textAlign: 'center',
    fontWeight: '700',
  },
});
