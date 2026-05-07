import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from './Avatar';
import { colors, layout, radius, spacing } from '../constants/theme';
import { defaultProfile, getAvatarById } from '../data/mockData';
import { FriendSummary } from '../types';

type FriendIncomingCallModalProps = {
  actionPending?: boolean;
  callerName: string;
  callerProfile: FriendSummary | null;
  mode?: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onMessage: () => void;
  onReject: () => void;
  visible: boolean;
};

type CallActionButtonProps = {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size: number;
  variant: 'accept' | 'message' | 'reject';
  wrapWidth: number;
};

const backgroundGradient = ['#020513', '#090A22', '#16072B'] as const;
const rejectGradient = ['#FF5A7C', '#D91E4F'] as const;
const acceptGradient = ['#55F49A', '#05A84E'] as const;
const messageGradient = ['rgba(255,255,255,0.16)', 'rgba(128,78,255,0.14)'] as const;
const haloGradient = ['#47D7FF', '#FF4FDD', '#8F46FF'] as const;

const stars = [
  { left: '10%', top: '16%', size: 2, opacity: 0.62 },
  { left: '22%', top: '10%', size: 1, opacity: 0.45 },
  { left: '82%', top: '15%', size: 2, opacity: 0.56 },
  { left: '72%', top: '28%', size: 1, opacity: 0.42 },
  { left: '16%', top: '34%', size: 1, opacity: 0.5 },
  { left: '90%', top: '44%', size: 2, opacity: 0.38 },
  { left: '7%', top: '58%', size: 2, opacity: 0.5 },
  { left: '80%', top: '69%', size: 1, opacity: 0.62 },
  { left: '28%', top: '76%', size: 1, opacity: 0.42 },
  { left: '62%', top: '84%', size: 2, opacity: 0.5 },
] as const;

function CallActionButton({ disabled, icon, label, onPress, size, variant, wrapWidth }: CallActionButtonProps) {
  const isMessage = variant === 'message';
  const gradientColors = variant === 'reject' ? rejectGradient : variant === 'accept' ? acceptGradient : messageGradient;

  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionWrap, { width: wrapWidth }, disabled && styles.disabledAction]}>
      <LinearGradient
        colors={gradientColors}
        style={[
          styles.actionButton,
          { width: size, height: size, borderRadius: size / 2 },
          variant === 'reject' && styles.rejectButton,
          variant === 'accept' && styles.acceptButton,
          isMessage && styles.messageButton,
        ]}
      >
        <Ionicons
          color={colors.text}
          name={icon}
          size={isMessage ? size * 0.42 : size * 0.48}
          style={variant === 'reject' ? styles.rejectIcon : undefined}
        />
      </LinearGradient>
      <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

export function FriendIncomingCallModal({
  actionPending = false,
  callerName,
  callerProfile,
  mode = 'incoming',
  onAccept,
  onMessage,
  onReject,
  visible,
}: FriendIncomingCallModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ringPulse = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;
  const compact = width <= 390 || height <= 760;
  const short = height < 720;
  const avatarSize = short ? 142 : compact ? 158 : 188;
  const ringSize = avatarSize + (short ? 34 : 48);
  const outerRingSize = ringSize + (short ? 42 : 64);
  const actionSize = compact ? 66 : 76;
  const actionWidth = compact ? 82 : 96;
  const titleSize = compact ? 44 : 52;
  const contentMaxWidth = Math.min(layout.maxWidth, width);
  const headerTopPadding = Math.max(insets.top + (short ? spacing.lg : spacing.xl), short ? 56 : 68);
  const avatar = useMemo(() => getAvatarById(callerProfile?.avatarId ?? defaultProfile.avatarId), [callerProfile?.avatarId]);
  const isOutgoing = mode === 'outgoing';

  useEffect(() => {
    if (!visible) {
      ringPulse.setValue(0);
      glowPulse.setValue(0);
      dotPulse.setValue(0);
      return undefined;
    }

    const ringAnimation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1, duration: 1450, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 1, duration: 620, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 0.28, duration: 620, useNativeDriver: true }),
        ]),
      ]),
    );

    ringAnimation.start();
    return () => ringAnimation.stop();
  }, [dotPulse, glowPulse, ringPulse, visible]);

  const pulseScale = ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.18] });
  const pulseOpacity = ringPulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0.22, 0] });
  const glowScale = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const dotOpacity = dotPulse.interpolate({ inputRange: [0.28, 1], outputRange: [0.38, 1] });

  return (
    <Modal animationType="fade" onRequestClose={onReject} presentationStyle="overFullScreen" statusBarTranslucent visible={visible}>
      <LinearGradient colors={backgroundGradient} style={styles.screen}>
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
          <View style={[styles.glowCenter, { width: outerRingSize * 1.35, height: outerRingSize * 1.35, borderRadius: outerRingSize }]} />
          {stars.map((star) => (
            <View
              key={`${star.left}-${star.top}`}
              style={[
                styles.star,
                {
                  left: star.left,
                  opacity: star.opacity,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                },
              ]}
            />
          ))}
        </View>

        <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
          <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
            <View style={[styles.header, { paddingTop: headerTopPadding }]}>
              <Text style={styles.eyebrow}>{isOutgoing ? 'ARKADAŞIN ARANIYOR' : 'ARKADAŞIN SENİ ARIYOR'}</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={[styles.callerName, { fontSize: titleSize }]}>
                {callerName}
              </Text>
              <View style={styles.callingRow}>
                <Text style={styles.callingText}>{isOutgoing ? 'Aranıyor' : 'Seni arıyor'}</Text>
                <View style={styles.dots}>
                  {[0, 1, 2].map((dot) => (
                    <Animated.View
                      key={dot}
                      style={[
                        styles.dot,
                        {
                          opacity: dotOpacity,
                          transform: [{ scale: dotPulse.interpolate({ inputRange: [0.28, 1], outputRange: [0.82, 1 + dot * 0.08] }) }],
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.avatarStage, { height: outerRingSize + (short ? 42 : 64) }]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.outerPulse,
                  {
                    width: outerRingSize,
                    height: outerRingSize,
                    borderRadius: outerRingSize / 2,
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
              <View style={[styles.outerRing, { width: outerRingSize, height: outerRingSize, borderRadius: outerRingSize / 2 }]} />
              <Animated.View style={[styles.neonRingWrap, { transform: [{ scale: glowScale }] }]}>
                <LinearGradient colors={haloGradient} style={[styles.neonRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
                  <View style={[styles.avatarShell, { width: ringSize - 14, height: ringSize - 14, borderRadius: (ringSize - 14) / 2 }]}>
                    <Avatar avatar={avatar} size={avatarSize} />
                  </View>
                </LinearGradient>
              </Animated.View>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Çevrimiçi</Text>
              </View>
            </View>

            <View style={[styles.actions, { gap: compact ? 10 : 22 }]}>
              {isOutgoing ? null : (
                <CallActionButton
                  disabled={actionPending}
                  icon="call"
                  label="Reddet"
                  onPress={onReject}
                  size={actionSize}
                  variant="reject"
                  wrapWidth={actionWidth}
                />
              )}
              <CallActionButton
                disabled={actionPending}
                icon="chatbubble-ellipses-outline"
                label="Mesaj Gönder"
                onPress={onMessage}
                size={actionSize}
                variant="message"
                wrapWidth={actionWidth}
              />
              <CallActionButton
                disabled={actionPending}
                icon="call"
                label={isOutgoing ? 'İptal Et' : 'Kabul Et'}
                onPress={isOutgoing ? onReject : onAccept ?? onReject}
                size={actionSize}
                variant={isOutgoing ? 'reject' : 'accept'}
                wrapWidth={actionWidth}
              />
            </View>

            <View style={[styles.footer, short && styles.footerShort]}>
              <Ionicons color="#E8B7FF" name="shield-checkmark-outline" size={24} />
              <Text style={styles.footerText}>
                {isOutgoing ? 'Arkadaşın kabul ederse 5 dakikalık görüşme başlayacak' : 'Kabul ederseniz 5 dakikalık görüşme başlayacak'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030513',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(143, 70, 255, 0.22)',
    shadowColor: '#B24CFF',
    shadowOpacity: 0.5,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  glowCenter: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 79, 221, 0.12)',
    shadowColor: '#FF4FDD',
    shadowOpacity: 0.62,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  glowBottom: {
    position: 'absolute',
    left: -130,
    bottom: -160,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(69, 224, 255, 0.12)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 90,
    shadowOffset: { width: 0, height: 0 },
  },
  star: {
    position: 'absolute',
    backgroundColor: '#DDE8FF',
    shadowColor: '#8ACBFF',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  headerShort: {
    paddingTop: spacing.md,
  },
  eyebrow: {
    color: '#F8A9FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  callerName: {
    marginTop: spacing.sm,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 79, 221, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  callingRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  callingText: {
    color: '#D8D4F2',
    fontSize: 19,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFAAFF',
    shadowColor: '#FF63E8',
    shadowOpacity: 0.8,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerPulse: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 118, 246, 0.72)',
    backgroundColor: 'rgba(149, 69, 255, 0.08)',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(179, 91, 255, 0.32)',
  },
  neonRingWrap: {
    shadowColor: '#FF4FDD',
    shadowOpacity: 0.78,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  neonRing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
  },
  avatarShell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 5, 19, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(205, 174, 255, 0.7)',
    backgroundColor: 'rgba(24, 26, 48, 0.78)',
    shadowColor: colors.green,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#66F37D',
    shadowColor: '#66F37D',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  onlineText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  actionWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  disabledAction: {
    opacity: 0.55,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rejectButton: {
    shadowColor: '#FF416F',
    shadowOpacity: 0.68,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  acceptButton: {
    shadowColor: '#2EEE77',
    shadowOpacity: 0.68,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  messageButton: {
    borderColor: 'rgba(208, 171, 255, 0.62)',
    backgroundColor: 'rgba(13, 14, 32, 0.72)',
    shadowColor: '#B564FF',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  rejectIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  footer: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  footerShort: {
    minHeight: 42,
  },
  footerText: {
    flexShrink: 1,
    color: '#D4CBE8',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
