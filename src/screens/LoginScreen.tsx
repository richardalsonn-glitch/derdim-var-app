import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { signInWithEmail } from '../services/authService';
import { AppScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  const { profile, updateProfile } = useAppState();
  const canGoBack = navigation.canGoBack();
  const [email, setEmail] = useState(profile.email ?? 'gizli@derdimvar.app');
  const [password, setPassword] = useState('12345678');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);

  const handleLogin = async () => {
    const result = await signInWithEmail(email, password);

    if (result.error) {
      setErrorMessage(result.error.message);
      setErrorVisible(true);
      return;
    }

    const authUsername = result.data?.user?.user_metadata?.username;
    updateProfile({
      email,
      username: typeof authUsername === 'string' && authUsername.length > 0 ? authUsername : profile.username,
    });
    navigation.replace('Home');
  };

  return (
    <PremiumScreen>
      <ScreenHeader onBack={canGoBack ? () => navigation.goBack() : undefined} subtitle="Anonim ses odasına giriş yap" title="Giriş Yap" />

      <GlassCard style={styles.card}>
        <FormInput icon="mail-outline" label="E-posta" onChangeText={setEmail} placeholder="mail adresin" value={email} />
        <FormInput icon="eye-outline" label="Şifre" onChangeText={setPassword} placeholder="••••••••" secureTextEntry value={password} />
        <GradientButton onPress={handleLogin} title="Giriş Yap" />
      </GlassCard>

      <Text style={styles.meta}>Bu uygulama terapi hizmeti sunmaz; anonim sosyal destek ve dertleşme alanı olarak konumlanır.</Text>
      <Text style={styles.support}>Acil durumlarda profesyonel destek alman önemlidir.</Text>

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Hesabın yok mu? Kayıt Ol</Text>
      </Pressable>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' }]}
        message={errorMessage || 'Giriş sırasında bir hata oluştu.'}
        title="Giriş başarısız"
        visible={errorVisible}
      />
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
