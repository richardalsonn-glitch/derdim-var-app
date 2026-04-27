import { StyleSheet, Text, View } from 'react-native';
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

export function PackagesScreen({ navigation }: AppScreenProps<'Packages'>) {
  const { profile, setPlan } = useAppState();

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Ücretsiz, Plus ve VIP farklarını net gör" title="Paketler" />

      {plans.map((plan) => {
        const active = profile.plan === plan.id;
        const vipCard = plan.id === 'vip';

        return (
          <LinearGradient colors={plan.accent} key={plan.id} style={[styles.wrap, vipCard && styles.vipWrap]}>
            <View style={styles.inner}>
              <View style={styles.topRow}>
                <View style={styles.heading}>
                  <View style={styles.badgeRow}>
                    <Ionicons color={vipCard ? colors.goldSoft : colors.cyan} name={planIcons[plan.icon]} size={18} />
                    <Text style={styles.badgeLabel}>{plan.badge}</Text>
                  </View>
                  <Text style={styles.name}>{plan.name}</Text>
                  <Text style={styles.description}>{plan.description}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.price}>{plan.price}</Text>
                  {active ? <Text style={styles.activeLabel}>Aktif plan</Text> : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Ionicons color={vipCard ? colors.goldSoft : colors.cyan} name="checkmark-circle" size={16} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <GradientButton
                onPress={() => setPlan(plan.id)}
                title={active ? 'Aktif planın' : `${plan.name} planını seç`}
                variant={vipCard ? 'gold' : plan.id === 'plus' ? 'secondary' : 'ghost'}
              />
            </View>
          </LinearGradient>
        );
      })}

      <GlassCard style={styles.noteCard}>
        <Text style={styles.noteTitle}>Konuşma süreleri</Text>
        <Text style={styles.noteText}>Free 00:30 • Plus 01:00 • VIP 03:00. Hediye sonrası Plus/Free +1 dk, VIP +2 dk kazanır.</Text>
      </GlassCard>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    padding: 1,
  },
  vipWrap: {
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  inner: {
    borderRadius: radius.xl - 1,
    backgroundColor: 'rgba(7, 10, 28, 0.92)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heading: {
    flex: 1,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    lineHeight: 20,
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 8,
  },
  price: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
  },
  activeLabel: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
    color: colors.text,
    lineHeight: 20,
  },
  noteCard: {
    gap: 6,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  noteText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
