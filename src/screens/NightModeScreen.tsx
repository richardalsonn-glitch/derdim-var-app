import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { NoticeModal } from '../components/NoticeModal';
import { isDemoMode } from '../config/features';
import { colors, layout, radius, spacing } from '../constants/theme';
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
import { isNightModeOpen, NIGHT_MODE_CLOSED_MESSAGE } from '../utils/nightMode';

const nightRoomBackground = require('../../assets/images/night-room-background.png');

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

function NightBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground resizeMode="cover" source={nightRoomBackground} style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundDim} />
      <LinearGradient
        colors={['rgba(5,6,20,0.2)', 'rgba(5,6,20,0.35)', 'rgba(5,6,20,0.54)']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </ImageBackground>
  );
}

export function NightModeScreen({ navigation }: AppScreenProps<'NightMode'>) {
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedRoomType, setSelectedRoomType] = useState<'free' | 'paid'>('free');
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

  const freeRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'free').slice(0, 4), [rooms]);
  const paidRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'paid').slice(0, 4), [rooms]);
  const visibleRooms = selectedRoomType === 'free' ? freeRooms : paidRooms;
  const selectedIsPaid = selectedRoomType === 'paid';
  const selectedSectionTitle = selectedIsPaid ? 'Ücretli Odalar' : 'Ücretsiz Odalar';
  const selectedSectionHint = selectedIsPaid ? 'Sahipli oda, istekle katılım' : '4 kişi dolunca konuşma başlar';

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

  function renderMiniSeat(room: VoiceRoom, seatIndex: number, isPaid: boolean) {
    const member = room.members.find((item) => item.seatIndex === seatIndex);
    const seatPositionStyle = [styles.miniSeatTop, styles.miniSeatRight, styles.miniSeatBottom, styles.miniSeatLeft][seatIndex];

    return (
      <View
        key={seatIndex}
        style={[
          styles.miniSeat,
          isPaid && styles.paidMiniSeat,
          seatPositionStyle,
          member && styles.filledMiniSeat,
          member && isPaid && styles.paidFilledMiniSeat,
        ]}
      >
        {member ? (
          <Avatar avatar={getAvatarById(member.avatarId)} size={22} />
        ) : (
          <Text style={styles.emptyMiniSeatText}>Boş</Text>
        )}
      </View>
    );
  }

  function renderRoomCard(room: VoiceRoom) {
    const isPaid = room.pricingType === 'paid';
    const isFull = room.currentCount >= room.capacity || room.status === 'full';
    const isMember = room.members.some((member) => member.userId === currentUserId);
    const hasPendingRequest = room.requests.some((request) => request.requesterId === currentUserId && request.status === 'pending');
    const buttonTitle = isMember ? 'Gir' : isFull ? 'Dolu' : hasPendingRequest ? 'Bekliyor' : 'Otur';

    return (
      <Pressable
        key={room.id}
        disabled={busyRoomId === room.id || hasPendingRequest || (isFull && !isMember)}
        onPress={() => void handleRoomPress(room)}
        style={styles.roomPressable}
      >
        <LinearGradient
          colors={isPaid ? ['rgba(244,180,94,0.2)', 'rgba(153,70,255,0.1)', 'rgba(8,10,32,0.78)'] : ['rgba(69,224,255,0.14)', 'rgba(153,70,255,0.12)', 'rgba(8,10,32,0.78)']}
          style={[styles.roomCard, isPaid ? styles.paidRoomCard : styles.freeRoomCard, isFull && styles.fullRoomCard]}
        >
          <View pointerEvents="none" style={[styles.cardSheen, isPaid && styles.paidCardSheen]} />
          <View pointerEvents="none" style={[styles.cardAccent, isPaid ? styles.paidCardAccent : styles.freeCardAccent]} />
          <View style={styles.roomCardHeader}>
            <Text numberOfLines={1} style={styles.roomName}>{room.name || 'Şu anda bu oda müsaittir'}</Text>
            <Text style={styles.roomCount}>{room.currentCount}/{room.capacity}</Text>
          </View>
          <View style={styles.tagRow}>
            <Text style={[styles.roomTag, isPaid && styles.paidTag]}>{isPaid ? 'Ücretli' : 'Ücretsiz'}</Text>
            <Text style={[styles.roomTag, isFull && styles.fullTag]}>{getRoomStateText(room)}</Text>
          </View>

          <View style={styles.miniRoomScene}>
            <View style={[styles.miniTable, isPaid && styles.paidMiniTable]}>
              <Ionicons color={isPaid ? colors.goldSoft : colors.cyan} name="moon" size={24} />
            </View>
            {Array.from({ length: room.capacity }).map((_, index) => renderMiniSeat(room, index, isPaid))}
          </View>

          <View style={styles.roomCardFooter}>
            <View style={styles.timePill}>
              <Ionicons color={colors.muted} name="time" size={12} />
              <Text style={styles.timeText}>{formatShortTime(room, nowMs)}</Text>
            </View>
            {isPaid ? <Text style={styles.priceText}>79,99 TL / oda</Text> : null}
          </View>

          <View style={[styles.inlineButton, isPaid && styles.paidInlineButton, (isFull && !isMember) && styles.disabledInlineButton]}>
            {busyRoomId === room.id ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.inlineButtonText}>{buttonTitle}</Text>}
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  function renderSection(title: string, subtitle: string, sectionRooms: VoiceRoom[], kind: 'free' | 'paid') {
    const paid = kind === 'paid';

    return (
      <LinearGradient
        colors={paid ? ['rgba(244,180,94,0.13)', 'rgba(255,79,185,0.08)', 'rgba(8,10,32,0.42)'] : ['rgba(69,224,255,0.12)', 'rgba(81,93,255,0.08)', 'rgba(8,10,32,0.42)']}
        style={[styles.section, paid ? styles.paidSection : styles.freeSection]}
      >
        <View pointerEvents="none" style={[styles.sectionGlow, paid ? styles.paidSectionGlow : styles.freeSectionGlow]} />
        <View style={styles.sectionMetaRow}>
          <View style={styles.sectionTitleWrap}>
            <View style={[styles.sectionIcon, paid ? styles.paidSectionIcon : styles.freeSectionIcon]}>
              <Ionicons color={paid ? colors.goldSoft : colors.cyan} name={paid ? 'sparkles' : 'moon'} size={15} />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <Text style={styles.sectionHint}>{subtitle}</Text>
        </View>
        <View style={styles.roomGrid}>{sectionRooms.map(renderRoomCard)}</View>
      </LinearGradient>
    );
  }

  function renderRoomTypeSegment() {
    return (
      <View style={styles.segmentWrap}>
        <Pressable onPress={() => setSelectedRoomType('free')} style={styles.segmentPressable}>
          <LinearGradient
            colors={selectedRoomType === 'free' ? ['rgba(69,224,255,0.34)', 'rgba(153,70,255,0.28)'] : ['rgba(255,255,255,0.035)', 'rgba(255,255,255,0.018)']}
            style={[styles.segmentButton, selectedRoomType === 'free' && styles.activeFreeSegment]}
          >
            <Ionicons color={selectedRoomType === 'free' ? colors.cyan : colors.muted} name="moon" size={18} />
            <Text style={[styles.segmentText, selectedRoomType === 'free' && styles.activeSegmentText]}>Ücretsiz</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => setSelectedRoomType('paid')} style={styles.segmentPressable}>
          <LinearGradient
            colors={selectedRoomType === 'paid' ? ['rgba(244,180,94,0.36)', 'rgba(255,79,185,0.24)', 'rgba(153,70,255,0.22)'] : ['rgba(255,255,255,0.035)', 'rgba(255,255,255,0.018)']}
            style={[styles.segmentButton, selectedRoomType === 'paid' && styles.activePaidSegment]}
          >
            <Ionicons color={selectedRoomType === 'paid' ? colors.goldSoft : colors.muted} name="sparkles" size={18} />
            <Text style={[styles.segmentText, selectedRoomType === 'paid' && styles.activeSegmentText]}>Ücretli</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <NightBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons color={colors.text} name="chevron-back" size={30} />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle}>Gece Modu</Text>
                <Text style={styles.headerSubtitle}>22:00 - 06:00 • Türkiye saati</Text>
              </View>
            </View>

            {!nightOpen ? (
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(153,70,255,0.08)']} style={styles.closedCard}>
                <Ionicons color={colors.goldSoft} name="moon" size={28} />
                <Text style={styles.closedText}>{NIGHT_MODE_CLOSED_MESSAGE}</Text>
              </LinearGradient>
            ) : loading ? (
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(153,70,255,0.08)']} style={styles.loadingCard}>
                <ActivityIndicator color={colors.cyan} />
                <Text style={styles.loadingText}>Odalar hazırlanıyor...</Text>
              </LinearGradient>
            ) : (
              <>
                <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(153,70,255,0.08)', 'rgba(255,255,255,0.035)']} style={styles.heroCard}>
                  <View style={styles.heroIcon}>
                    <Ionicons color={colors.goldSoft} name="moon" size={34} />
                  </View>
                  <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>Gece odaları</Text>
                    <Text style={styles.heroText}>Masa çevresindeki koltuklardan birini seç.</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>8 oda</Text>
                  </View>
                </LinearGradient>

                {renderRoomTypeSegment()}
                {renderSection(selectedSectionTitle, selectedSectionHint, visibleRooms, selectedRoomType)}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setModal(null), variant: 'secondary' }]}
        message={modal?.message ?? ''}
        onClose={() => setModal(null)}
        title={modal?.title ?? ''}
        visible={Boolean(modal)}
      />
    </NightBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,6,20,0.34)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: layout.maxWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: 'rgba(153,70,255,0.45)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#BFB4FF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  heroCard: {
    alignItems: 'center',
    borderColor: 'rgba(153,70,255,0.5)',
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 126,
    overflow: 'hidden',
    padding: spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(153,70,255,0.24)',
    borderColor: 'rgba(174,111,255,0.42)',
    borderRadius: 34,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 5,
  },
  heroBadge: {
    backgroundColor: 'rgba(153,70,255,0.34)',
    borderColor: 'rgba(255,79,185,0.48)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  heroBadgeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  segmentWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(153,70,255,0.38)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    shadowColor: colors.purple,
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  segmentPressable: {
    flex: 1,
  },
  segmentButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
  },
  activeFreeSegment: {
    borderColor: 'rgba(69,224,255,0.5)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  activePaidSegment: {
    borderColor: 'rgba(244,180,94,0.54)',
    shadowColor: colors.goldSoft,
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '900',
  },
  activeSegmentText: {
    color: colors.text,
  },
  section: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.sm,
    position: 'relative',
  },
  freeSection: {
    borderColor: 'rgba(69,224,255,0.28)',
  },
  paidSection: {
    borderColor: 'rgba(244,180,94,0.3)',
  },
  sectionGlow: {
    borderRadius: 999,
    height: 140,
    position: 'absolute',
    right: -54,
    top: -66,
    width: 140,
  },
  freeSectionGlow: {
    backgroundColor: 'rgba(69,224,255,0.12)',
  },
  paidSectionGlow: {
    backgroundColor: 'rgba(244,180,94,0.15)',
  },
  sectionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  freeSectionIcon: {
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.32)',
  },
  paidSectionIcon: {
    backgroundColor: 'rgba(244,180,94,0.14)',
    borderColor: 'rgba(244,180,94,0.34)',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    flexShrink: 1,
  },
  sectionHint: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  roomPressable: {
    width: '48%',
  },
  roomCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 238,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  freeRoomCard: {
    borderColor: 'rgba(69,224,255,0.5)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  paidRoomCard: {
    borderColor: 'rgba(244,180,94,0.54)',
    shadowColor: colors.pink,
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  cardAccent: {
    bottom: 0,
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  freeCardAccent: {
    backgroundColor: colors.cyan,
  },
  paidCardAccent: {
    backgroundColor: colors.goldSoft,
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
  roomCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  roomName: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  roomCount: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  roomTag: {
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.32)',
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.cyan,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  miniRoomScene: {
    alignItems: 'center',
    height: 116,
    justifyContent: 'center',
    marginTop: 10,
    position: 'relative',
  },
  miniTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.74)',
    borderColor: 'rgba(174,111,255,0.68)',
    borderRadius: 27,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    shadowColor: colors.cyan,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    width: 54,
  },
  paidMiniTable: {
    backgroundColor: 'rgba(48,28,20,0.78)',
    borderColor: 'rgba(244,180,94,0.52)',
    shadowColor: colors.goldSoft,
  },
  miniSeat: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(126,135,217,0.42)',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
  },
  paidMiniSeat: {
    backgroundColor: 'rgba(244,180,94,0.08)',
    borderColor: 'rgba(244,180,94,0.34)',
  },
  filledMiniSeat: {
    backgroundColor: 'rgba(153,70,255,0.24)',
    borderColor: 'rgba(247,238,255,0.24)',
  },
  paidFilledMiniSeat: {
    backgroundColor: 'rgba(244,180,94,0.18)',
    borderColor: 'rgba(255,213,154,0.38)',
  },
  miniSeatTop: {
    top: 0,
  },
  miniSeatRight: {
    right: 0,
    top: 40,
  },
  miniSeatBottom: {
    bottom: 0,
  },
  miniSeatLeft: {
    left: 0,
    top: 40,
  },
  emptyMiniSeatText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  roomCardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  timePill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  timeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  priceText: {
    color: colors.goldSoft,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.14)',
    borderColor: 'rgba(126,135,255,0.7)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  paidInlineButton: {
    backgroundColor: 'rgba(244,180,94,0.13)',
    borderColor: 'rgba(255,79,185,0.42)',
  },
  disabledInlineButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inlineButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  closedCard: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
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
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
