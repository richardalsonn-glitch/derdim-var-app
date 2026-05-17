import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius } from '../../constants/theme';
import { FeatureItem, HomePalette } from './types';

type FeatureGridProps = {
  items: FeatureItem[];
  palette: HomePalette;
  compact?: boolean;
  dense?: boolean;
  cardHeight?: number;
  onSelect: (item: FeatureItem) => void;
};

export function FeatureGrid({ items, palette, compact = false, dense = false, cardHeight, onSelect }: FeatureGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable key={item.key} onPress={() => onSelect(item)} style={({ pressed }) => [styles.cellWrap, { transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
          <View style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: item.accent }, compact && styles.cardCompact, dense && styles.cardDense, cardHeight ? { height: cardHeight, minHeight: cardHeight } : null]}>
            <View style={[styles.glow, { backgroundColor: item.glow }]} />
            <View style={[styles.iconWrap, dense && styles.iconWrapDense, { borderColor: `${item.accent}55`, backgroundColor: `${item.accent}18` }]}>
              <Ionicons color={item.accent} name={item.icon} size={dense ? 18 : compact ? 24 : 28} />
            </View>

            <View style={styles.copy}>
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.title, dense && styles.titleDense, { color: palette.text }]}>
                {item.title}
              </Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={dense ? 1 : 2} style={[styles.subtitle, dense && styles.subtitleDense, { color: item.accent }]}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons color={palette.text} name="chevron-forward" size={dense ? 14 : compact ? 16 : 18} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cellWrap: {
    width: '48%',
  },
  card: {
    minHeight: 0,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cardDense: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 7,
  },
  glow: {
    position: 'absolute',
    left: -12,
    top: -12,
    width: 72,
    height: 72,
    borderRadius: 999,
    opacity: 0.12,
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconWrapDense: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  titleDense: {
    fontSize: 12,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  subtitleDense: {
    fontSize: 9,
    lineHeight: 11,
  },
});
