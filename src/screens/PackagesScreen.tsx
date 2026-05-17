import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { plans } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

const planIcons = {
  sparkles: 'sparkles',
  flash: 'flash',
  trophy: 'trophy',
} as const;

const compactFeatures: Record<string, string[]> = {
  free: ['30 sn görüşme', 'Standart eşleşme', 'Temel profil'],
  plus: ['1 dk görüşme', '100 mesaj / ay', '10 arkadaş hakkı'],
  vip: ['3 dk görüşme', 'Sınırsız mesaj', 'Öncelikli eşleşme'],
};

export function PackagesScreen({ navigation }: AppScreenProps<'Packages'>) {
  const { width, height } = useWindowDimensions();
  const compact = width <= 390 || height <= 844;
  const tiny = width < 350 || height < 740;
  const { profile, setPlan } = useAppState();

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Planları kısa ve net karşılaştır" title="Paketler" />

      <View style={styles.planStack}>
        {plans.map((plan) => {
          const active = profile.plan === plan.id;
          const vipCard = plan.id === 'vip';
          const features = compactFeatures[plan.id] ?? plan.features.slice(0, 3);

          return (
            <LinearGradient colors={plan.accent} key={plan.id} style={[styles.wrap, vipCard && styles.vipWrap]}>
              <View style={[styles.inner, compact && styles.innerCompact]}>
                <View style={styles.topRow}>
                  <View style={styles.heading}>
                    <View style={styles.badgeRow}>
                      <Ionicons color={vipCard ? colors.goldSoft : colors.cyan} name={planIcons[plan.icon]} size={15} />
                      <Text style={styles.badgeLabel}>{plan.badge}</Text>
                      {active ? <Text style={styles.activePill}>Aktif plan</Text> : null}
                    </View>
                    <Text style={[styles.name, tiny && styles.nameCompact]}>{plan.name}</Text>
                    <Text numberOfLines={2} style={styles.description}>{plan.description}</Text>
                  </View>
                  <Text style={[styles.price, compact && styles.priceCompact]}>{plan.price}</Text>
                </View>

                <View style={styles.featureList}>
                  {features.map((feature) => (
                    <View key={feature} style={[styles.featureRow, tiny && styles.featureRowFull]}>
                      <Ionicons color={vipCard ? colors.goldSoft : colors.cyan} name="checkmark-circle" size={14} />
                      <Text numberOfLines={2} style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <GradientButton
                  compact
                  disabled={active}
                  onPress={() => void setPlan(plan.id)}
                  title={active ? 'Planın aktif' : `${plan.name} seç`}
                  variant={vipCard ? 'gold' : plan.id === 'plus' ? 'secondary' : 'ghost'}
                />
              </View>
            </LinearGradient>
          );
        })}
      </View>

      <GlassCard style={styles.noteCard}>
        <Text style={styles.noteTitle}>Konuşma süreleri</Text>
        <Text style={styles.noteText}>Ücretsiz 00:30 • Plus 01:00 • VIP 03:00. Hediye sonrası ek süre kazanılabilir.</Text>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  planStack: {
    gap: spacing.sm,
  },
  wrap: {
    borderRadius: radius.lg,
    padding: 1,
  },
  vipWrap: {
    shadowColor: colors.gold,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  inner: {
    borderRadius: radius.lg - 1,
    backgroundColor: 'rgba(7, 10, 28, 0.92)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  innerCompact: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heading: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  activePill: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(244,180,94,0.12)',
    overflow: 'hidden',
  },
  name: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  nameCompact: {
    fontSize: 20,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
  },
  price: {
    maxWidth: 112,
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  priceCompact: {
    maxWidth: 92,
    fontSize: 15,
  },
  featureList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  featureRow: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureRowFull: {
    width: '100%',
  },
  featureText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },
  noteCard: {
    gap: 4,
    paddingVertical: spacing.sm,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  noteText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
});
