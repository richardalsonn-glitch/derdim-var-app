import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, spacing } from '../constants/theme';
import { Badge } from '../types';

type BadgePillProps = {
  badge: Badge;
};

export function BadgePill({ badge }: BadgePillProps) {
  return (
    <LinearGradient colors={badge.gradient} style={styles.gradientWrap}>
      <View style={styles.inner}>
        <Ionicons color={colors.text} name={badge.icon} size={15} />
        <Text numberOfLines={1} style={styles.name}>
          {badge.name}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrap: {
    borderRadius: radius.pill,
    padding: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 12, 30, 0.88)',
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
