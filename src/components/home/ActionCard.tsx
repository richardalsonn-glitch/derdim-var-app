import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { radius } from '../../constants/theme';
import { HomePalette } from './types';

type ActionCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string, string];
  glowColor: string;
  compact?: boolean;
  height?: number;
  palette: HomePalette;
  onPress: () => void;
};

export function ActionCard({ title, subtitle, icon, gradient, glowColor, compact = false, height, palette, onPress }: ActionCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <LinearGradient
        colors={[...gradient]}
        end={{ x: 1, y: 0.85 }}
        start={{ x: 0, y: 0.15 }}
        style={[
          styles.card,
          compact && styles.cardCompact,
          height ? { height } : null,
          {
            borderColor: `${palette.text}26`,
            shadowColor: glowColor,
          },
        ]}>
        <View pointerEvents="none" style={[styles.glow, { backgroundColor: glowColor }]} />
        <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(8,10,28,0.04)']} pointerEvents="none" style={styles.glassVeil} />
        <View pointerEvents="none" style={styles.edgeHighlight} />
        <View pointerEvents="none" style={[styles.wave, styles.waveOne]} />
        <View pointerEvents="none" style={[styles.wave, styles.waveTwo]} />

        <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
          <LinearGradient colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.08)']} style={styles.iconGradient}>
            <Ionicons color={palette.text} name={icon} size={compact ? 26 : 32} />
          </LinearGradient>
        </View>

        <View style={styles.copy}>
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.title, compact && styles.titleCompact]}>
            {title}
          </Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.subtitle, compact && styles.subtitleCompact]}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.arrowWrap}>
          <Ionicons color={palette.text} name="chevron-forward" size={compact ? 22 : 24} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    minHeight: 112,
    borderRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  cardCompact: {
    minHeight: 98,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  glow: {
    position: 'absolute',
    top: -18,
    left: -12,
    width: 120,
    height: 120,
    borderRadius: 999,
    opacity: 0.24,
  },
  glassVeil: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  edgeHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '52%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  wave: {
    position: 'absolute',
    right: -24,
    width: 180,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    opacity: 0.18,
  },
  waveOne: {
    bottom: -30,
    height: 90,
  },
  waveTwo: {
    bottom: -16,
    height: 62,
    right: 8,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrapCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    color: '#FFF9FF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: 24,
  },
  subtitle: {
    color: 'rgba(248, 241, 255, 0.92)',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitleCompact: {
    fontSize: 12,
  },
  arrowWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
