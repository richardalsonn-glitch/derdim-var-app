import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { radius } from '../../constants/theme';
import { HomePalette } from './types';

type AutoCallCardProps = {
  enabled: boolean;
  counterLabel: string;
  compact?: boolean;
  dense?: boolean;
  palette: HomePalette;
  onToggle: () => void;
};

export function AutoCallCard({ enabled, counterLabel, compact = false, dense = false, palette, onToggle }: AutoCallCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }, compact && styles.cardCompact, dense && styles.cardDense]}>
      <View style={[styles.iconWrap, dense && styles.iconWrapDense]}>
        <LinearGradient colors={['rgba(132, 79, 255, 0.2)', 'rgba(255, 91, 178, 0.12)']} style={styles.iconGradient}>
          <Ionicons color={palette.text} name="call" size={dense ? 17 : compact ? 20 : 22} />
        </LinearGradient>
      </View>

      <View style={styles.copy}>
        <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={[styles.title, dense && styles.titleDense, { color: palette.text }]}>
          Otomatik çağrı al
        </Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={dense ? 1 : 2} style={[styles.subtitle, dense && styles.subtitleDense, { color: palette.muted }]}>
          45 saniye işlem yapmazsan seni uygun bir ses odasına bağlarız.
        </Text>
      </View>

      <View style={styles.statusRail}>
        <Pressable onPress={onToggle} style={[styles.switch, enabled && styles.switchActive, { borderColor: enabled ? 'rgba(132, 79, 255, 0.5)' : palette.border }]}>
          <View style={[styles.knob, enabled && styles.knobActive]} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.counter, dense && styles.counterDense, { color: palette.purple }]}>
          {counterLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cardDense: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrapDense: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  titleDense: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  subtitleDense: {
    fontSize: 10,
    lineHeight: 12,
  },
  statusRail: {
    alignItems: 'flex-end',
    gap: 8,
  },
  switch: {
    width: 54,
    height: 30,
    borderRadius: 999,
    justifyContent: 'center',
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
  },
  switchActive: {
    backgroundColor: 'rgba(132, 79, 255, 0.28)',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  knobActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#F7EEFF',
  },
  counter: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  counterDense: {
    fontSize: 14,
  },
});
