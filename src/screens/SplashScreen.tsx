import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeModal } from '../components/NoticeModal';
import { colors, gradients, layout, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile, signInWithEmail, signUpWithEmail } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

const welcomeBg = require('../../assets/images/anasayfayeni12.png');

type AuthMode = 'login' | 'register';

type AuthFieldProps = {
  compact?: boolean;
  height: number;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address';
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function AuthField({
  compact = false,
  height,
  icon,
  keyboardType = 'default',
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: AuthFieldProps) {
  return (
    <View style={[styles.inputShell, compact && styles.compactInputShell, { height }]}>
      <Ionicons color={colors.muted} name={icon} size={compact ? 16 : 18} />
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(247,238,255,0.62)"
        secureTextEntry={secureTextEntry}
        style={[styles.input, compact && styles.compactInput]}
        value={value}
      />
    </View>
  );
}

export function SplashScreen({ navigation }: AppScreenProps<'Splash'>) {
  const { height, width } = useWindowDimensions();
  const { profile, updateProfile } = useAppState();
  const [assetReady, setAssetReady] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const heroFade = useRef(new Animated.Value(0)).current;
  const loadingPulse = useRef(new Animated.Value(0.5)).current;
  const restoreStarted = useRef(false);

  const tiny = height < 720;
  const compact = height < 800;
  const horizontalPadding = width < 380 ? 18 : 24;
  const moduleTop = height * (tiny ? 0.49 : compact ? 0.505 : 0.52);
  const moduleMaxWidth = Math.min(layout.maxWidth - 24, width - horizontalPadding * 2);
  const fieldHeight = tiny ? 32 : 36;
  const buttonHeight = tiny ? 36 : 40;

  useEffect(() => {
    if (restoreStarted.current) {
      return;
    }

    restoreStarted.current = true;
    let mounted = true;

    void restoreAuthProfile().then((result) => {
      if (!mounted) {
        return;
      }

      if (result.error) {
        console.error('[auth] restore session failed:', result.error.message);
        setSessionRestored(true);
        return;
      }

      if (result.data?.user) {
        updateProfile({
          email: result.data.user.email ?? profile.email,
          username: result.data.profile?.username ?? profile.username,
          plan: result.data.profile?.plan ?? profile.plan,
          avatarId: result.data.profile?.avatarId ?? profile.avatarId,
          isFrozen: result.data.profile?.isFrozen ?? profile.isFrozen,
        });

        navigation.reset({
          index: 0,
          routes: [{ name: result.data.profile?.isFrozen ? 'FrozenAccount' : 'Home' }],
        });
        return;
      }

      setSessionRestored(true);
    });

    return () => {
      mounted = false;
    };
  }, [navigation, profile.avatarId, profile.email, profile.plan, profile.username, updateProfile]);

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(loadingPulse, {
          toValue: 0.5,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();

    let mounted = true;
    const asset = Asset.fromModule(welcomeBg);

    void asset.downloadAsync().finally(() => {
      if (!mounted) {
        return;
      }

      setAssetReady(true);
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      mounted = false;
      pulseAnimation.stop();
    };
  }, [heroFade, loadingPulse]);

  function enterWithProfile(userEmail: string | null | undefined, restoredProfile: Awaited<ReturnType<typeof restoreAuthProfile>>) {
    updateProfile({
      email: userEmail ?? identifier.trim(),
      username: restoredProfile.data?.profile?.username ?? profile.username,
      plan: restoredProfile.data?.profile?.plan ?? profile.plan,
      avatarId: restoredProfile.data?.profile?.avatarId ?? profile.avatarId,
      isFrozen: restoredProfile.data?.profile?.isFrozen ?? profile.isFrozen,
    });

    navigation.reset({
      index: 0,
      routes: [{ name: restoredProfile.data?.profile?.isFrozen ? 'FrozenAccount' : 'Home' }],
    });
  }

  async function handleLogin() {
    const email = identifier.trim();

    if (!email) {
      setErrorMessage('Lütfen e-posta adresini gir.');
      setErrorVisible(true);
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Lütfen şifreni gir.');
      setErrorVisible(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(email, password);

    if (result.error) {
      setIsSubmitting(false);
      setErrorMessage(getFriendlyErrorMessage(result.error, 'E-posta veya şifre hatalı.'));
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

    setIsSubmitting(false);
    enterWithProfile(result.data?.user?.email, restoredProfile);
  }

  async function handleRegister() {
    const trimmedUsername = username.trim();
    const email = identifier.trim();

    if (!trimmedUsername) {
      setErrorMessage('Lütfen kullanıcı adını gir.');
      setErrorVisible(true);
      return;
    }

    if (!email) {
      setErrorMessage('Lütfen e-posta adresini gir.');
      setErrorVisible(true);
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Lütfen şifreni gir.');
      setErrorVisible(true);
      return;
    }

    if (password !== passwordRepeat) {
      setErrorMessage('Şifreler eşleşmiyor.');
      setErrorVisible(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(email, password, trimmedUsername);

    if (result.error) {
      setIsSubmitting(false);
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.'));
      setErrorVisible(true);
      return;
    }

    updateProfile({
      username: trimmedUsername,
      email,
      age: 0,
      birthDate: undefined,
      relationshipStatus: '',
      plan: 'free',
    });
    setIsSubmitting(false);
    navigation.navigate('ProfileInfo');
  }

  function switchMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setErrorVisible(false);
    setErrorMessage('');
  }

  return (
    <View style={styles.screen}>
      <ImageBackground resizeMode="contain" source={welcomeBg} style={styles.background}>
        <Animated.View style={[styles.imageFade, { opacity: heroFade }]} />
        <View pointerEvents="none" style={styles.readabilityOverlay} />

        {!assetReady || !sessionRestored ? (
          <View pointerEvents="none" style={styles.loaderWrap}>
            <Animated.View
              style={[
                styles.loaderGlow,
                { opacity: loadingPulse, transform: [{ scale: loadingPulse }] },
              ]}
            />
            <Animated.View
              style={[
                styles.loaderCore,
                {
                  opacity: loadingPulse.interpolate({
                    inputRange: [0.5, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ]}
            />
          </View>
        ) : null}

        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <View style={styles.dismissLayer}>
            <View
          style={[
            styles.loginModule,
            {
              maxWidth: moduleMaxWidth,
              paddingBottom: Math.max(insets.bottom, 8),
              top: moduleTop,
            },
          ]}
            >
              <LinearGradient
            colors={['rgba(9,12,34,0.48)', 'rgba(68,31,102,0.36)', 'rgba(9,12,34,0.48)']}
            style={[styles.moduleGlass, { gap: tiny ? 5 : 6, padding: tiny ? 8 : 10 }]}
          >
            {authMode === 'register' ? (
              <AuthField
                height={fieldHeight}
                icon="person-outline"
                onChangeText={setUsername}
                placeholder="Kullanıcı adı"
                value={username}
              />
            ) : null}

            <AuthField
              height={fieldHeight}
              icon="mail-outline"
              keyboardType="email-address"
              onChangeText={setIdentifier}
              placeholder="E-posta / Telefon"
              value={identifier}
            />

            {authMode === 'register' ? (
              <View style={styles.passwordRow}>
                <AuthField
                  compact
                  height={fieldHeight}
                  icon="lock-closed-outline"
                  onChangeText={setPassword}
                  placeholder="Şifre"
                  secureTextEntry
                  value={password}
                />
                <AuthField
                  compact
                  height={fieldHeight}
                  icon="checkmark-circle-outline"
                  onChangeText={setPasswordRepeat}
                  placeholder="Tekrar"
                  secureTextEntry
                  value={passwordRepeat}
                />
              </View>
            ) : (
              <AuthField
                height={fieldHeight}
                icon="lock-closed-outline"
                onChangeText={setPassword}
                placeholder="Şifre"
                secureTextEntry
                value={password}
              />
            )}

            <Pressable disabled={isSubmitting} onPress={authMode === 'login' ? handleLogin : handleRegister} style={isSubmitting && styles.disabled}>
              <LinearGradient
                colors={[...gradients.primary]}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={[styles.primaryButton, { height: buttonHeight }]}
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'İşleniyor...' : authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</Text>
                {!isSubmitting ? <Ionicons color={colors.text} name="arrow-forward" size={18} /> : null}
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.modeSwitchRow}>
              <Text style={styles.modeSwitchText}>{authMode === 'login' ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'}</Text>
              <Pressable onPress={() => switchMode(authMode === 'login' ? 'register' : 'login')}>
                <Text style={styles.modeSwitchButton}>{authMode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
              </Pressable>
            </View>
              </LinearGradient>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ImageBackground>

      <NoticeModal
        actions={[
          { label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' },
        ]}
        message={errorMessage || 'İşlem sırasında bir hata oluştu.'}
        title={authMode === 'login' ? 'Giriş tamamlanamadı' : 'Kayıt tamamlanamadı'}
        visible={errorVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.backgroundDeep,
    flex: 1,
  },
  background: {
    flex: 1,
  },
  imageFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  readabilityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,5,18,0.06)',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderGlow: {
    backgroundColor: 'rgba(146, 72, 255, 0.18)',
    borderRadius: 80,
    height: 160,
    width: 160,
  },
  loaderCore: {
    backgroundColor: 'rgba(255, 79, 185, 0.72)',
    borderRadius: 26,
    height: 52,
    position: 'absolute',
    shadowColor: '#A35BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 22,
    width: 52,
  },
  dismissLayer: {
    flex: 1,
  },
  loginModule: {
    alignSelf: 'center',
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
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  compactInputShell: {
    paddingHorizontal: spacing.sm,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },
  compactInput: {
    fontSize: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  modeSwitchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 22,
  },
  modeSwitchText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeSwitchButton: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: '900',
  },
});
