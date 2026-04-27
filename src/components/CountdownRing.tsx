import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, shadows } from '../constants/theme';

type CountdownRingProps = {
  totalSeconds: number;
  remainingSeconds: number;
  size?: number;
  tone?: 'purple' | 'gold' | 'blue';
};

type CountdownOptions = {
  initialSeconds: number;
  onExpire?: () => void;
  autoStart?: boolean;
};

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

export function CountdownRing({ totalSeconds, remainingSeconds, size = 232, tone = 'purple' }: CountdownRingProps) {
  const pulse = useRef(new Animated.Value(0.96)).current;
  const progress = totalSeconds === 0 ? 0 : remainingSeconds / totalSeconds;
  const ringColor = tone === 'gold' ? colors.gold : tone === 'blue' ? colors.cyan : colors.purple;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.96,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.outerGlow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: `${ringColor}55`,
            shadowColor: ringColor,
            transform: [{ scale: pulse }],
          },
        ]}
      />
      <View style={[styles.outerRing, { width: size - 14, height: size - 14, borderRadius: (size - 14) / 2, borderColor: `${ringColor}88` }]}>
        <View style={[styles.middleRing, { width: size - 34, height: size - 34, borderRadius: (size - 34) / 2 }]}>
          <View style={[styles.innerSurface, { width: size - 56, height: size - 56, borderRadius: (size - 56) / 2 }]}>
            <Text style={styles.caption}>kalan süre</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.time}>
              {formatSeconds(remainingSeconds)}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(6, progress * 100)}%`, backgroundColor: ringColor }]} />
            </View>
          </View>
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
    ...shadows.glow,
  },
  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(153, 70, 255, 0.05)',
  },
  middleRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  innerSurface: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 10, 28, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 22,
    gap: 10,
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  time: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    width: '100%',
    textAlign: 'center',
  },
  progressTrack: {
    width: '86%',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
