import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GiftGrid } from '../components/GiftGrid';
import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { giftCatalog } from '../data/giftCatalog';
import { AppScreenProps } from '../navigation/types';
import { GiftHistory, purchaseGiftCredit, listGiftHistory } from '../services/socialService';
import { GiftItem } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';
import { getContentMaxWidth, getHorizontalPadding, getScreenMetrics } from '../utils/responsive';

type GiftDisplay = GiftItem & { count?: number };

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
  const { width } = useWindowDimensions();
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

      if (result.error) {
        setErrorMessage(getFriendlyErrorMessage(result.error, 'Hediye geçmişi yüklenemedi.'));
      }

      setHistory(result.data ?? { received: [], sent: [], popular: giftCatalog, balances: {} });
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const hasHistory = Boolean(history && history.received.length + history.sent.length > 0);
  const catalog = history?.popular?.length ? history.popular : giftCatalog;
  const balances = history?.balances ?? {};
  const cardWidth = useMemo(() => {
    const screen = getScreenMetrics({ width, height: width });
    const contentMaxWidth = screen.isTablet ? 720 : Math.min(getContentMaxWidth(width), 430);
    const contentWidth = Math.min(width, contentMaxWidth) - getHorizontalPadding(width) * 2;
    const gap = width < 360 ? 8 : 12;
    const columns = screen.isTablet ? 3 : 2;

    return Math.floor((contentWidth - gap * (columns - 1)) / columns);
  }, [width]);

  async function selectGift(gift: GiftItem) {
    setNoticeMessage('');
    const result = await purchaseGiftCredit(gift, 1);

    if (result.error || !result.data) {
      setNoticeMessage(result.error?.message ?? 'Hediye hakkı alınamadı.');
      return;
    }

    setHistory((current) => ({
      received: current?.received ?? [],
      sent: current?.sent ?? [],
      popular: current?.popular?.length ? current.popular : giftCatalog,
      balances: result.data ?? {},
    }));
    setNoticeMessage(`${gift.name} hediye hakkı eklendi.`);
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Katalog, geçmiş ve popüler hediyeler" title="Hediyeler" />
      {loading ? <ActivityIndicator color={colors.cyan} /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popüler hediyeler</Text>
        <GiftGrid
          buttonLabel={() => 'Hediye Hakkı Al'}
          cardWidth={cardWidth}
          data={catalog}
          inventory={balances}
          onSelect={selectGift}
        />
      </View>

      {history ? (
        <>
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
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
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
