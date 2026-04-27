import { Pressable } from 'react-native';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing } from '../constants/theme';
import { AvatarOption } from '../types';

type AvatarProps = {
  avatar: AvatarOption;
  size?: number;
  selected?: boolean;
  label?: string;
  subtitle?: string;
  showCard?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

const accessoryIcons = {
  sparkles: 'sparkles',
  moon: 'moon',
  rose: 'flower',
  flash: 'flash',
  leaf: 'leaf',
  star: 'star',
  shield: 'shield-checkmark',
  mic: 'mic',
} as const;

export function Avatar({
  avatar,
  size = 88,
  selected = false,
  label,
  subtitle,
  showCard = false,
  style,
  onPress,
}: AvatarProps) {
  const body = (
    <LinearGradient colors={avatar.palette} style={[styles.core, { width: size, height: size, borderRadius: size / 2 }, selected && styles.selectedCore]}>
      <View style={[styles.halo, { backgroundColor: avatar.accentColor }]} />
      <View style={[styles.head, { backgroundColor: avatar.skinTone, width: size * 0.34, height: size * 0.34, borderRadius: size * 0.17, top: size * 0.22 }]} />
      <View style={[styles.hairCap, { backgroundColor: avatar.hairColor, width: size * 0.42, height: size * 0.24, borderTopLeftRadius: size * 0.24, borderTopRightRadius: size * 0.24, top: size * 0.17 }]} />
      <View style={[styles.body, { backgroundColor: avatar.outfitColor, width: size * 0.58, height: size * 0.3, borderRadius: size * 0.18, bottom: size * 0.15 }]} />
      <View style={[styles.shoulderLeft, { backgroundColor: avatar.outfitColor, width: size * 0.18, height: size * 0.14, left: size * 0.18, bottom: size * 0.2 }]} />
      <View style={[styles.shoulderRight, { backgroundColor: avatar.outfitColor, width: size * 0.18, height: size * 0.14, right: size * 0.18, bottom: size * 0.2 }]} />
      <View style={[styles.accessoryBubble, { backgroundColor: 'rgba(4, 7, 20, 0.62)' }]}>
        <Ionicons color={avatar.accentColor} name={accessoryIcons[avatar.accessory]} size={size * 0.17} />
      </View>
    </LinearGradient>
  );

  if (!showCard) {
    return <View style={style}>{body}</View>;
  }

  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.selectedCard, style]}>
      {body}
      <Text style={styles.label}>{label ?? avatar.name}</Text>
      <Text style={styles.subtitle}>{subtitle ?? avatar.vibe}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedCard: {
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(153, 70, 255, 0.14)',
  },
  core: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  selectedCore: {
    borderColor: 'rgba(255,255,255,0.72)',
  },
  halo: {
    position: 'absolute',
    width: '76%',
    height: '76%',
    borderRadius: 999,
    opacity: 0.16,
  },
  head: {
    position: 'absolute',
  },
  hairCap: {
    position: 'absolute',
  },
  body: {
    position: 'absolute',
  },
  shoulderLeft: {
    position: 'absolute',
    borderBottomLeftRadius: 999,
    borderTopLeftRadius: 999,
    transform: [{ rotate: '12deg' }],
  },
  shoulderRight: {
    position: 'absolute',
    borderBottomRightRadius: 999,
    borderTopRightRadius: 999,
    transform: [{ rotate: '-12deg' }],
  },
  accessoryBubble: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
