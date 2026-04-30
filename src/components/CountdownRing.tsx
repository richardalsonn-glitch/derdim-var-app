import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constants/theme';

type CountdownRingProps = {
  totalSeconds: number;
  remainingSeconds: number;
  size?: number;
  tone?: 'purple' | 'gold' | 'blue';
  caption?: string;
  title?: string;
  subtitle?: string;
  promoText?: string;
  promoIcon?: keyof typeof Ionicons.glyphMap;
  titleIcon?: keyof typeof Ionicons.glyphMap;
  footerSlot?: ReactNode;
  segmentCount?: number;
};

type CountdownOptions = {
  initialSeconds: number;
  onExpire?: () => void;
  autoStart?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized;
  const value = Number.parseInt(safeHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColors(from: string, to: string, amount: number) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const t = clamp(amount, 0, 1);

  return rgbToHex(start.r + (end.r - start.r) * t, start.g + (end.g - start.g) * t, start.b + (end.b - start.b) * t);
}

function getSegmentColor(progress: number, tone: CountdownRingProps['tone']) {
  if (tone === 'gold') {
    return mixColors('#FFE07A', '#FFB24D', progress);
  }

  if (tone === 'blue') {
    return mixColors('#7DE7FF', '#458BFF', progress);
  }

  if (progress < 0.5) {
    return mixColors('#FF5FC8', '#A84CFF', progress / 0.5);
  }

  return mixColors('#9C54FF', '#55C8FF', (progress - 0.5) / 0.5);
}

export function useCountdownTimer({ initialSeconds, onExpire, autoStart = true }: CountdownOptions) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemainingSeconds(initialSeconds);
    setIsRunning(autoStart);
    expiredRef.current = false;
  }, [initialSeconds, autoStart]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return;
    }

    const timerId = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timerId);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds === 0 && !expiredRef.current) {
      expiredRef.current = true;
      setIsRunning(false);
      onExpire?.();
    }
  }, [remainingSeconds, onExpire]);

  return {
    remainingSeconds,
    isRunning,
    setIsRunning,
    addSeconds: (value: number) => {
      expiredRef.current = false;
      setRemainingSeconds((current) => current + value);
      setIsRunning(true);
    },
    reset: (nextSeconds = initialSeconds, shouldRun = autoStart) => {
      expiredRef.current = false;
      setRemainingSeconds(nextSeconds);
      setIsRunning(shouldRun);
    },
  };
}

export function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function CountdownRing({
  totalSeconds,
  remainingSeconds,
  size = 232,
  tone = 'purple',
  caption = 'kalan süre',
  title,
  subtitle,
  promoText,
  promoIcon = 'gift',
  titleIcon,
  footerSlot,
  segmentCount = 88,
}: CountdownRingProps) {
  const pulse = useRef(new Animated.Value(0.97)).current;
  const progress = totalSeconds === 0 ? 0 : clamp(remainingSeconds / totalSeconds, 0, 1);
  const center = size / 2;
  const segmentWidth = clamp(size * 0.012, 3, 5);
  const segmentHeight = clamp(size * 0.052, 10, 14);
  const segmentRadius = size / 2 - segmentHeight * 0.84;
  const activeSegments = Math.max(0, Math.round(progress * segmentCount));
  const markerAngle = -90 + progress * 360;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.97,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const segments = useMemo(
    () =>
      Array.from({ length: segmentCount }, (_, index) => {
        const segmentProgress = index / Math.max(1, segmentCount - 1);
        const angle = -90 + segmentProgress * 360;
        const radians = (angle * Math.PI) / 180;
        const x = center + Math.cos(radians) * segmentRadius - segmentWidth / 2;
        const y = center + Math.sin(radians) * segmentRadius - segmentHeight / 2;
        const isActive = index < activeSegments;

        return {
          key: `segment-${index}`,
          style: {
            left: x,
            top: y,
            transform: [{ rotate: `${angle + 90}deg` }],
            backgroundColor: isActive ? getSegmentColor(segmentProgress, tone) : 'rgba(255,255,255,0.06)',
            opacity: isActive ? 1 : 0.28,
            shadowColor: isActive ? getSegmentColor(segmentProgress, tone) : 'transparent',
            shadowOpacity: isActive ? 0.72 : 0,
            shadowRadius: isActive ? 7 : 0,
            shadowOffset: { width: 0, height: 0 },
          },
        };
      }),
    [activeSegments, center, segmentCount, segmentHeight, segmentRadius, segmentWidth, tone],
  );

  const markerRadians = (markerAngle * Math.PI) / 180;
  const markerRadius = segmentRadius + segmentHeight * 0.12;
  const markerSize = Math.max(20, size * 0.075);
  const markerLeft = center + Math.cos(markerRadians) * markerRadius - markerSize / 2;
  const markerTop = center + Math.sin(markerRadians) * markerRadius - markerSize / 2;
  const titleSize = clamp(size * 0.05, 14, 20);
  const timeSize = clamp(size * 0.176, 42, 60);
  const subtitleSize = clamp(size * 0.043, 12, 16);
  const promoIconSize = clamp(size * 0.056, 16, 20);
  const promoTextSize = clamp(size * 0.039, 11, 14);
  const promoPaddingHorizontal = clamp(size * 0.06, 16, 24);
  const titleIconSize = clamp(size * 0.07, 19, 26);
  const contentGap = clamp(size * 0.016, 6, 9);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.outerGlow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale: pulse }],
          },
        ]}
      />

      <View style={[styles.dotRing, { width: size, height: size }]}>
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.segment,
              { width: segmentWidth, height: segmentHeight, borderRadius: segmentWidth / 2 },
              segment.style,
            ]}
          />
        ))}

        <View
          style={[
            styles.markerWrap,
            {
              width: markerSize,
              height: markerSize,
              left: markerLeft,
              top: markerTop,
              borderRadius: markerSize / 2,
              transform: [{ rotate: `${markerAngle + 90}deg` }],
            },
          ]}
        >
          <Ionicons color={tone === 'gold' ? colors.goldSoft : colors.text} name="play" size={markerSize * 0.72} />
        </View>
      </View>

      <View style={[styles.innerRing, { width: size * 0.83, height: size * 0.83, borderRadius: (size * 0.83) / 2 }]}>
        <View
          style={[
            styles.coreSurface,
            {
              width: size * 0.74,
              height: size * 0.74,
              borderRadius: (size * 0.74) / 2,
              gap: contentGap,
              paddingHorizontal: clamp(size * 0.078, 20, 30),
            },
          ]}
        >
          {titleIcon ? <Ionicons color={colors.pink} name={titleIcon} size={titleIconSize} /> : null}
          <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={2} style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.18 }]}>
            {title ?? caption}
          </Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.time, { fontSize: timeSize }]}>
            {formatSeconds(remainingSeconds)}
          </Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.88} numberOfLines={2} style={[styles.subtitle, { fontSize: subtitleSize, lineHeight: subtitleSize * 1.18 }]}>
            {subtitle ?? caption}
          </Text>

          {promoText ? (
            <View style={[styles.promoPill, { minWidth: size * 0.45, paddingHorizontal: promoPaddingHorizontal }]}>
              <Ionicons color={colors.pink} name={promoIcon} size={promoIconSize} />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.92}
                numberOfLines={1}
                style={[styles.promoText, { fontSize: promoTextSize, lineHeight: promoTextSize * 1.16 }]}
              >
                {promoText}
              </Text>
            </View>
          ) : null}

          {footerSlot}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(185, 104, 255, 0.3)',
    shadowColor: colors.purple,
    shadowOpacity: 0.62,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    backgroundColor: 'rgba(72, 24, 110, 0.05)',
  },
  dotRing: {
    position: 'absolute',
  },
  segment: {
    position: 'absolute',
  },
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 17, 66, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(210, 148, 255, 0.24)',
    shadowColor: '#AF5DFF',
    shadowOpacity: 0.52,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(182, 112, 255, 0.42)',
    backgroundColor: 'rgba(8, 9, 27, 0.82)',
  },
  coreSurface: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 8, 22, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(176, 99, 255, 0.18)',
  },
  title: {
    color: '#FF63C8',
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  time: {
    color: colors.text,
    fontWeight: '900',
    width: '100%',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  promoPill: {
    minHeight: 38,
    marginTop: 2,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(210, 134, 255, 0.26)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '94%',
  },
  promoText: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 0,
  },
});
