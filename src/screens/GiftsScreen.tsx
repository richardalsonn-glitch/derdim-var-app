import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';
import { GiftHistory, listGiftHistory } from '../services/socialService';
import { GiftItem } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

function GiftRow({ item }: { item: GiftItem & { count?: number } }) {
  return (
    <GlassCard style={styles.giftCard}>
      <Text style={styles.symbol}>{item.symbol}</Text>
      <View style={styles.giftCopy}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.muted}>{item.caption}</Text>
      </View>
      <Text style={styles.count}>x{item.count ?? 0}</Text>
    </GlassCard>
  );
}

function GiftSection({ title, data }: { title: string; data: Array<GiftItem & { count?: number }> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptySmall}>Henüz kayıt yok.</Text>
      ) : (
        <FlatList
          data={data}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <GiftRow item={item} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      )}
    </View>
  );
}

export function GiftsScreen({ navigation }: AppScreenProps<'Gifts'>) {
  const [history, setHistory] = useState<GiftHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    void listGiftHistory().then((result) => {
      if (!mounted) {
        return;
      }

      if (result.error || !result.data) {
        setErrorMessage(getFriendlyErrorMessage(result.error, 'Hediye geçmişi yüklenemedi.'));
      } else {
        setHistory(result.data);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Alınan, gönderilen ve popüler hediyeler" title="Hediyeler" />
      {loading ? <ActivityIndicator color={colors.cyan} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {!loading && history && history.received.length + history.sent.length === 0 ? (
        <GlassCard>
          <Text style={styles.empty}>Henüz hediye geçmişin yok.</Text>
        </GlassCard>
      ) : null}
      {history ? (
        <>
          <GiftSection data={history.received} title="Alınan hediyeler" />
          <GiftSection data={history.sent} title="Gönderilen hediyeler" />
          <GiftSection data={history.popular.map((gift) => ({ ...gift, count: 0 }))} title="Popüler hediyeler" />
        </>
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  horizontalList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  giftCard: {
    width: 210,
    minHeight: 106,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    fontSize: 34,
  },
  giftCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12,
  },
  count: {
    color: colors.gold,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySmall: {
    color: colors.dim,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
