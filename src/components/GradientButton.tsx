import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, gradients, radius, spacing } from '../constants/theme';

type GradientButtonProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
  compact?: boolean;
  large?: boolean;
  rightSlot?: ReactNode;
};

export function GradientButton({
  title,
  subtitle,
  onPress,
  icon,
  variant = 'primary',
  compact = false,
  large = false,
  rightSlot,
}: GradientButtonProps) {
  const content = (
    <View style={[styles.content, variant === 'ghost' && styles.ghostContent]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ?? (icon ? <Ionicons color={colors.text} name={icon} size={20} /> : null)}
    </View>
  );

  const gradientColors =
    variant === 'gold'
      ? gradients.warm
      : variant === 'secondary'
        ? gradients.blue
        : gradients.primary;

  return (
    <Pressable onPress={onPress}>
      {variant === 'primary' || variant === 'gold' ? (
        <LinearGradient
          colors={[...gradientColors]}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={[styles.button, compact && styles.compactButton, large && styles.largeButton]}
        >
          {content}
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={variant === 'secondary' ? [...gradients.secondary] : ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.02)']}
          style={[styles.button, compact && styles.compactButton, large && styles.largeButton, variant === 'secondary' ? styles.secondary : styles.ghost]}
        >
          {content}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  compactButton: {
    minHeight: 48,
  },
  largeButton: {
    minHeight: 86,
    paddingVertical: spacing.md,
  },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(120, 102, 255, 0.28)',
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ghostContent: {
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
