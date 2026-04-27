import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { letters } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function LettersScreen({ navigation }: AppScreenProps<'Letters'>) {
  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Sana gelen anonim mektuplar" title="Anonim Mektup Kutusu" />

      <View style={styles.list}>
        {letters.map((letter) => (
          <GlassCard key={letter.id} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.tag}>
                <Ionicons color={colors.pink} name="mail-unread" size={16} />
                <Text style={styles.tagText}>{letter.ageLabel}</Text>
              </View>
            </View>
            <Text style={styles.title}>{letter.title}</Text>
            <Text style={styles.preview}>{letter.preview}</Text>
          </GlassCard>
        ))}
      </View>

      <GradientButton onPress={() => undefined} title="Mektup Gönder" />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  item: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  preview: {
    color: colors.muted,
    lineHeight: 21,
  },
});
