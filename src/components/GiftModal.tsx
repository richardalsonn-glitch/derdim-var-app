import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing } from '../constants/theme';
import { gifts } from '../data/mockData';
import { GiftItem } from '../types';
import { GlassCard } from './GlassCard';

type GiftModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (gift: GiftItem) => void;
};

type GiftCelebrationOverlayProps = {
  gift: GiftItem | null;
  visible: boolean;
};

export function GiftModal({ visible, onClose, onSelect }: GiftModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <GlassCard style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Hediye Gönder</Text>
              <Text style={styles.modalSubtitle}>Süre dolmadan sıcak bir dokunuş bırak.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Kapat</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {gifts.map((gift) => (
              <Pressable key={gift.id} onPress={() => onSelect(gift)} style={styles.gridItemWrap}>
                <LinearGradient colors={gift.accent} style={styles.giftGlow}>
                  <View style={styles.giftCard}>
                    <Text style={styles.symbol}>{gift.symbol}</Text>
                    <Text style={styles.giftName}>{gift.name}</Text>
                    <Text style={styles.giftCaption}>{gift.caption}</Text>
                    <Text style={styles.price}>{gift.price}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

export function GiftCelebrationOverlay({ gift, visible }: GiftCelebrationOverlayProps) {
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.9, duration: 900, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [visible, pulse]);

  const accent = useMemo(() => gift?.accent ?? ['#FF4FB9', '#8F46FF'], [gift]);

  return (
    <Modal animationType="fade" statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlayBackdrop}>
        <LinearGradient colors={accent as [string, string]} style={styles.overlayOrb}>
          <Animated.View style={[styles.overlayInner, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.overlaySymbol}>{gift?.symbol ?? '🎁'}</Text>
            <Text style={styles.overlayTitle}>{gift?.name ?? 'Hediye'}</Text>
            <Text style={styles.overlayCaption}>Süreye bonus ekleniyor...</Text>
          </Animated.View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(2, 4, 14, 0.74)',
  },
  modalCard: {
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.muted,
    marginTop: 4,
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.muted,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  gridItemWrap: {
    width: '48%',
  },
  giftGlow: {
    borderRadius: radius.lg,
    padding: 1,
  },
  giftCard: {
    minHeight: 146,
    borderRadius: radius.lg - 1,
    backgroundColor: 'rgba(10, 12, 32, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing.md,
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
  price: {
    marginTop: 'auto',
    color: colors.goldSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  overlayBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 6, 16, 0.88)',
    padding: spacing.xl,
  },
  overlayOrb: {
    width: 280,
    height: 280,
    borderRadius: 140,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  overlayInner: {
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: 'rgba(8, 10, 28, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  overlaySymbol: {
    fontSize: 76,
  },
  overlayTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  overlayCaption: {
    color: colors.muted,
    fontSize: 14,
  },
});
