import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../Avatar';
import { radius } from '../../constants/theme';
import { HomePalette, ProfileCardData } from './types';

type ProfileCardProps = {
  data: ProfileCardData;
  avatar: Parameters<typeof Avatar>[0]['avatar'];
  palette: HomePalette;
  compact?: boolean;
  onPress: () => void;
};

function getPlanColors(plan: ProfileCardData['plan']) {
  if (plan === 'vip') {
    return ['rgba(125, 78, 255, 0.3)', 'rgba(70, 45, 120, 0.22)'] as const;
  }

  if (plan === 'plus') {
    return ['rgba(71, 160, 255, 0.26)', 'rgba(58, 62, 120, 0.18)'] as const;
  }

  return ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'] as const;
}

export function ProfileCard({ data, avatar, palette, compact = false, onPress }: ProfileCardProps) {
  const avatarSize = compact ? 72 : 80;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.992 : 1 }] }]}>
      <LinearGradient colors={['rgba(12, 13, 34, 0.92)', 'rgba(8, 8, 24, 0.88)']} style={[styles.card, { borderColor: palette.border, shadowColor: palette.shadow }, compact && styles.cardCompact]}>
        <View style={[styles.avatarRail, { width: avatarSize + 18 }]}>
          <LinearGradient colors={['#FF4FB9', '#7B58FF', '#55C8FF']} style={[styles.avatarRing, { width: avatarSize + 10, height: avatarSize + 10, borderRadius: (avatarSize + 10) / 2 }]}>
            <View style={[styles.avatarCore, { borderRadius: avatarSize / 2 }]}>
              <Avatar avatar={avatar} size={avatarSize} />
            </View>
          </LinearGradient>
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.mainCopy}>
          <View style={styles.nameRow}>
            <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={[styles.name, compact && styles.nameCompact, { color: palette.text }]}>
              {data.username}
            </Text>
            <View style={styles.onlineState}>
              <View style={[styles.onlineTinyDot, { backgroundColor: palette.green }]} />
              <Text numberOfLines={1} style={[styles.onlineText, { color: palette.green }]}>
                Çevrimiçi
              </Text>
            </View>
          </View>

          <LinearGradient colors={[...getPlanColors(data.plan)]} style={styles.planPill}>
            <Ionicons color={palette.text} name={data.plan === 'vip' ? 'trophy' : data.plan === 'plus' ? 'flash' : 'sparkles'} size={12} />
            <Text numberOfLines={1} style={[styles.planText, { color: palette.text }]}>
              {data.plan === 'free' ? 'Ücretsiz' : data.plan === 'plus' ? 'Plus Üye' : 'VIP Üye'}
            </Text>
          </LinearGradient>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons color={palette.gold} name="star" size={14} />
              <Text numberOfLines={1} style={[styles.statText, { color: palette.text }]}>
                {data.score.toFixed(1)} Derman
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <View style={styles.statItem}>
              <Ionicons color={palette.cyan} name="ribbon" size={14} />
              <Text numberOfLines={1} style={[styles.statText, { color: palette.text }]}>
                Level {data.level}
              </Text>
            </View>
          </View>

          <View style={styles.progressRail}>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.09)' }]}>
              <LinearGradient
                colors={['#FF56C2', '#A24CFF', '#5BC7FF']}
                end={{ x: 1, y: 0.5 }}
                start={{ x: 0, y: 0.5 }}
                style={[styles.progressFill, { width: `${Math.max(10, Math.min(100, data.progress * 100))}%` }]}
              />
            </View>
          </View>

          <Text numberOfLines={1} style={[styles.message, { color: palette.muted }]}>
            {data.message}
          </Text>
        </View>

        <View style={styles.badgeRail}>
          <LinearGradient colors={['rgba(111, 54, 255, 0.45)', 'rgba(71, 29, 120, 0.55)']} style={[styles.levelBadge, compact && styles.levelBadgeCompact]}>
            <Ionicons color="#DCA4FF" name="diamond" size={compact ? 28 : 34} />
          </LinearGradient>
          <Text numberOfLines={1} style={[styles.levelText, { color: palette.text }]}>
            Level {data.level}
          </Text>
          <Text numberOfLines={1} style={[styles.levelPercent, { color: palette.muted }]}>
            %{Math.round(data.progress * 100)}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 132,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  cardCompact: {
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  avatarRail: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  avatarCore: {
    overflow: 'hidden',
    backgroundColor: '#0A0C1D',
  },
  onlineDot: {
    position: 'absolute',
    right: 6,
    bottom: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2CFB72',
    borderWidth: 2,
    borderColor: '#0B0D20',
  },
  mainCopy: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 21,
    fontWeight: '900',
  },
  nameCompact: {
    fontSize: 19,
  },
  onlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineTinyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 12,
  },
  progressRail: {
    paddingTop: 1,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeRail: {
    width: 78,
    alignItems: 'center',
    gap: 5,
    marginLeft: 8,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(222, 172, 255, 0.2)',
    shadowColor: '#8C4FFF',
    shadowOpacity: 0.42,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  levelBadgeCompact: {
    width: 58,
    height: 58,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  levelPercent: {
    fontSize: 11,
    fontWeight: '700',
  },
});
