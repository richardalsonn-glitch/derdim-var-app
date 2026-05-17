import { useState } from 'react';

import { NoticeModal } from '../components/NoticeModal';
import { AuthLandingLayout } from '../components/auth/AuthLandingLayout';
import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import {
  restoreAuthProfile,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

function resolveSocialErrorMessage(provider: 'apple' | 'google', message?: string) {
  const normalized = (message ?? '').toLowerCase();

  if (normalized.includes('iptal')) {
    return message ?? 'İşlem iptal edildi.';
  }

  if (
    normalized.includes('provider') ||
    normalized.includes('redirect') ||
    normalized.includes('callback') ||
    normalized.includes('url') ||
    normalized.includes('config') ||
    normalized.includes('yapılandır')
  ) {
    return provider === 'apple'
      ? 'Apple ile giriş şu anda yapılandırılıyor.'
      : 'Google ile giriş şu anda yapılandırılıyor.';
  }

  return provider === 'apple'
    ? 'Apple ile giriş şu anda tamamlanamadı. Lütfen daha sonra tekrar dene.'
    : 'Google ile giriş şu anda tamamlanamadı. Lütfen daha sonra tekrar dene.';
}

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  const { profile, updateProfile } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSocialProvider, setActiveSocialProvider] = useState<'apple' | 'google' | null>(null);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorVisible(true);
  };

  const finalizeSignedInUser = async (preferredUser?: unknown) => {
    const restoredProfile = await restoreAuthProfile((preferredUser as never) ?? null);

    if (restoredProfile.error) {
      showError(
        getFriendlyErrorMessage(
          restoredProfile.error,
          'Oturum bilgilerin alınamadı. Lütfen tekrar giriş yap.',
        ),
      );
      return;
    }

    const authUsername =
      restoredProfile.data?.profile?.username ?? restoredProfile.data?.user?.user_metadata?.username;

    updateProfile({
      email: restoredProfile.data?.user?.email ?? profile.email,
      username:
        typeof authUsername === 'string' && authUsername.length > 0
          ? authUsername
          : profile.username,
      plan: restoredProfile.data?.profile?.plan ?? profile.plan,
      avatarId: restoredProfile.data?.profile?.avatarId ?? profile.avatarId,
      isFrozen: restoredProfile.data?.profile?.isFrozen ?? profile.isFrozen,
    }, { source: 'restore-auth' });

    navigation.replace(restoredProfile.data?.profile?.isFrozen ? 'FrozenAccount' : 'Home');
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const submittedPassword = password.length > 0 ? password : '12345678';

    if (!trimmedEmail) {
      showError('Lütfen e-posta alanını doldur.');
      return;
    }

    if (isSubmitting || activeSocialProvider) {
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(trimmedEmail, submittedPassword);

    if (result.error) {
      setIsSubmitting(false);
      showError(
        getFriendlyErrorMessage(
          result.error,
          'Giriş yapılamadı. Lütfen bilgilerini kontrol edip tekrar dene.',
        ),
      );
      return;
    }

    setIsSubmitting(false);
    await finalizeSignedInUser(result.data?.user ?? null);
  };

  const handleAppleLogin = async () => {
    if (activeSocialProvider || isSubmitting) {
      return;
    }

    setActiveSocialProvider('apple');
    const result = await signInWithApple();
    setActiveSocialProvider(null);

    if (result.error || !result.data?.user) {
      showError(resolveSocialErrorMessage('apple', result.error?.message));
      return;
    }

    if (result.data.isNewUser || result.data.requiresProfileCompletion) {
      navigation.replace('Register', {
        mode: 'socialCompletion',
        provider: 'apple',
        suggestedUsername: result.data.profile?.username ?? '',
        legalAccepted: false,
      });
      return;
    }

    await finalizeSignedInUser(result.data.user);
  };

  const handleGoogleLogin = async () => {
    if (activeSocialProvider || isSubmitting) {
      return;
    }

    setActiveSocialProvider('google');
    const result = await signInWithGoogle();
    setActiveSocialProvider(null);

    if (result.error || !result.data?.user) {
      showError(resolveSocialErrorMessage('google', result.error?.message));
      return;
    }

    if (result.data.isNewUser || result.data.requiresProfileCompletion) {
      navigation.replace('Register', {
        mode: 'socialCompletion',
        provider: 'google',
        suggestedUsername: result.data.profile?.username ?? '',
        legalAccepted: false,
      });
      return;
    }

    await finalizeSignedInUser(result.data.user);
  };

  return (
    <>
      <AuthLandingLayout
        emailValue={email}
        isSubmitting={isSubmitting}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onRegister={() => navigation.navigate('Register')}
        onSubmit={handleLogin}
        passwordValue={password}
        socialSection={
          <SocialAuthButtons
            appleDisabled={Boolean(activeSocialProvider) || isSubmitting}
            googleDisabled={Boolean(activeSocialProvider) || isSubmitting}
            isAppleLoading={activeSocialProvider === 'apple'}
            isGoogleLoading={activeSocialProvider === 'google'}
            onApplePress={handleAppleLogin}
            onGooglePress={handleGoogleLogin}
          />
        }
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' }]}
        message={errorMessage || 'Giriş sırasında bir hata oluştu.'}
        title="Giriş tamamlanamadı"
        visible={errorVisible}
      />
    </>
  );
}
