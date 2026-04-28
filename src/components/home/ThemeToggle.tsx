import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius } from '../../constants/theme';
import { UiTheme } from '../../types';
import { HomePalette } from './types';

type ThemeToggleProps = {
  mode: UiTheme;
  palette: HomePalette;
  compact?: boolean;
  onToggle: () => void;
};

export function ThemeToggle({ mode, palette, compact = false, onToggle }: ThemeToggleProps) {
  const translate = useRef(new Animated.Value(mode === 'dark' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(translate, {
      toValue: mode === 'dark' ? 0 : 1,
      damping: 14,
      mass: 0.9,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [mode, translate]);

  const width = compact ? 104 : 118;
  const height = compact ? 44 : 48;
  const knobWidth = width / 2;

  return (
    <Pressable onPress={onToggle} style={[styles.container, { width, height, borderRadius: height / 2, borderColor: palette.border, backgroundColor: palette.surfaceStrong }]}>
      <Animated.View
        style={[
          styles.highlight,
          {
            width: knobWidth - 6,
            height: height - 6,
            borderRadius: (height - 6) / 2,
            backgroundColor: mode === 'dark' ? 'rgba(255, 189, 84, 0.18)' : 'rgba(113, 91, 255, 0.18)',
            borderColor: mode === 'dark' ? 'rgba(255, 189, 84, 0.46)' : 'rgba(113, 91, 255, 0.4)',
            transform: [
              {
                translateX: translate.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, knobWidth],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.segment}>
        <Ionicons color={mode === 'dark' ? '#FFD56B' : palette.muted} name="moon" size={compact ? 18 : 20} />
      </View>
      <View style={[styles.segment, styles.segmentDivider, { borderLeftColor: palette.border }]}>
        <Ionicons color={mode === 'light' ? palette.text : palette.muted} name="sunny" size={compact ? 18 : 20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    padding: 3,
  },
  highlight: {
    position: 'absolute',
    top: 3,
    borderWidth: 1,
    shadowColor: '#FFB84D',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  segmentDivider: {
    borderLeftWidth: 1,
  },
});
