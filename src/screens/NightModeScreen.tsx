import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { isDemoMode } from '../config/features';
import { colors, radius, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import {
  fetchNightVoiceRooms,
  getCurrentUserId,
  joinVoiceRoomSeat,
  requestPaidVoiceRoomJoin,
  subscribeToNightVoiceRoomsLobby,
} from '../services/voiceRoomService';
import { VoiceRoom } from '../types';
import { getNightModeSubtitle, isNightModeOpen, NIGHT_MODE_CLOSED_MESSAGE } from '../utils/nightMode';

type ModalState = {
  title: string;
  message: string;
};

function formatShortTime(room: VoiceRoom, nowMs: number) {
  if (!room.expiresAt) {
    return room.pricingType === 'paid' ? '3 saat' : '30 dk';
  }

  const remainingSeconds = Math.max(0, Math.floor((new Date(room.expiresAt).getTime() - nowMs) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);

  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
  }

  return `${minutes} dk`;
}

function getRoomStateText(room: VoiceRoom) {
  if (room.currentCount >= room.capacity || room.status === 'full') {
    return 'Dolu';
  }

  return room.status === 'active' ? 'Aktif' : 'Açık';
}

function getFreeSeat(room: VoiceRoom) {
  for (let seatIndex = 0; seatIndex < room.capacity; seatIndex += 1) {
    if (!room.members.some((member) => member.seatIndex === seatIndex)) {
      return seatIndex;
    }
  }

  return null;
}

export function NightModeScreen({ navigation }: AppScreenProps<'NightMode'>) {
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const nightOpen = isDemoMode || isNightModeOpen();

  const loadRooms = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    const [userId, roomResult] = await Promise.all([getCurrentUserId(), fetchNightVoiceRooms()]);
    setCurrentUserId(userId);

    if (roomResult.data) {
      setRooms(roomResult.data);
    } else if (roomResult.error && !silent) {
      setModal({ title: 'Bir aksilik oldu', message: roomResult.error.message });
    }

    if (!silent) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => subscribeToNightVoiceRoomsLobby(() => void loadRooms(true)), [loadRooms]);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      void loadRooms(true);
    }, 10000);

    return () => clearInterval(refreshTimer);
  }, [loadRooms]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const freeRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'free').slice(0, 5), [rooms]);
  const paidRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'paid').slice(0, 5), [rooms]);

  async function handleRoomPress(room: VoiceRoom) {
    const isMember = room.members.some((member) => member.userId === currentUserId);

    if (isMember) {
      navigation.navigate('NightRoom', { roomId: room.id });
      return;
    }

    if (!currentUserId) {
      setModal({ title: 'Giriş gerekli', message: 'Gece Modu odalarına katılmak için giriş yapman gerekiyor.' });
      return;
    }

    if (room.currentCount >= room.capacity) {
      setModal({ title: 'Oda dolu', message: 'Bu odada şu an boş koltuk yok.' });
      return;
    }

    if (room.pricingType === 'paid') {
      if (!room.ownerId) {
        setModal({
          title: 'Ücretli Oda',
          message: '79,99 TL / oda. Mağaza içi satın alma yakında aktif olacak.',
        });
        return;
      }

      setBusyRoomId(room.id);
      const result = await requestPaidVoiceRoomJoin(room.id);
      setBusyRoomId(null);

      if (result.error) {
        setModal({ title: 'İşlem tamamlanamadı', message: result.error.message });
        return;
      }

      setModal({ title: 'İstek gönderildi', message: 'İsteğin oda sahibine iletildi.' });
      await loadRooms(true);
      return;
    }

    const seat = getFreeSeat(room);

    if (seat === null) {
      setModal({ title: 'Oda dolu', message: 'Bu odada şu an boş koltuk yok.' });
      return;
    }

    setBusyRoomId(room.id);
    const result = await joinVoiceRoomSeat(room.id, seat);
    setBusyRoomId(null);

    if (result.error) {
      setModal({ title: 'İşlem tamamlanamadı', message: result.error.message });
      return;
    }

    navigation.navigate('NightRoom', { roomId: room.id });
  }

  function renderMiniSeat(room: VoiceRoom, seatIndex: number) {
    const member = room.members.find((item) => item.seatIndex === seatIndex);
    const seatPositionStyle = [styles.miniSeatTop, styles.miniSeatRight, styles.miniSeatBottom, styles.miniSeatLeft][seatIndex];

    return (
      <View key={seatIndex} style={[styles.miniSeat, seatPositionStyle, member && styles.filledMiniSeat]}>
        {member ? (
          <Avatar avatar={getAvatarById(member.avatarId)} size={24} />
        ) : (
          <>
            <Ionicons color={colors.dim} name="ellipse-outline" size={14} />
            <Text style={styles.emptyMiniSeatText}>Boş</Text>
          </>
        )}
      </View>
    );
  }

  function renderRoomCard(room: VoiceRoom) {
    const isPaid = room.pricingType === 'paid';
    const isFull = room.currentCount >= room.capacity || room.status === 'full';
    const isMember = room.members.some((member) => member.userId === currentUserId);
    const hasPendingRequest = room.requests.some((request) => request.requesterId === currentUserId && request.status === 'pending');
    const buttonTitle = isMember ? 'Gir' : isFull ? 'Dolu' : isPaid && room.ownerId ? (hasPendingRequest ? 'Bekliyor' : 'İstek') : 'Otur';

    return (
      <Pressable
        key={room.id}
        disabled={busyRoomId === room.id || hasPendingRequest || (isFull && !isMember)}
        onPress={() => void handleRoomPress(room)}
        style={styles.roomPressable}
      >
        <LinearGradient
          colors={isPaid ? ['rgba(244,180,94,0.22)', 'rgba(153,70,255,0.1)', 'rgba(20,24,60,0.78)'] : ['rgba(69,224,255,0.16)', 'rgba(153,70,255,0.12)', 'rgba(20,24,60,0.78)']}
          style={[styles.compactRoomCard, isFull && styles.fullRoomCard]}
        >
          <View pointerEvents="none" style={[styles.cardSheen, isPaid && styles.paidCardSheen]} />
          <View style={styles.compactHeader}>
            <View style={styles.compactTitleBlock}>
              <Text numberOfLines={1} style={styles.compactRoomName}>{room.name}</Text>
              <View style={styles.tagRow}>
                <Text style={[styles.roomTag, isPaid && styles.paidTag]}>{isPaid ? 'Ücretli' : 'Ücretsiz'}</Text>
                <Text style={[styles.roomTag, isFull && styles.fullTag]}>{getRoomStateText(room)}</Text>
              </View>
            </View>
            <Text style={styles.compactCount}>{room.currentCount}/{room.capacity}</Text>
          </View>

          <View style={styles.miniRoomScene}>
            <View style={[styles.miniTable, isPaid && styles.paidMiniTable]}>
              <View style={styles.miniTableInner}>
                <Ionicons color={isPaid ? colors.goldSoft : colors.cyan} name="moon" size={15} />
              </View>
            </View>
            {Array.from({ length: room.capacity }).map((_, index) => renderMiniSeat(room, index))}
          </View>

          <View style={styles.compactFooter}>
            <View style={styles.timePill}>
              <Ionicons color={colors.muted} name="time" size={12} />
              <Text style={styles.timeText}>{formatShortTime(room, nowMs)}</Text>
            </View>
            {isPaid ? <Text style={styles.priceText}>79,99 TL / oda</Text> : null}
            <View style={[styles.inlineButton, isPaid && styles.paidInlineButton, (isFull && !isMember) && styles.disabledInlineButton]}>
              {busyRoomId === room.id ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.inlineButtonText}>{buttonTitle}</Text>}
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  function renderSection(title: string, subtitle: string, sectionRooms: VoiceRoom[]) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionMeta}>{subtitle}</Text>
        </View>
        <View style={styles.roomGrid}>
          {sectionRooms.map(renderRoomCard)}
        </View>
      </View>
    );
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle={getNightModeSubtitle(isDemoMode)} title="Gece Modu" />

      {!nightOpen ? (
        <GlassCard style={styles.closedCard}>
          <Ionicons color={colors.goldSoft} name="moon" size={28} />
          <Text style={styles.closedText}>{NIGHT_MODE_CLOSED_MESSAGE}</Text>
        </GlassCard>
      ) : loading ? (
        <GlassCard style={styles.loadingCard}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>Odalar hazırlanıyor...</Text>
        </GlassCard>
      ) : (
        <>
          <View style={styles.heroStrip}>
            <View>
              <Text style={styles.heroTitle}>Gece odaları</Text>
              <Text style={styles.heroText}>Masa çevresindeki koltuklardan birini seç.</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>10 oda</Text>
            </View>
          </View>

          {renderSection('Ücretsiz Odalar', '4 kişi dolunca konuşma başlar', freeRooms)}
          {renderSection('Ücretli Odalar', 'Sahipli oda, istekle katılım', paidRooms)}
        </>
      )}

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setModal(null), variant: 'secondary' }]}
        message={modal?.message ?? ''}
        onClose={() => setModal(null)}
        title={modal?.title ?? ''}
        visible={Boolean(modal)}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  heroStrip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
  heroBadge: {
    backgroundColor: 'rgba(153,70,255,0.24)',
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  roomPressable: {
    width: '48.5%',
  },
  compactRoomCard: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 212,
    overflow: 'hidden',
    padding: spacing.sm,
    shadowColor: colors.purple,
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
  cardSheen: {
    backgroundColor: 'rgba(69,224,255,0.1)',
    borderRadius: 999,
    height: 86,
    position: 'absolute',
    right: -38,
    top: -44,
    width: 86,
  },
  paidCardSheen: {
    backgroundColor: 'rgba(244,180,94,0.13)',
  },
  fullRoomCard: {
    opacity: 0.78,
  },
  compactHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  compactTitleBlock: {
    flex: 1,
    gap: 7,
  },
  compactRoomName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  roomTag: {
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.22)',
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  paidTag: {
    backgroundColor: 'rgba(244,180,94,0.15)',
    borderColor: 'rgba(244,180,94,0.32)',
    color: colors.goldSoft,
  },
  fullTag: {
    backgroundColor: 'rgba(255,124,156,0.14)',
    borderColor: 'rgba(255,124,156,0.28)',
    color: colors.danger,
  },
  compactCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  miniRoomScene: {
    alignItems: 'center',
    height: 88,
    justifyContent: 'center',
    marginTop: spacing.xs,
    position: 'relative',
  },
  miniTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.26)',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  miniTableInner: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.62)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  paidMiniTable: {
    backgroundColor: 'rgba(244,180,94,0.12)',
    borderColor: 'rgba(244,180,94,0.28)',
  },
  miniSeat: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    width: 42,
  },
  filledMiniSeat: {
    backgroundColor: 'rgba(153,70,255,0.24)',
    borderColor: 'rgba(247,238,255,0.24)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  miniSeatTop: {
    top: 0,
  },
  miniSeatRight: {
    right: 0,
    top: 28,
  },
  miniSeatBottom: {
    bottom: 0,
  },
  miniSeatLeft: {
    left: 0,
    top: 28,
  },
  emptyMiniSeatText: {
    color: colors.dim,
    fontSize: 8,
    fontWeight: '800',
    marginTop: -2,
  },
  compactFooter: {
    gap: 7,
    marginTop: spacing.xs,
  },
  timePill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  timeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  priceText: {
    color: colors.goldSoft,
    fontSize: 11,
    fontWeight: '900',
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.18)',
    borderColor: 'rgba(69,224,255,0.25)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    shadowColor: colors.cyan,
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  paidInlineButton: {
    backgroundColor: 'rgba(244,180,94,0.17)',
    borderColor: 'rgba(244,180,94,0.28)',
  },
  disabledInlineButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inlineButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  closedCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  closedText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
