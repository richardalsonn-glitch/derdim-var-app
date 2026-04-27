import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '../constants/theme';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  toned?: 'default' | 'strong';
}>;

export function GlassCard({ children, style, toned = 'default' }: GlassCardProps) {
  return <View style={[styles.card, toned === 'strong' && styles.strongCard, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  strongCard: {
    backgroundColor: colors.surfaceStrong,
  },
});
