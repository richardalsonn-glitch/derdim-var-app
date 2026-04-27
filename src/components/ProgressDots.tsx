import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';

type ProgressDotsProps = {
  current: number;
  total: number;
};

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const active = step <= current;

        return (
          <View key={step} style={[styles.dot, active && styles.activeDot]}>
            <Text style={styles.label}>{step}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeDot: {
    backgroundColor: colors.purple,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
