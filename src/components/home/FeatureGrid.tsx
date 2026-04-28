import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius } from '../../constants/theme';
import { FeatureItem, HomePalette } from './types';

type FeatureGridProps = {
  items: FeatureItem[];
  palette: HomePalette;
  compact?: boolean;
  cardHeight?: number;
  onSelect: (item: FeatureItem) => void;
};

export function FeatureGrid({ items, palette, compact = false, cardHeight, onSelect }: FeatureGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable key={item.key} onPress={() => onSelect(item)} style={({ pressed }) => [styles.cellWrap, { transform: [{ scale: pressed ? 0.988 : 1 }] }]}>
          <View style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: item.accent }, compact && styles.cardCompact, cardHeight ? { height: cardHeight } : null]}>
            <View style={[styles.glow, { backgroundColor: item.glow }]} />
            <View style={[styles.iconWrap, { borderColor: `${item.accent}55`, backgroundColor: `${item.accent}18` }]}>
              <Ionicons color={item.accent} name={item.icon} size={compact ? 24 : 28} />
            </View>

            <View style={styles.copy}>
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.title, { color: palette.text }]}>
                {item.title}
              </Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={[styles.subtitle, { color: item.accent }]}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons color={palette.text} name="chevron-forward" size={compact ? 16 : 18} />
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
    minHeight: 90,
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
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
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
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
});
