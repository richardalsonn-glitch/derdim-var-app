import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeModal } from '../components/NoticeModal';
import { colors } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile, signInWithApple, signInWithGoogle } from '../services/authService';

const welcomeBg = require('../../assets/images/giris-ekrani2.png');

type SplashActionButtonProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
};

function SplashActionButton({
  title,
  icon,
  onPress,
  primary = false,
  disabled = false,
}: SplashActionButtonProps) {
  const content = (
    <View style={styles.buttonContent}>
      <View style={styles.buttonIconSlot}>
        {icon ? <Ionicons color={colors.text} name={icon} size={20} /> : null}
      </View>
      <Text style={styles.buttonLabel}>{title}</Text>
      <View style={styles.buttonIconSlot} />
    </View>
  );

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.buttonPressable, (pressed || disabled) && styles.buttonPressed]}>
      {primary ? (
        <LinearGradient
          colors={['#FF4FB9', '#9248FF', '#3F85FF']}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={styles.primaryButton}>
          {content}
        </LinearGradient>
      ) : (
        <View style={styles.secondaryButton}>{content}</View>
      )}
    </Pressable>
  );
}

export function SplashScreen({ navigation }: AppScreenProps<'Splash'>) {
  const { profile, updateProfile } = useAppState();
  const [assetReady, setAssetReady] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [socialAuthPending, setSocialAuthPending] = useState<'apple' | 'google' | null>(null);
  const [socialModalVisible, setSocialModalVisible] = useState(false);
  const [socialModalTitle, setSocialModalTitle] = useState('Sosyal giris basarisiz');
  const [socialModalMessage, setSocialModalMessage] = useState(
    'Sosyal giris sirasinda bir hata olustu.',
  );
  const insets = useSafeAreaInsets();
  const heroFade = useRef(new Animated.Value(0)).current;
  const loadingPulse = useRef(new Animated.Value(0.5)).current;
  const heartPulse = useRef(new Animated.Value(0)).current;
  const restoreStarted = useRef(false);
  const buttonAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

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
        });

        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
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
      Animated.parallel([
        Animated.timing(heroFade, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.stagger(
          90,
          buttonAnimations.map((value) =>
            Animated.timing(value, {
              toValue: 1,
              duration: 380,
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(heartPulse, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(heartPulse, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    return () => {
      mounted = false;
      pulseAnimation.stop();
    };
  }, [buttonAnimations, heartPulse, heroFade, loadingPulse]);

  const openSocialError = (title: string, message: string) => {
    setSocialModalTitle(title);
    setSocialModalMessage(message);
    setSocialModalVisible(true);
  };

  const handleSocialAuth = async (provider: 'apple' | 'google') => {
    if (socialAuthPending) {
      return;
    }

    setSocialAuthPending(provider);

    try {
      const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();

      if (result.error || !result.data?.user) {
        console.error(`[auth] ${provider} sign-in failed:`, result.error?.message ?? 'unknown error');
        openSocialError(
          provider === 'apple' ? 'Apple ile giris basarisiz' : 'Google ile giris basarisiz',
          result.error?.message ?? 'Giris tamamlanamadi.',
        );
        return;
      }

      updateProfile({
        email: result.data.user.email ?? profile.email,
        username: result.data.profile?.username ?? profile.username,
        plan: result.data.profile?.plan ?? profile.plan,
        avatarId: result.data.profile?.avatarId ?? profile.avatarId,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error(`[auth] ${provider} sign-in crashed:`, error);
      openSocialError(
        provider === 'apple' ? 'Apple ile giris basarisiz' : 'Google ile giris basarisiz',
        'Beklenmeyen bir hata olustu. Lutfen tekrar dene.',
      );
    } finally {
      setSocialAuthPending(null);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#050816', '#0B1025', '#120B29']} style={styles.background} />

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

      <Animated.View
        style={[
          styles.background,
          {
            opacity: heroFade,
          },
        ]}>
        <ImageBackground resizeMode="cover" source={welcomeBg} style={styles.background} />
      </Animated.View>

      <LinearGradient
        colors={['rgba(4,6,18,0.08)', 'rgba(6,8,24,0.18)', 'rgba(8,10,28,0.84)']}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        style={styles.overlay}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartPulse,
          {
            opacity: heartPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.16, 0.32],
            }),
            transform: [
              {
                scale: heartPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1.08],
                }),
              },
            ],
          },
        ]}
      />

      <View
        style={[
          styles.foreground,
          { paddingBottom: Math.max(insets.bottom + 16, 24) },
        ]}>
        <View style={styles.actions}>
          {[
            <SplashActionButton
              key="login"
              disabled={socialAuthPending !== null}
              onPress={() => navigation.navigate('Login')}
              primary
              title="Giris Yap"
            />,
            <SplashActionButton
              key="register"
              disabled={socialAuthPending !== null}
              onPress={() => navigation.navigate('Register')}
              title="Kayit Ol"
            />,
            <SplashActionButton
              key="apple"
              disabled={socialAuthPending !== null}
              icon="logo-apple"
              onPress={() => void handleSocialAuth('apple')}
              title={
                socialAuthPending === 'apple'
                  ? 'Apple ile baglaniyor...'
                  : 'Apple ile devam et'
              }
            />,
            <SplashActionButton
              key="google"
              disabled={socialAuthPending !== null}
              icon="logo-google"
              onPress={() => void handleSocialAuth('google')}
              title={
                socialAuthPending === 'google'
                  ? 'Google ile baglaniyor...'
                  : 'Google ile devam et'
              }
            />,
          ].map((button, index) => (
            <Animated.View
              key={index}
              style={{
                opacity: buttonAnimations[index],
                transform: [
                  {
                    translateY: buttonAnimations[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              }}>
              {button}
            </Animated.View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.privacy}>Gizliligin bizim icin onemli.</Text>
          <Text style={styles.anonymous}>%100 anonimdir.</Text>
        </View>
      </View>

      <NoticeModal
        actions={[
          {
            label: 'Tamam',
            onPress: () => setSocialModalVisible(false),
            variant: 'secondary',
          },
        ]}
        message={socialModalMessage}
        title={socialModalTitle}
        visible={socialModalVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060816',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heartPulse: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(148, 72, 255, 0.18)',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(146, 72, 255, 0.18)',
  },
  loaderCore: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 79, 185, 0.72)',
    shadowColor: '#A35BFF',
    shadowOpacity: 0.48,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  foreground: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 30,
    paddingTop: 16,
  },
  actions: {
    gap: 11,
  },
  buttonPressable: {
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.9,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#9D51FF',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(12, 14, 36, 0.54)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonIconSlot: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    flex: 1,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  privacy: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
  },
  anonymous: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
});
