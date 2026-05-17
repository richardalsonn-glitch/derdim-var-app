import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '../constants/theme';
import { getScreenLayout, responsiveFont } from '../utils/responsive';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  rightAction?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, rightLabel, rightAction }: ScreenHeaderProps) {
  const { width, height } = useWindowDimensions();
  const screenLayout = getScreenLayout(
    { width, height },
    { top: 0, bottom: 0, left: 0, right: 0 },
  );
  const backButtonSize = screenLayout.isSmallPhone ? 36 : 38;

  return (
    <View style={[styles.row, { gap: screenLayout.headerGap }]}>
      <View style={[styles.left, { gap: screenLayout.headerGap }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={[
              styles.backButton,
              {
                borderRadius: backButtonSize / 2,
                height: backButtonSize,
                width: backButtonSize,
              },
            ]}
          >
            <Ionicons color={colors.text} name="chevron-back" size={18} />
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          <Text style={[styles.title, { fontSize: responsiveFont(typography.heading, width) }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { fontSize: responsiveFont(13, width) }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightAction ?? (rightLabel ? <Text style={styles.right}>{rightLabel}</Text> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 2,
  },
  right: {
    color: colors.pink,
    fontSize: 13,
    fontWeight: '700',
  },
});
