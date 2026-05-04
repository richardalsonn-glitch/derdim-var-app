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
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile, signInWithEmail } from '../services/authService';

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  const { profile, updateProfile } = useAppState();
  const canGoBack = navigation.canGoBack();
  const [email, setEmail] = useState(profile.email ?? 'gizli@derdimvar.app');
  const [password, setPassword] = useState('12345678');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password.trim()) {
      setErrorMessage('Lutfen e-posta ve sifre alanlarini doldur.');
      setErrorVisible(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(trimmedEmail, password);

    if (result.error) {
      setIsSubmitting(false);
      setErrorMessage(result.error.message);
      setErrorVisible(true);
      return;
    }

    const restoredProfile = await restoreAuthProfile(result.data?.user ?? null);

    if (restoredProfile.error) {
      setIsSubmitting(false);
      setErrorMessage(restoredProfile.error.message);
      setErrorVisible(true);
      return;
    }

    const authUsername =
      restoredProfile.data?.profile?.username ?? result.data?.user?.user_metadata?.username;

    updateProfile({
      email: result.data?.user?.email ?? trimmedEmail,
      username:
        typeof authUsername === 'string' && authUsername.length > 0
          ? authUsername
          : profile.username,
      plan: restoredProfile.data?.profile?.plan ?? profile.plan,
      avatarId: restoredProfile.data?.profile?.avatarId ?? profile.avatarId,
    });
    setIsSubmitting(false);
    navigation.replace('Home');
  };

  return (
    <PremiumScreen>
      <ScreenHeader
        onBack={canGoBack ? () => navigation.goBack() : undefined}
        subtitle="Anonim ses odasina giris yap"
        title="Giris Yap"
      />

      <GlassCard style={styles.card}>
        <FormInput
          autoCapitalize="none"
          icon="mail-outline"
          keyboardType="email-address"
          label="E-posta"
          onChangeText={setEmail}
          placeholder="mail adresin"
          value={email}
        />
        <FormInput
          icon="eye-outline"
          label="Sifre"
          onChangeText={setPassword}
          placeholder="********"
          secureTextEntry
          value={password}
        />
        <GradientButton
          disabled={isSubmitting}
          onPress={handleLogin}
          title={isSubmitting ? 'Giris yapiliyor...' : 'Giris Yap'}
        />
      </GlassCard>

      <Text style={styles.meta}>
        Bu uygulama terapi hizmeti sunmaz; anonim sosyal destek ve dertlesme alani olarak
        konumlanir.
      </Text>
      <Text style={styles.support}>Acil durumlarda profesyonel destek alman onemlidir.</Text>

      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Hesabin yok mu? Kayit Ol</Text>
      </Pressable>

      <NoticeModal
        actions={[
          { label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' },
        ]}
        message={errorMessage || 'Giris sirasinda bir hata olustu.'}
        title="Giris basarisiz"
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
