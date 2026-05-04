import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';
import { GiftHistory, listGiftHistory } from '../services/socialService';
import { GiftItem } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type GiftDisplay = GiftItem & { count?: number };

function GiftCard({ item, onSelect }: { item: GiftDisplay; onSelect?: () => void }) {
  return (
    <GlassCard style={styles.giftCard}>
      <Text style={styles.symbol}>{item.symbol}</Text>
      <Text numberOfLines={1} style={styles.giftName}>{item.name}</Text>
      <Text numberOfLines={2} style={styles.giftCaption}>{item.caption}</Text>
      <Text style={styles.price}>{item.price}</Text>
      {typeof item.count === 'number' ? <Text style={styles.count}>Adet: {item.count}</Text> : null}
      {onSelect ? (
        <Pressable onPress={onSelect} style={styles.selectButton}>
          <Text style={styles.selectText}>Seç</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

function GiftGrid({ data, onSelect }: { data: GiftDisplay[]; onSelect?: () => void }) {
  if (data.length === 0) {
    return <Text style={styles.emptySmall}>Henüz kayıt yok.</Text>;
  }

  return (
    <View style={styles.grid}>
      {data.map((gift) => (
        <GiftCard key={gift.id} item={gift} onSelect={onSelect} />
      ))}
    </View>
  );
}

function HistorySection({ title, data }: { title: string; data: GiftDisplay[] }) {
  return (
    <GlassCard style={styles.historyCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptySmall}>Henüz kayıt yok.</Text>
      ) : (
        <View style={styles.historyList}>
          {data.map((gift) => (
            <View key={gift.id} style={styles.historyRow}>
              <Text style={styles.historySymbol}>{gift.symbol}</Text>
              <Text style={styles.historyName}>{gift.name}</Text>
              <Text style={styles.historyCount}>x{gift.count ?? 0}</Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

export function GiftsScreen({ navigation }: AppScreenProps<'Gifts'>) {
  const [history, setHistory] = useState<GiftHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

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

  const hasHistory = Boolean(history && history.received.length + history.sent.length > 0);
  const selectGift = () => setNoticeMessage('Hediye paketleri yakında mağaza içi satın alma ile açılacak. Dış ödeme kullanılmaz.');

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Katalog, geçmiş ve popüler hediyeler" title="Hediyeler" />
      {loading ? <ActivityIndicator color={colors.cyan} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {history ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popüler hediyeler</Text>
            <GiftGrid data={history.popular} onSelect={selectGift} />
          </View>

          {!hasHistory ? (
            <GlassCard>
              <Text style={styles.empty}>Henüz hediye geçmişin yok.</Text>
            </GlassCard>
          ) : null}

          <HistorySection data={history.received} title="Alınan hediyeler" />
          <HistorySection data={history.sent} title="Gönderilen hediyeler" />
        </>
      ) : null}

      {noticeMessage ? (
        <GlassCard>
          <Text style={styles.empty}>{noticeMessage}</Text>
        </GlassCard>
      ) : null}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: 96,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  giftCard: {
    width: '48%',
    minHeight: 168,
    padding: spacing.sm,
    borderRadius: radius.lg,
    gap: 5,
  },
  symbol: {
    fontSize: 30,
  },
  giftName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  giftCaption: {
    minHeight: 32,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  price: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
  },
  count: {
    color: colors.muted,
    fontSize: 11,
  },
  selectButton: {
    marginTop: 'auto',
    minHeight: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  historyCard: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  historySymbol: {
    fontSize: 20,
  },
  historyName: {
    flex: 1,
    color: colors.text,
    fontWeight: '800',
  },
  historyCount: {
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
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
