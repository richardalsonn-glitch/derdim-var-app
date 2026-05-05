import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients, layout, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { restoreAuthProfile } from '../services/authService';

const welcomeBg = require('../../assets/images/anasayfayeni12.png');

export function SplashScreen({ navigation }: AppScreenProps<'Splash'>) {
  const { height, width } = useWindowDimensions();
  const { profile, updateProfile } = useAppState();
  const [assetReady, setAssetReady] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const insets = useSafeAreaInsets();
  const heroFade = useRef(new Animated.Value(0)).current;
  const loadingPulse = useRef(new Animated.Value(0.5)).current;
  const restoreStarted = useRef(false);

  const tiny = height < 720;
  const compact = height < 800;
  const horizontalPadding = width < 380 ? 18 : 24;
  const moduleTop = height * (tiny ? 0.515 : compact ? 0.53 : 0.54);
  const moduleMaxWidth = Math.min(layout.maxWidth - 24, width - horizontalPadding * 2);

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

  function openLogin() {
    navigation.navigate('Login');
  }

  return (
    <View style={styles.screen}>
      <ImageBackground resizeMode="cover" source={welcomeBg} style={styles.background}>
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
            <View style={[styles.inputShell, { height: tiny ? 36 : 42 }]}>
              <Ionicons color={colors.muted} name="person-circle-outline" size={20} />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setIdentifier}
                placeholder="Telefon / E-posta"
                placeholderTextColor="rgba(247,238,255,0.62)"
                style={styles.input}
                value={identifier}
              />
            </View>

            <Pressable onPress={openLogin}>
              <LinearGradient
                colors={[...gradients.primary]}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={[styles.primaryButton, { height: tiny ? 38 : 42 }]}
              >
                <Text style={styles.primaryButtonText}>Devam Et</Text>
                <Ionicons color={colors.text} name="arrow-forward" size={18} />
              </LinearGradient>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.secondaryRow}>
              <Pressable onPress={openLogin} style={[styles.secondaryButton, { height: tiny ? 32 : 36 }]}>
                <Text style={styles.secondaryButtonText}>Giriş Yap</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Register')} style={[styles.secondaryButton, styles.registerButton, { height: tiny ? 32 : 36 }]}>
                <Text style={styles.secondaryButtonText}>Kayıt Ol</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </ImageBackground>
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
    backgroundColor: 'rgba(3,5,18,0.08)',
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
