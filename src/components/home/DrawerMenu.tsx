import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../Avatar';
import { radius } from '../../constants/theme';
import { DrawerItem, HomePalette } from './types';

type DrawerMenuProps = {
  visible: boolean;
  palette: HomePalette;
  avatar: Parameters<typeof Avatar>[0]['avatar'];
  username: string;
  planLabel: string;
  items: DrawerItem[];
  onClose: () => void;
  onSelect: (item: DrawerItem) => void;
};

export function DrawerMenu({ visible, palette, avatar, username, planLabel, items, onClose, onSelect }: DrawerMenuProps) {
  const { width } = useWindowDimensions();
  const translate = useRef(new Animated.Value(-320)).current;
  const [renderVisible, setRenderVisible] = useState(visible);
  const drawerWidth = Math.min(286, width * 0.78);

  useEffect(() => {
    if (visible) {
      setRenderVisible(true);
    }

    Animated.timing(translate, {
      toValue: visible ? 0 : -drawerWidth - 24,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setRenderVisible(false);
      }
    });
  }, [drawerWidth, translate, visible]);

  if (!renderVisible) {
    return null;
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible={renderVisible}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ width: drawerWidth, transform: [{ translateX: translate }] }}>
          <LinearGradient colors={['rgba(14, 17, 44, 0.98)', 'rgba(7, 9, 25, 0.98)']} style={[styles.drawer, { borderColor: palette.border }]}>
            <View style={styles.header}>
              <View style={styles.identityRow}>
                <Avatar avatar={avatar} size={58} />
                <View style={styles.identityCopy}>
                  <Text numberOfLines={1} style={[styles.username, { color: palette.text }]}>
                    {username}
                  </Text>
                  <Text numberOfLines={1} style={[styles.plan, { color: palette.muted }]}>
                    {planLabel}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={[styles.closeButton, { borderColor: palette.border }]}>
                <Ionicons color={palette.text} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.menuList}>
              {items.map((item) => (
                <Pressable key={item.key} onPress={() => onSelect(item)} style={({ pressed }) => [styles.menuItem, { borderColor: palette.border, backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }]}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <Ionicons color={palette.text} name={item.icon} size={18} />
                  </View>
                  <Text numberOfLines={1} style={[styles.menuLabel, { color: palette.text }]}>
                    {item.label}
                  </Text>
                  <Ionicons color={palette.muted} name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(4, 7, 18, 0.62)',
  },
  drawer: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 18,
    gap: 18,
    shadowColor: '#8E4EFF',
    shadowOpacity: 0.42,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  identityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  username: {
    fontSize: 18,
    fontWeight: '900',
  },
  plan: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  menuList: {
    gap: 10,
  },
  menuItem: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
