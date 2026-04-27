import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from './Avatar';
import { BadgePill } from './BadgePill';
import { GlassCard } from './GlassCard';
import { colors, radius, spacing } from '../constants/theme';
import { AppProfile } from '../types';
import { getAvatarById } from '../data/mockData';

type DrawerItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
};

type SideDrawerProps = {
  visible: boolean;
  profile: AppProfile;
  userScore: number;
  userLevel: number;
  onClose: () => void;
  items: DrawerItem[];
};

export function SideDrawer({ visible, profile, userScore, userLevel, onClose, items }: SideDrawerProps) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.84, 360);
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const avatar = getAvatarById(profile.avatarId);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -drawerWidth,
      duration: visible ? 240 : 180,
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, translateX, visible]);

  return (
    <Modal transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
          <GlassCard style={styles.drawerCard} toned="strong">
            <View style={styles.topRow}>
              <View style={styles.identityRow}>
                <Avatar avatar={avatar} size={64} />
                <View style={styles.identityCopy}>
                  <Text style={styles.username}>{profile.username}</Text>
                  <Text style={styles.meta}>
                    Level {userLevel} • {userScore} puan
                  </Text>
                  <BadgePill badge={{ id: profile.plan, name: profile.plan.toUpperCase(), description: '', icon: 'star', gradient: ['#7E56FF', '#2FA7FF'] }} />
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.menuList}>
              {items.map((item) => (
                <Pressable key={item.label} onPress={item.action} style={styles.menuItem}>
                  <View style={styles.menuIcon}>
                    <Ionicons color={colors.text} name={item.icon} size={18} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons color={colors.muted} name="chevron-forward" size={16} />
                </Pressable>
              ))}
            </View>
          </GlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 4, 12, 0.72)',
    justifyContent: 'flex-start',
  },
  drawer: {
    height: '100%',
  },
  drawerCard: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  username: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuList: {
    gap: 10,
    marginTop: spacing.sm,
  },
  menuItem: {
    minHeight: 54,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuLabel: {
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
});
