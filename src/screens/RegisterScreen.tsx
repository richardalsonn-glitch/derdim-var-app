import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { signUpWithEmail } from '../services/authService';

export function RegisterScreen({ navigation }: AppScreenProps<'Register'>) {
  const { updateProfile } = useAppState();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || !trimmedEmail || !password.trim()) {
      setErrorMessage('Lütfen tüm alanları doldur.');
      setErrorVisible(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(trimmedEmail, password, trimmedUsername);

    if (result.error) {
      setIsSubmitting(false);
      setErrorMessage(result.error.message);
      setErrorVisible(true);
      return;
    }

    updateProfile({
      username: trimmedUsername,
      email: trimmedEmail,
      age: 0,
      birthDate: undefined,
      relationshipStatus: '',
      plan: 'free',
    });
    setIsSubmitting(false);
    navigation.navigate('ProfileInfo');
  };

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Hızlı kayıt, anonim başlangıç" title="Kayıt Ol" />
      <ProgressDots current={1} total={4} />

      <GlassCard style={styles.card}>
        <FormInput
          autoCapitalize="none"
          icon="person-outline"
          label="Kullanıcı adı"
          onChangeText={setUsername}
          placeholder="Takma ad seç"
          value={username}
        />
        <FormInput
          icon="lock-closed-outline"
          label="Şifre"
          onChangeText={setPassword}
          placeholder="Şifre oluştur"
          secureTextEntry
          value={password}
        />
        <FormInput
          autoCapitalize="none"
          icon="mail-outline"
          keyboardType="email-address"
          label="E-posta"
          onChangeText={setEmail}
          placeholder="Mail adresin"
          value={email}
        />
        <GradientButton disabled={isSubmitting} onPress={handleRegister} title={isSubmitting ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol'} />
      </GlassCard>

      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Zaten hesabın var mı? Giriş Yap</Text>
      </Pressable>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' }]}
        message={errorMessage || 'Kayıt sırasında bir hata oluştu.'}
        title="Kayıt başarısız"
        visible={errorVisible}
      />
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
