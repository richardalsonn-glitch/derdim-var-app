import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius } from '../../constants/theme';
import { HomePalette } from './types';

export type BottomTabItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
};

type BottomTabBarProps = {
  activeKey: string;
  items: BottomTabItem[];
  palette: HomePalette;
  compact?: boolean;
  onSelect: (item: BottomTabItem) => void;
};

export function BottomTabBar({ activeKey, items, palette, compact = false, onSelect }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }, compact && styles.barCompact]}>
      {items.map((item) => {
        const active = item.key === activeKey;

        return (
          <Pressable key={item.key} onPress={() => onSelect(item)} style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
            <Ionicons color={active ? palette.pink : palette.tabInactive} name={item.icon} size={compact ? 21 : 23} />
            {item.badgeCount && item.badgeCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: palette.pink }]}>
                <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.badgeText}>
                  {item.badgeCount > 99 ? '99+' : item.badgeCount}
                </Text>
              </View>
            ) : null}
            <Text numberOfLines={1} style={[styles.label, { color: active ? palette.pink : palette.tabInactive }, compact && styles.labelCompact]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: '#6D39FF',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  barCompact: {
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
    position: 'relative',
  },
  tabPressed: {
    opacity: 0.82,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  labelCompact: {
    fontSize: 10,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: '22%',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
