import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/GlassCard';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { AppScreenProps } from '../navigation/types';
import { GiftHistory, listGiftHistory } from '../services/socialService';
import { GiftItem } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type GiftDisplay = GiftItem & { count?: number; coinCost?: number };

function GiftRow({ item, onSelect }: { item: GiftDisplay; onSelect?: () => void }) {
  return (
    <GlassCard style={styles.giftCard}>
      <Text style={styles.symbol}>{item.symbol}</Text>
      <View style={styles.giftCopy}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.muted}>{item.caption}</Text>
        {item.coinCost ? <Text style={styles.coin}>{item.coinCost} jeton</Text> : null}
      </View>
      <Text style={styles.count}>x{item.count ?? 0}</Text>
      {onSelect ? (
        <Pressable onPress={onSelect} style={styles.selectButton}>
          <Text style={styles.selectText}>Seç</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

function GiftSection({ title, data, onSelect }: { title: string; data: GiftDisplay[]; onSelect?: () => void }) {
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
          renderItem={({ item }) => <GiftRow item={item} onSelect={onSelect} />}
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
          <GiftSection
            data={history.popular.map((gift) => ({ ...gift, count: 0 }))}
            onSelect={() => setNoticeMessage('Hediye göndermek için önce bir sohbet veya görüşme başlat. Hediye paketleri yakında mağaza içi satın alma ile açılacak.')}
            title="Popüler hediyeler"
          />
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
    width: 230,
    minHeight: 122,
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
  coin: {
    color: colors.gold,
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  count: {
    color: colors.gold,
    fontWeight: '900',
  },
  selectButton: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
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
