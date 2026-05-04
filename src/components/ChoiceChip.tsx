import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients, radius, spacing } from '../constants/theme';

type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function ChoiceChip({ label, selected = false, onPress }: ChoiceChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.selectedChip]}>
      <LinearGradient
        colors={selected ? [...gradients.primary] : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={styles.fill}
      >
        <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
        {selected ? (
          <View style={styles.checkWrap}>
            <Ionicons color={colors.text} name="checkmark" size={14} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  selectedChip: {
    borderColor: 'rgba(132, 247, 255, 0.85)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  fill: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedLabel: {
    color: colors.text,
  },
  checkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 7, 20, 0.28)',
  },
});
