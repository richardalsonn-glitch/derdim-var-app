import { useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { colors, radius, spacing, typography } from '../constants/theme';
import { signInWithApple, signInWithGoogle } from '../services/authService';
import { AppScreenProps } from '../navigation/types';

export function SplashScreen({ navigation }: AppScreenProps<'Splash'>) {
  const [socialModalVisible, setSocialModalVisible] = useState(false);

  const openDemoModal = async (provider: 'apple' | 'google') => {
    if (provider === 'apple') {
      await signInWithApple();
    } else {
      await signInWithGoogle();
    }
    setSocialModalVisible(true);
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ImageBackground imageStyle={styles.image} resizeMode="cover" source={require('../../derdimvar.png')} style={styles.hero}>
        <View style={styles.overlay} />
        <View style={styles.iconBubble}>
          <Ionicons color={colors.pink} name="heart-outline" size={42} />
        </View>
        <Text style={styles.brand}>Derdim Var</Text>
        <Text style={styles.slogan}>Anonim kal, içini dök, seni anlayacak biriyle eşleş.</Text>
        <Text style={styles.supportText}>Acil durumlarda profesyonel destek alman önemlidir.</Text>
      </ImageBackground>

      <View style={styles.actions}>
        <GradientButton icon="arrow-forward" onPress={() => navigation.navigate('Login')} title="Giriş Yap" />
        <GradientButton onPress={() => navigation.navigate('Register')} title="Kayıt Ol" variant="secondary" />
        <GradientButton icon="logo-apple" onPress={() => openDemoModal('apple')} title="Apple ile devam et" variant="ghost" />
        <GradientButton icon="logo-google" onPress={() => openDemoModal('google')} title="Google ile devam et" variant="ghost" />
      </View>

      <NoticeModal
        actions={[
          {
            label: 'Demo olarak devam et',
            onPress: () => {
              setSocialModalVisible(false);
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
            },
          },
          {
            label: 'Vazgeç',
            onPress: () => setSocialModalVisible(false),
            variant: 'ghost',
          },
        ]}
        message="Sosyal giriş yakında aktif olacak. Demo modunda devam edebilirsin."
        title="Sosyal giriş yakında"
        visible={socialModalVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  hero: {
    minHeight: 470,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.xl,
    justifyContent: 'flex-end',
  },
  image: {
    opacity: 0.36,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 9, 28, 0.72)',
  },
  iconBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.lg,
  },
  brand: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  slogan: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 290,
  },
  supportText: {
    color: colors.dim,
    marginTop: spacing.md,
    lineHeight: 19,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.sm,
  },
});
