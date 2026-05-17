import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing } from '../constants/theme';
import { giftCatalog } from '../data/giftCatalog';
import { GiftItem } from '../types';
import { getScreenMetrics } from '../utils/responsive';
import { GiftGrid, GiftInventoryMap } from './GiftGrid';
import { GlassCard } from './GlassCard';

type GiftModalProps = {
  inventory?: GiftInventoryMap;
  visible: boolean;
  onClose: () => void;
  onSelect: (gift: GiftItem) => void;
};

type GiftCelebrationOverlayProps = {
  caption?: string;
  gift: GiftItem | null;
  visible: boolean;
};

export function GiftModal({ inventory, visible, onClose, onSelect }: GiftModalProps) {
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => {
    const screen = getScreenMetrics({ width, height: width });
    const modalWidth = Math.min(width - spacing.lg * 2, 720) - spacing.md * 2;
    const gap = width < 360 ? 8 : 12;
    const columns = screen.isTablet ? 3 : 2;

    return Math.floor((modalWidth - gap * (columns - 1)) / columns);
  }, [width]);

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

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false} style={styles.giftList}>
            <GiftGrid
              buttonLabel={(_gift, quantity) => (quantity > 0 ? 'Ücretsiz Gönder' : 'Hediye Hakkı Ekle')}
              cardWidth={cardWidth}
              data={giftCatalog}
              inventory={inventory}
              onSelect={onSelect}
            />
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}

export function GiftCelebrationOverlay({ caption = 'Süreye bonus ekleniyor...', gift, visible }: GiftCelebrationOverlayProps) {
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
            <Text style={styles.overlayCaption}>{caption}</Text>
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    maxHeight: '82%',
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
  giftList: {
    flexGrow: 0,
  },
  grid: {
    paddingBottom: spacing.sm,
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
