import { useState } from 'react';
import { ActivityIndicator, ImageBackground, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoticeModal } from '../components/NoticeModal';
import { colors, gradients, layout, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile, signInWithEmail } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

const loginBackground = require('../../assets/images/anasayfayeni12.png');

export function LoginScreen({ navigation }: AppScreenProps<'Login'>) {
  const { height, width } = useWindowDimensions();
  const { profile, updateProfile } = useAppState();
  const canGoBack = navigation.canGoBack();
  const [email, setEmail] = useState(profile.email ?? '');
  const [password] = useState('12345678');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tiny = height < 720;
  const compact = height < 800;
  const horizontalPadding = width < 380 ? 18 : 24;
  const moduleTop = height * (tiny ? 0.515 : compact ? 0.53 : 0.54);
  const moduleMaxWidth = Math.min(layout.maxWidth - 24, width - horizontalPadding * 2);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Lütfen telefon veya e-posta alanını doldur.');
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
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Giriş yapılamadı. Lütfen bilgilerini kontrol edip tekrar dene.'));
      setErrorVisible(true);
      return;
    }

    const restoredProfile = await restoreAuthProfile(result.data?.user ?? null);

    if (restoredProfile.error) {
      setIsSubmitting(false);
      setErrorMessage(getFriendlyErrorMessage(restoredProfile.error, 'Oturum bilgilerin alınamadı. Lütfen tekrar giriş yap.'));
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
      isFrozen: restoredProfile.data?.profile?.isFrozen ?? profile.isFrozen,
    });
    setIsSubmitting(false);
    navigation.replace(restoredProfile.data?.profile?.isFrozen ? 'FrozenAccount' : 'Home');
  };

  return (
    <ImageBackground resizeMode="cover" source={loginBackground} style={styles.background}>
      <View pointerEvents="none" style={styles.readabilityOverlay} />
      <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
        {canGoBack ? (
          <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { left: horizontalPadding, top: tiny ? 8 : 10 }]}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </Pressable>
        ) : null}

        <View style={[styles.loginModule, { maxWidth: moduleMaxWidth, top: moduleTop }]}>
          <LinearGradient
            colors={['rgba(9,12,34,0.48)', 'rgba(68,31,102,0.36)', 'rgba(9,12,34,0.48)']}
            style={[styles.moduleGlass, { gap: tiny ? 5 : 6, padding: tiny ? 8 : 10 }]}
          >
            <View style={[styles.inputShell, { height: tiny ? 36 : 42 }]}>
              <Ionicons color={colors.muted} name="person-circle-outline" size={20} />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Telefon / E-posta"
                placeholderTextColor="rgba(247,238,255,0.62)"
                style={styles.input}
                value={email}
              />
            </View>

            <Pressable disabled={isSubmitting} onPress={handleLogin} style={isSubmitting && styles.disabled}>
              <LinearGradient
                colors={[...gradients.primary]}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={[styles.primaryButton, { height: tiny ? 38 : 42 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Devam Et</Text>
                    <Ionicons color={colors.text} name="arrow-forward" size={18} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.secondaryRow}>
              <Pressable disabled={isSubmitting} onPress={handleLogin} style={[styles.secondaryButton, { height: tiny ? 32 : 36 }]}>
                <Text style={styles.secondaryButtonText}>Giriş Yap</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Register')} style={[styles.secondaryButton, styles.registerButton, { height: tiny ? 32 : 36 }]}>
                <Text style={styles.secondaryButtonText}>Kayıt Ol</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>

      <NoticeModal
        actions={[
          { label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' },
        ]}
        message={errorMessage || 'Giriş sırasında bir hata oluştu.'}
        title="Giriş tamamlanamadı"
        visible={errorVisible}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.backgroundDeep,
    flex: 1,
  },
  readabilityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,5,18,0.08)',
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(7,10,28,0.42)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    width: 42,
  },
  loginModule: {
    alignSelf: 'center',
    paddingHorizontal: 0,
    position: 'absolute',
    width: '100%',
  },
  moduleGlass: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: colors.pink,
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(174,111,255,0.34)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.72,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dividerLine: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: 'rgba(247,238,255,0.72)',
    fontSize: 11,
    fontWeight: '800',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  registerButton: {
    borderColor: 'rgba(255,79,185,0.32)',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
