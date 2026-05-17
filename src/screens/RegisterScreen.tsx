import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SocialAuthButtons } from '../components/auth/SocialAuthButtons';
import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import {
  completeSocialProfileSetup,
  restoreAuthProfile,
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
} from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type LegalKey = 'terms' | 'privacy' | 'community';

const legalContent: Record<LegalKey, { title: string; body: string }> = {
  terms: {
    title: 'Kullanım Şartları',
    body: 'DerdimVar profesyonel terapi, tıbbi destek veya acil yardım hizmeti değildir. Taciz, tehdit, nefret söylemi, dolandırıcılık ve yasa dışı kullanım yasaktır.',
  },
  privacy: {
    title: 'Gizlilik Politikası',
    body: 'DerdimVar içinde hesap bilgileri, profil verileri ve uygulama güvenliği için gerekli teknik kayıtlar işlenebilir. Mikrofon yalnızca sesli görüşme akışları için kullanılır.',
  },
  community: {
    title: 'Topluluk Kuralları',
    body: 'Anonimlik kötüye kullanım hakkı vermez. Rahatsız edici davranışlar, sınır ihlali ve zararlı içerikler yasaktır. Şikayet ve engelleme araçları güvenlik için kullanılabilir.',
  },
};

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

function normalizeSuggestedUsername(value?: string) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === 'anonim' || lowered === 'user' || lowered === 'anon') {
    return '';
  }

  return trimmed;
}

export function RegisterScreen({ navigation, route }: AppScreenProps<'Register'>) {
  const completionMode = route.params?.mode === 'socialCompletion';
  const socialProvider = route.params?.provider;
  const { profile, updateProfile } = useAppState();
  const [username, setUsername] = useState(normalizeSuggestedUsername(route.params?.suggestedUsername));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(route.params?.legalAccepted ?? false);
  const [selectedLegal, setSelectedLegal] = useState<LegalKey | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSocialProvider, setActiveSocialProvider] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    if (!completionMode) {
      return;
    }

    if (!username) {
      setUsername(normalizeSuggestedUsername(route.params?.suggestedUsername));
    }
  }, [completionMode, route.params?.suggestedUsername, username]);

  const legalAcceptedMessage =
    'Devam etmek için Kullanım Şartları, Gizlilik Politikası ve Topluluk Kuralları’nı kabul etmelisin.';

  const selectedLegalContent = useMemo(
    () => (selectedLegal ? legalContent[selectedLegal] : null),
    [selectedLegal],
  );

  const canSubmit = completionMode
    ? acceptedLegal && username.trim().length > 0 && !isSubmitting
    : acceptedLegal &&
      username.trim().length > 0 &&
      email.trim().length > 0 &&
      password.trim().length > 0 &&
      passwordConfirm.trim().length > 0 &&
      !isSubmitting;

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
          : username.trim() || profile.username,
      plan: restoredProfile.data?.profile?.plan ?? profile.plan,
      avatarId: restoredProfile.data?.profile?.avatarId ?? profile.avatarId,
      gender: restoredProfile.data?.profile?.gender ?? profile.gender,
      isFrozen: restoredProfile.data?.profile?.isFrozen ?? profile.isFrozen,
    }, { source: 'restore-auth' });

    navigation.replace(restoredProfile.data?.profile?.isFrozen ? 'FrozenAccount' : 'Home');
  };

  const handleRegister = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      showError('Lütfen bir rumuz belirle.');
      return;
    }

    if (!acceptedLegal) {
      showError(legalAcceptedMessage);
      return;
    }

    if (completionMode) {
      if (isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      const result = await completeSocialProfileSetup(trimmedUsername, acceptedLegal);
      setIsSubmitting(false);

      if (result.error) {
        showError(getFriendlyErrorMessage(result.error, 'Profil bilgileri kaydedilemedi.'));
        return;
      }

      updateProfile({
        username: result.data?.username ?? trimmedUsername,
        email: result.data?.email ?? profile.email,
        plan: result.data?.plan ?? profile.plan,
        avatarId: result.data?.avatarId ?? profile.avatarId,
        gender: result.data?.gender ?? profile.gender,
        isFrozen: result.data?.isFrozen ?? profile.isFrozen,
      }, { source: 'restore-auth' });

      navigation.navigate('ProfileInfo');
      return;
    }

    if (!trimmedEmail || !password.trim() || !passwordConfirm.trim()) {
      showError('Lütfen tüm alanları doldur.');
      return;
    }

    if (password !== passwordConfirm) {
      showError('Şifre ve şifre tekrar alanları aynı olmalı.');
      return;
    }

    if (isSubmitting || activeSocialProvider) {
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(trimmedEmail, password, trimmedUsername);

    if (result.error) {
      setIsSubmitting(false);
      showError(getFriendlyErrorMessage(result.error, 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.'));
      return;
    }

    if (result.data?.requiresEmailConfirmation) {
      setIsSubmitting(false);
      showError('Hesabin olusturuldu. Devam etmek icin e-postana gelen dogrulama baglantisini ac, sonra giris yap.');
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

  const handleAppleRegister = async () => {
    if (!acceptedLegal) {
      showError(legalAcceptedMessage);
      return;
    }

    if (isSubmitting || activeSocialProvider) {
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
        suggestedUsername: result.data.profile?.username ?? username,
        legalAccepted: true,
      });
      return;
    }

    await finalizeSignedInUser(result.data.user);
  };

  const handleGoogleRegister = async () => {
    if (!acceptedLegal) {
      showError(legalAcceptedMessage);
      return;
    }

    if (isSubmitting || activeSocialProvider) {
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
        suggestedUsername: result.data.profile?.username ?? username,
        legalAccepted: true,
      });
      return;
    }

    await finalizeSignedInUser(result.data.user);
  };

  const submitTitle = completionMode
    ? isSubmitting
      ? 'Bilgiler kaydediliyor...'
      : 'Devam Et'
    : isSubmitting
      ? 'Kayıt oluşturuluyor...'
      : 'Kayıt Ol';

  return (
    <PremiumScreen contentStyle={styles.screenContent}>
      <ScreenHeader
        subtitle={
          completionMode
            ? 'Sosyal girişini tamamlamak için rumuzunu ve onayını ekle'
            : 'Hızlı kayıt, anonim başlangıç'
        }
        title="Kayıt Ol"
      />

      <GlassCard style={styles.card} toned="strong">
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {completionMode ? 'Hesabını tamamla' : 'Hesabını oluştur'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {completionMode
              ? 'Rumuzunu belirle, onayını tamamla ve profil bilgilerine geç.'
              : 'Güvenli ve anonim bir başlangıç için bilgilerini tamamla.'}
          </Text>
        </View>

        {completionMode ? (
          <View style={styles.socialBadge}>
            <Ionicons
              color={socialProvider === 'apple' ? colors.text : colors.blue}
              name={socialProvider === 'apple' ? 'logo-apple' : 'logo-google'}
              size={16}
            />
            <Text style={styles.socialBadgeText}>
              {socialProvider === 'apple' ? 'Apple hesabın bağlandı' : 'Google hesabın bağlandı'}
            </Text>
          </View>
        ) : null}

        <FormInput
          autoCapitalize="words"
          icon="person-outline"
          label="Rumuz"
          onChangeText={setUsername}
          placeholder="Rumuzunu yaz"
          value={username}
        />

        {!completionMode ? (
          <>
            <FormInput
              autoCapitalize="none"
              icon="mail-outline"
              keyboardType="email-address"
              label="E-posta"
              onChangeText={setEmail}
              placeholder="E-posta"
              value={email}
            />

            <FormInput
              icon="lock-closed-outline"
              label="Şifre"
              onChangeText={setPassword}
              placeholder="Şifreni oluştur"
              secureTextEntry
              value={password}
            />

            <FormInput
              icon="shield-checkmark-outline"
              label="Şifre Tekrar"
              onChangeText={setPasswordConfirm}
              placeholder="Şifreni tekrar yaz"
              secureTextEntry
              value={passwordConfirm}
            />
          </>
        ) : null}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedLegal }}
          onPress={() => setAcceptedLegal((current) => !current)}
          style={[styles.checkboxRow, acceptedLegal && styles.checkboxRowActive]}
        >
          <View style={[styles.checkbox, acceptedLegal && styles.checkboxChecked]}>
            {acceptedLegal ? <Ionicons color={colors.text} name="checkmark" size={16} /> : null}
          </View>
          <Text style={styles.checkboxText}>
            <Text onPress={() => setSelectedLegal('terms')} style={styles.inlineLink}>
              Kullanım Şartları
            </Text>
            <Text>{'’nı, '}</Text>
            <Text onPress={() => setSelectedLegal('privacy')} style={styles.inlineLink}>
              Gizlilik Politikası
            </Text>
            <Text>{'’nı ve '}</Text>
            <Text onPress={() => setSelectedLegal('community')} style={styles.inlineLink}>
              Topluluk Kuralları
            </Text>
            <Text>{'’nı kabul ediyorum.'}</Text>
          </Text>
        </Pressable>

        {!acceptedLegal ? <Text style={styles.helperText}>{legalAcceptedMessage}</Text> : null}

        <GradientButton
          disabled={!canSubmit}
          muted={!canSubmit}
          onPress={handleRegister}
          title={submitTitle}
        />

        {!completionMode ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <SocialAuthButtons
              appleDisabled={!acceptedLegal || Boolean(activeSocialProvider) || isSubmitting}
              googleDisabled={!acceptedLegal || Boolean(activeSocialProvider) || isSubmitting}
              isAppleLoading={activeSocialProvider === 'apple'}
              isGoogleLoading={activeSocialProvider === 'google'}
              onApplePress={handleAppleRegister}
              onGooglePress={handleGoogleRegister}
            />
          </>
        ) : null}
      </GlassCard>

      {!completionMode ? (
        <Pressable onPress={() => navigation.replace('Login')}>
          <Text style={styles.link}>Zaten hesabın var mı? Giriş Yap</Text>
        </Pressable>
      ) : null}

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' }]}
        message={errorMessage || 'Kayıt sırasında bir hata oluştu.'}
        title="Kayıt tamamlanamadı"
        visible={errorVisible}
      />

      <NoticeModal
        actions={[{ label: 'Kapat', onPress: () => setSelectedLegal(null), variant: 'secondary' }]}
        message={selectedLegalContent?.body ?? ''}
        onClose={() => setSelectedLegal(null)}
        title={selectedLegalContent?.title ?? ''}
        visible={Boolean(selectedLegalContent)}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderColor: colors.borderStrong,
  },
  cardHeader: {
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  socialBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  socialBadgeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxRow: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  checkboxRowActive: {
    backgroundColor: 'rgba(153, 70, 255, 0.08)',
    borderColor: colors.borderStrong,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.dim,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  checkboxText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  inlineLink: {
    color: colors.pink,
    fontWeight: '700',
  },
  helperText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  link: {
    color: colors.pink,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
