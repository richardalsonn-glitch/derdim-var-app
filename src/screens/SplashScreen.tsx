import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { NoticeModal } from '../components/NoticeModal';
import { AuthLandingLayout } from '../components/auth/AuthLandingLayout';
import { useAppState } from '../data/AppContext';
import { logSafeDebug, logSafeWarn } from '../lib/safeLogger';
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile, signInWithEmail } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

export function SplashScreen({ navigation }: AppScreenProps<'Splash'>) {
  const { profile, updateProfile } = useAppState();
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const loadingPulse = useRef(new Animated.Value(0.5)).current;
  const initStarted = useRef(false);
  const hasResolvedNavigation = useRef(false);
  const isMounted = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;

    if (initStarted.current) {
      return;
    }

    initStarted.current = true;

    const resolveNavigation = (
      target: 'Login' | 'Home' | 'FrozenAccount',
      reason: string,
      patch?: Parameters<typeof updateProfile>[0],
    ) => {
      if (hasResolvedNavigation.current || !isMounted.current) {
        return;
      }

      hasResolvedNavigation.current = true;

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      if (patch) {
        updateProfile(patch, { source: 'restore-auth' });
      }

      logSafeDebug('splash:navigate', reason, {
        functionName: 'resolveNavigation',
        source: target,
      });

      try {
        navigation.reset({
          index: 0,
          routes: [{ name: target }],
        });
      } catch (error) {
        logSafeWarn('splash:navigation_failed', error, {
          functionName: 'resolveNavigation',
          source: target,
        });

        if (isMounted.current) {
          setInitialAuthChecked(true);
        }
      }
    };

    fallbackTimerRef.current = setTimeout(() => {
      logSafeWarn('splash:fallback_timeout', 'Splash init timeout triggered.', {
        functionName: 'initSplash',
        source: 'Login',
      });
      resolveNavigation('Login', 'fallback-timeout');
    }, 3500);

    logSafeDebug('splash:init_start', 'Splash init started.', {
      functionName: 'initSplash',
      source: 'Splash',
    });

    void (async () => {
      try {
        const result = await restoreAuthProfile();

        if (!isMounted.current || hasResolvedNavigation.current) {
          return;
        }

        if (result.data?.user) {
          logSafeDebug('splash:session_found', 'Session found during splash restore.', {
            functionName: 'initSplash',
            source: result.data.profile?.isFrozen ? 'FrozenAccount' : 'Home',
          });

          resolveNavigation(
            result.data.profile?.isFrozen ? 'FrozenAccount' : 'Home',
            result.data.profile ? 'profile-restore-success' : 'profile-restore-partial',
            {
              email: result.data.user.email ?? profile.email,
              username: result.data.profile?.username ?? profile.username,
              plan: result.data.profile?.plan ?? profile.plan,
              avatarId: result.data.profile?.avatarId ?? profile.avatarId,
              gender: result.data.profile?.gender ?? profile.gender,
              isFrozen: result.data.profile?.isFrozen ?? profile.isFrozen,
            },
          );
          return;
        }

        if (result.error) {
          logSafeWarn('splash:restore_error', result.error.message, {
            functionName: 'initSplash',
            source: 'Login',
          });
          resolveNavigation('Login', 'restore-error');
          return;
        }

        logSafeDebug('splash:no_session', 'No active session found during splash restore.', {
          functionName: 'initSplash',
          source: 'Login',
        });
        resolveNavigation('Login', 'no-session');
      } catch (error) {
        if (!isMounted.current || hasResolvedNavigation.current) {
          return;
        }

        logSafeWarn('splash:restore_exception', error, {
          functionName: 'initSplash',
          source: 'Login',
        });
        resolveNavigation('Login', 'restore-exception');
      } finally {
        if (!hasResolvedNavigation.current && isMounted.current) {
          setInitialAuthChecked(true);
        }
      }
    })();

    return () => {
      isMounted.current = false;

      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [navigation, profile.avatarId, profile.email, profile.isFrozen, profile.plan, profile.username, updateProfile]);

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(loadingPulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ]),
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [loadingPulse]);

  async function handleLogin() {
    const email = identifier.trim();
    const submittedPassword = password.length > 0 ? password : '12345678';

    if (!email) {
      setErrorMessage('Lütfen e-posta veya telefon alanını doldur.');
      setErrorVisible(true);
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(email, submittedPassword);

    if (result.error) {
      setIsSubmitting(false);
      setErrorMessage(getFriendlyErrorMessage(result.error, 'E-posta veya şifre hatalı.'));
      setErrorVisible(true);
      return;
    }

    const restoredProfile = await restoreAuthProfile(result.data?.user ?? null);

    if (restoredProfile.error) {
      setIsSubmitting(false);
      setErrorMessage(
        getFriendlyErrorMessage(restoredProfile.error, 'Oturum bilgilerin alınamadı. Lütfen tekrar giriş yap.'),
      );
      setErrorVisible(true);
      return;
    }

    const authUsername =
      restoredProfile.data?.profile?.username ?? result.data?.user?.user_metadata?.username;

    updateProfile({
      email: result.data?.user?.email ?? email,
      username:
        typeof authUsername === 'string' && authUsername.length > 0
          ? authUsername
          : profile.username,
      plan: restoredProfile.data?.profile?.plan ?? profile.plan,
      avatarId: restoredProfile.data?.profile?.avatarId ?? profile.avatarId,
      gender: restoredProfile.data?.profile?.gender ?? profile.gender,
      isFrozen: restoredProfile.data?.profile?.isFrozen ?? profile.isFrozen,
    }, { source: 'restore-auth' });

    setIsSubmitting(false);
    navigation.reset({
      index: 0,
      routes: [{ name: restoredProfile.data?.profile?.isFrozen ? 'FrozenAccount' : 'Home' }],
    });
  }

  if (!initialAuthChecked) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0A0327', '#15052E', '#0A0327']} style={StyleSheet.absoluteFill} />
        <View style={styles.loaderWrap}>
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
                opacity: loadingPulse.interpolate({ inputRange: [0.5, 1], outputRange: [0.7, 1] }),
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <AuthLandingLayout
        emailValue={identifier}
        isSubmitting={isSubmitting}
        onChangeEmail={setIdentifier}
        onChangePassword={setPassword}
        onRegister={() => navigation.navigate('Register')}
        onSubmit={handleLogin}
        passwordValue={password}
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

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0A0327',
    flex: 1,
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
});
