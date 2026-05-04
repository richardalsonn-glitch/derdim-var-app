import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { reactivateCurrentAccount } from '../services/accountService';
import { signOut } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

export function FrozenAccountScreen({ navigation }: AppScreenProps<'FrozenAccount'>) {
  const { updateProfile } = useAppState();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function reactivate() {
    if (pending) {
      return;
    }

    setPending(true);
    const result = await reactivateCurrentAccount();

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Hesap aktifleştirilemedi. Lütfen tekrar deneyin.'));
      setPending(false);
      return;
    }

    updateProfile({ isFrozen: false });
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  async function logout() {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <GlassCard style={styles.card} toned="strong">
        <Text style={styles.title}>Hesabın dondurulmuş</Text>
        <Text style={styles.body}>
          Hesabın dondurulduğu için eşleşmeye giremez, arkadaşlarına online görünmezsin. İstersen hesabını hemen tekrar aktifleştirebilirsin.
        </Text>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {pending ? <ActivityIndicator color={colors.cyan} /> : null}
        <View style={styles.actions}>
          <GradientButton disabled={pending} onPress={() => void reactivate()} title="Hesabımı Aktifleştir" />
          <GradientButton disabled={pending} onPress={() => void logout()} title="Çıkış Yap" variant="ghost" />
        </View>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
