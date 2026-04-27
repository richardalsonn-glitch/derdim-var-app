import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { ChoiceChip } from '../components/ChoiceChip';
import { CountdownRing, useCountdownTimer } from '../components/CountdownRing';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { avatarOptions, getAvatarById, roleLabels, topics } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function MatchingScreen({ navigation }: AppScreenProps<'Matching'>) {
  const { activeRole, activeTopic, setActiveTopic, profile } = useAppState();
  const { remainingSeconds } = useCountdownTimer({ initialSeconds: 7 });
  const selfAvatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);

  const partnerAvatar = useMemo(() => {
    const pool = avatarOptions.filter((avatar) => avatar.id !== profile.avatarId);
    return getAvatarById(pool[0]?.id ?? avatarOptions[0].id);
  }, [profile.avatarId]);

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Seni anlayacak biri aranıyor" title="Eşleşme" />

      <GlassCard style={styles.centerCard}>
        <View style={styles.userRow}>
          <Avatar avatar={selfAvatar} size={56} />
          <View style={styles.userCopy}>
            <Text style={styles.userLabel}>Sen</Text>
            <Text style={styles.userMeta}>{selfAvatar.name} • {roleLabels[activeRole]}</Text>
          </View>
        </View>

        <Avatar avatar={partnerAvatar} size={104} />
        <View style={styles.identityBlock}>
          <Text style={styles.role}>{activeRole === 'derdim-var' ? 'Derman Olan' : 'Derdim Var'}</Text>
          <Text style={styles.alias}>{partnerAvatar.name}</Text>
          <Text style={styles.description}>Sana uygun bir ses odası hazırlanıyor. Konu etiketini seç ve görüşmeye bağlan.</Text>
        </View>

        <View style={styles.chipWrap}>
          {topics.map((topic) => (
            <ChoiceChip key={topic} label={topic} onPress={() => setActiveTopic(topic)} selected={activeTopic === topic} />
          ))}
        </View>

        <CountdownRing remainingSeconds={remainingSeconds} size={198} totalSeconds={7} />

        <GlassCard style={styles.noticeCard}>
          <Ionicons color={colors.pink} name="pulse" size={16} />
          <Text style={styles.noticeText}>
            {roleLabels[activeRole]} modundasın. Görüşme yalnızca ses odaklı ilerler.
          </Text>
        </GlassCard>
      </GlassCard>

      <GradientButton icon="call" onPress={() => navigation.replace('Chat')} title="Sesli görüşmeye bağlan" />
      <Pressable onPress={() => navigation.goBack()} style={styles.cancelWrap}>
        <Text style={styles.cancelText}>İptal et</Text>
      </Pressable>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  centerCard: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  userRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userCopy: {
    gap: 2,
  },
  userLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userMeta: {
    color: colors.text,
    fontWeight: '700',
  },
  identityBlock: {
    alignItems: 'center',
    gap: 6,
  },
  role: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  alias: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    lineHeight: 21,
    textAlign: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  noticeCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noticeText: {
    color: colors.muted,
    flex: 1,
    lineHeight: 19,
  },
  cancelWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.muted,
    fontWeight: '700',
  },
});
