import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PremiumScreen } from '../components/PremiumScreen';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';

export function ChatScreen({ navigation }: AppScreenProps<'Chat'>) {
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      navigation.replace('VoiceCall');
    });

    return () => cancelAnimationFrame(frameId);
  }, [navigation]);

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <View style={styles.body}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text style={styles.title}>Görüşme ekranına yönlendiriliyorsun</Text>
        <Text style={styles.subtitle}>Bu rota eski sohbet bağlantıları için tutuluyor. Yeni sesli görüşme deneyimi VoiceCallScreen içinde açılıyor.</Text>
      </View>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
