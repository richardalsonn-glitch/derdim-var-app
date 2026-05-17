import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing } from '../constants/theme';
import { GiftItem } from '../types';

export type GiftInventoryMap = Record<string, number>;

type GiftGridProps = {
  buttonLabel?: (gift: GiftItem, quantity: number) => string;
  cardWidth?: DimensionValue;
  data: GiftItem[];
  inventory?: GiftInventoryMap;
  onSelect?: (gift: GiftItem) => void;
};

export function GiftGrid({
  buttonLabel,
  cardWidth = '48%',
  data,
  inventory = {},
  onSelect,
}: GiftGridProps) {
  if (data.length === 0) {
    return <Text style={styles.empty}>Henüz kayıt yok.</Text>;
  }

  return (
    <View style={styles.grid}>
      {data.map((gift) => {
        const quantity = inventory[gift.id] ?? 0;
        const label = buttonLabel?.(gift, quantity);

        return (
          <Pressable
            disabled={!onSelect}
            key={gift.id}
            onPress={() => onSelect?.(gift)}
            style={[styles.gridItemWrap, { width: cardWidth }]}
          >
            <LinearGradient colors={gift.accent} style={styles.giftGlow}>
              <View style={styles.giftCard}>
                <Text style={styles.symbol}>{gift.symbol}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={1} style={styles.giftName}>{gift.name}</Text>
                <Text numberOfLines={2} style={styles.giftCaption}>{gift.caption}</Text>
                <View style={styles.giftMetaRow}>
                  <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.price}>{gift.price}</Text>
                  <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.bonus}>+{Math.floor(gift.bonusSeconds / 60)} dk</Text>
                </View>
                <Text adjustsFontSizeToFit minimumFontScale={0.86} numberOfLines={1} style={styles.inventory}>Sende: {quantity}</Text>
                {label ? (
                  <View style={styles.selectButton}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.selectText}>
                      {label}
                    </Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  gridItemWrap: {
    minWidth: 0,
  },
  giftGlow: {
    borderRadius: radius.lg,
    padding: 1,
  },
  giftCard: {
    minHeight: 184,
    borderRadius: radius.lg - 1,
    backgroundColor: 'rgba(10, 12, 32, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing.sm,
    gap: 6,
  },
  symbol: {
    fontSize: 34,
  },
  giftName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  giftCaption: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
  },
  giftMetaRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    color: colors.goldSoft,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
  },
  bonus: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  inventory: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  selectButton: {
    minHeight: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  selectText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    color: colors.dim,
    lineHeight: 18,
  },
});
