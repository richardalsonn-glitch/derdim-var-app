import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoticeModal } from '../components/NoticeModal';
import { UserAvatar } from '../components/UserAvatar';
import { isDemoMode } from '../config/features';
import { colors, radius } from '../constants/theme';
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
import { getScreenLayout } from '../utils/responsive';

const nightRoomBackground = require('../../assets/images/night-room-background.png');

type ModalState = {
  title: string;
  message: string;
};

type RoomType = 'free' | 'paid';

type Scale = {
  tiny: boolean;
  compact: boolean;
  pad: number;
  gap: number;
  headerTitle: number;
  cardHeight: number;
  cardPad: number;
  sceneHeight: number;
  tableSize: number;
  seatSize: number;
  sideSeatSize: number;
  avatarSize: number;
  buttonHeight: number;
  ctaHeight: number;
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

function getRoomDisplayName(room: VoiceRoom) {
  const name = room.name?.trim();

  if (!name || name === 'Şu anda bu oda müsaittir' || name === 'Şu anda müsait') {
    return 'Oda Müsait';
  }

  return name;
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
        colors={['rgba(3,5,18,0.15)', 'rgba(4,5,20,0.34)', 'rgba(4,5,18,0.62)']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </ImageBackground>
  );
}

export function NightModeScreen({ navigation }: AppScreenProps<'NightMode'>) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenLayout = getScreenLayout({ width, height }, insets);
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('free');
  const nightOpen = isDemoMode || isNightModeOpen();

  const scale: Scale = useMemo(() => {
    const usableHeight = height - screenLayout.contentTopPadding - screenLayout.contentBottomPadding;
    const tiny = usableHeight < 680;
    const screen = screenLayout;
    const compact = screen.isCompactPhone || height <= 844;
    const reserved = tiny ? 302 : compact ? 322 : 344;
    const cardHeight = Math.max(178, Math.min(tiny ? 196 : compact ? 232 : 268, Math.floor((usableHeight - reserved) / 2)));

    return {
      tiny,
      compact,
      pad: screenLayout.horizontalPadding,
      gap: tiny ? 4 : compact ? 5 : 6,
      headerTitle: tiny ? 28 : compact ? 33 : 38,
      cardHeight,
      cardPad: tiny ? 8 : compact ? 9 : 10,
      sceneHeight: Math.max(tiny ? 70 : compact ? 90 : 100, Math.min(tiny ? 84 : compact ? 110 : 128, cardHeight - (tiny ? 106 : 140))),
      tableSize: tiny ? 34 : compact ? 40 : 46,
      seatSize: tiny ? 36 : compact ? 40 : 44,
      sideSeatSize: tiny ? 36 : compact ? 40 : 42,
      avatarSize: tiny ? 23 : compact ? 26 : 29,
      buttonHeight: tiny ? 28 : compact ? 31 : 33,
      ctaHeight: tiny ? 54 : compact ? 60 : 64,
    };
  }, [height, screenLayout, width]);

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

  useFocusEffect(
    useCallback(() => {
      void loadRooms(true);
    }, [loadRooms]),
  );

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
  const roomCardWidth = (Math.min(width, screenLayout.contentMaxWidth) - scale.pad * 2 - scale.gap) / 2;

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
    const isCurrentUser = Boolean(member?.userId && member.userId === currentUserId);
    const username = isCurrentUser ? 'Sen' : member?.username?.trim() || '';
    const topSeatSize = scale.seatSize;
    const sideSeatSize = scale.sideSeatSize;
    const sideTop = (scale.sceneHeight - sideSeatSize) / 2;
    const horizontalInset = scale.tiny ? 2 : 4;
    const seatPositionStyle = [
      { left: '50%' as const, marginLeft: -topSeatSize / 2, top: 0, height: topSeatSize, width: topSeatSize },
      { right: horizontalInset, top: sideTop, height: sideSeatSize, width: sideSeatSize },
      { bottom: 0, left: '50%' as const, marginLeft: -topSeatSize / 2, height: topSeatSize, width: topSeatSize },
      { left: horizontalInset, top: sideTop, height: sideSeatSize, width: sideSeatSize },
    ][seatIndex];

    return (
      <View
        key={seatIndex}
        style={[
          styles.miniSeat,
          { borderRadius: Math.max(topSeatSize, sideSeatSize) / 2 },
          isPaid && styles.paidMiniSeat,
          seatPositionStyle,
          member && styles.filledMiniSeat,
          member && isPaid && styles.paidFilledMiniSeat,
        ]}
      >
        {member ? (
          <>
            <UserAvatar
              avatarId={member.avatarId}
              avatarSourceType="peer-profile"
              currentUserId={currentUserId}
              renderedUserId={member?.userId ?? null}
              screen="night-mode"
              size={scale.avatarSize}
              username={username || undefined}
            />
            <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.filledSeatName, { fontSize: scale.tiny ? 7 : 8 }]}>
              {username}
            </Text>
          </>
        ) : (
          <Text style={[styles.emptyMiniSeatText, { fontSize: scale.tiny ? 9 : 10 }]}>Boş</Text>
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
      <View key={room.id} style={[styles.roomPressable, { width: roomCardWidth }]}>
        <LinearGradient
          colors={
            isPaid
              ? ['rgba(244,180,94,0.19)', 'rgba(255,79,185,0.13)', 'rgba(7,12,38,0.88)']
              : ['rgba(42,166,255,0.22)', 'rgba(88,54,214,0.13)', 'rgba(7,12,38,0.9)']
          }
          style={[
            styles.roomCard,
            {
              height: scale.cardHeight,
              padding: scale.cardPad,
            },
            isPaid ? styles.paidRoomCard : styles.freeRoomCard,
            isFull && styles.fullRoomCard,
          ]}
        >
          <View pointerEvents="none" style={[styles.starDust, isPaid && styles.paidStarDust]} />
          <View pointerEvents="none" style={[styles.cardAccent, isPaid ? styles.paidCardAccent : styles.freeCardAccent]} />

          <View style={styles.roomCardHeader}>
            <Text numberOfLines={1} style={[styles.roomName, { fontSize: scale.tiny ? 12 : scale.compact ? 13 : 14 }]}>
              {getRoomDisplayName(room)}
            </Text>
            <Text style={[styles.roomCount, { fontSize: scale.tiny ? 16 : 18 }]}>{room.currentCount}/{room.capacity}</Text>
          </View>

          <View style={[styles.tagRow, { marginTop: scale.tiny ? 4 : 6 }]}>
            <Text style={[styles.roomTag, isPaid && styles.paidTag]}>{isPaid ? 'Ücretli' : 'Ücretsiz'}</Text>
            <Text style={[styles.roomTag, isPaid && styles.paidTag, isFull && styles.fullTag]}>{getRoomStateText(room)}</Text>
          </View>

          <View style={[styles.miniRoomScene, { height: scale.sceneHeight, marginTop: scale.tiny ? 4 : 6 }]}>
            <View pointerEvents="none" style={[styles.orbit, isPaid && styles.paidOrbit]} />
            <View
              style={[
                styles.miniTable,
                {
                  borderRadius: scale.tableSize / 2,
                  height: scale.tableSize,
                  width: scale.tableSize,
                },
                isPaid && styles.paidMiniTable,
              ]}
            >
              <Ionicons color={isPaid ? colors.goldSoft : colors.cyan} name="moon" size={scale.tiny ? 20 : scale.compact ? 23 : 25} />
            </View>
            {Array.from({ length: room.capacity }).map((_, index) => renderMiniSeat(room, index, isPaid))}
          </View>

          <View style={[styles.roomCardFooter, { marginTop: scale.tiny ? 3 : 4 }]}>
            <View style={styles.timePill}>
              <Ionicons color="#BFC4F6" name="time-outline" size={scale.tiny ? 12 : 14} />
              <Text style={[styles.timeText, { fontSize: scale.tiny ? 10 : 12 }]}>{formatShortTime(room, nowMs)}</Text>
            </View>
            {isPaid ? <Text style={[styles.priceText, { fontSize: scale.tiny ? 9 : 10 }]}>79,99 TL / oda</Text> : null}
          </View>

          <Pressable
            disabled={busyRoomId === room.id || hasPendingRequest || (isFull && !isMember)}
            onPress={() => void handleRoomPress(room)}
          >
            <LinearGradient
              colors={isPaid ? ['rgba(255,209,128,0.32)', 'rgba(96,48,126,0.5)'] : ['rgba(56,170,255,0.38)', 'rgba(28,72,165,0.56)']}
              style={[
                styles.inlineButton,
                {
                  height: scale.buttonHeight,
                  marginTop: scale.tiny ? 4 : 6,
                },
                isPaid && styles.paidInlineButton,
                (isFull && !isMember) && styles.disabledInlineButton,
              ]}
            >
              {busyRoomId === room.id ? <ActivityIndicator color={colors.text} size="small" /> : <Text style={styles.inlineButtonText}>{buttonTitle}</Text>}
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  function renderRoomTypeSegment() {
    return (
      <View style={[styles.segmentWrap, { height: scale.tiny ? 38 : scale.compact ? 42 : 44 }]}>
        <Pressable onPress={() => setSelectedRoomType('free')} style={styles.segmentPressable}>
          <LinearGradient
            colors={selectedRoomType === 'free' ? ['rgba(53,124,255,0.84)', 'rgba(38,226,255,0.26)'] : ['rgba(255,255,255,0.035)', 'rgba(255,255,255,0.012)']}
            style={[styles.segmentButton, selectedRoomType === 'free' && styles.activeFreeSegment]}
          >
            <Ionicons color={selectedRoomType === 'free' ? '#78E8FF' : colors.muted} name="moon" size={scale.tiny ? 18 : 21} />
            <Text style={[styles.segmentText, { fontSize: scale.tiny ? 15 : 17 }, selectedRoomType === 'free' && styles.activeFreeSegmentText]}>Ücretsiz</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => setSelectedRoomType('paid')} style={styles.segmentPressable}>
          <LinearGradient
            colors={selectedRoomType === 'paid' ? ['rgba(244,180,94,0.45)', 'rgba(255,79,185,0.25)'] : ['rgba(255,255,255,0.025)', 'rgba(255,255,255,0.01)']}
            style={[styles.segmentButton, selectedRoomType === 'paid' && styles.activePaidSegment]}
          >
            <Ionicons color={selectedRoomType === 'paid' ? colors.goldSoft : '#D9B977'} name="sparkles" size={scale.tiny ? 18 : 21} />
            <Text style={[styles.segmentText, styles.paidSegmentText, { fontSize: scale.tiny ? 15 : 17 }, selectedRoomType === 'paid' && styles.activeSegmentText]}>Ücretli</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  function renderUpgradeCard() {
    const paid = selectedRoomType === 'paid';

    return (
      <LinearGradient
        colors={paid ? ['rgba(69,224,255,0.13)', 'rgba(47,81,160,0.16)', 'rgba(9,12,34,0.82)'] : ['rgba(244,180,94,0.18)', 'rgba(255,79,185,0.1)', 'rgba(9,12,34,0.82)']}
        style={[styles.upgradeCard, { height: scale.ctaHeight, padding: scale.tiny ? 8 : 10 }, paid && styles.freeReturnCard]}
      >
        <View style={[styles.upgradeIcon, { height: scale.tiny ? 40 : 48, width: scale.tiny ? 40 : 48 }, paid && styles.freeReturnIcon]}>
          <Ionicons color={paid ? colors.cyan : colors.goldSoft} name={paid ? 'moon' : 'sparkles'} size={scale.tiny ? 21 : 25} />
        </View>
        <View style={styles.upgradeCopy}>
          <Text numberOfLines={1} style={[styles.upgradeTitle, paid && styles.freeReturnTitle, { fontSize: scale.tiny ? 14 : 16 }]}>
            {paid ? 'Ücretsiz odalara dön' : 'Ücretli odalara geç'}
          </Text>
          <Text numberOfLines={scale.tiny ? 1 : 2} style={[styles.upgradeText, { fontSize: scale.tiny ? 9 : 11 }]}>
            {paid ? 'Hızlı, açık ve ücretsiz gece masalarına geri dön.' : 'Daha özel masalar, öncelikli eşleşme ve rozet ayrıcalıkları seni bekliyor.'}
          </Text>
        </View>
        <Pressable onPress={() => setSelectedRoomType(paid ? 'free' : 'paid')} style={styles.upgradeButtonPressable}>
          <LinearGradient
            colors={paid ? ['rgba(69,224,255,0.18)', 'rgba(35,84,176,0.4)'] : ['rgba(255,214,139,0.18)', 'rgba(95,60,40,0.46)']}
            style={[styles.upgradeButton, paid && styles.freeReturnButton]}
          >
            <Text numberOfLines={1} style={[styles.upgradeButtonText, paid && styles.freeReturnButtonText]}>
              {paid ? 'Ücretsiz odalar' : 'Ücretli odaları keşfet'}
            </Text>
            <Ionicons color={paid ? colors.cyan : colors.goldSoft} name="chevron-forward" size={18} />
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <NightBackground>
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View style={[styles.content, { gap: scale.gap, paddingBottom: screenLayout.contentBottomPadding, paddingHorizontal: scale.pad, paddingTop: screenLayout.contentTopPadding }]}>
          <View style={[styles.header, { minHeight: scale.tiny ? 46 : scale.compact ? 52 : 56 }]}>
            <Pressable onPress={() => navigation.goBack()} style={[styles.backButton, { height: scale.tiny ? 44 : 50, width: scale.tiny ? 44 : 50 }]}>
              <Ionicons color={colors.text} name="chevron-back" size={scale.tiny ? 27 : 31} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerTitle, { fontSize: scale.headerTitle }]}>Gece Modu</Text>
              <Text style={[styles.headerSubtitle, { fontSize: scale.tiny ? 12 : 15 }]}>22:00 - 06:00 • Türkiye saati</Text>
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
              <LinearGradient
                colors={['rgba(255,255,255,0.09)', 'rgba(153,70,255,0.09)', 'rgba(8,11,32,0.82)']}
                style={[styles.heroCard, { minHeight: scale.tiny ? 50 : scale.compact ? 56 : 60, padding: scale.tiny ? 6 : 8 }]}
              >
                <View style={[styles.heroIcon, { height: scale.tiny ? 40 : 46, width: scale.tiny ? 40 : 46 }]}>
                  <Ionicons color={colors.goldSoft} name="moon" size={scale.tiny ? 23 : 27} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroTitle, { fontSize: scale.tiny ? 16 : 19 }]}>Gece odaları</Text>
                  <Text numberOfLines={1} style={[styles.heroText, { fontSize: scale.tiny ? 11 : 13 }]}>Bir oda seç ve masaya otur.</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={[styles.heroBadgeText, { fontSize: scale.tiny ? 13 : 15 }]}>8 oda</Text>
                </View>
              </LinearGradient>

              {renderRoomTypeSegment()}

              <View style={styles.sectionMetaRow}>
                <View style={styles.sectionTitleWrap}>
                  <View style={[styles.sectionIcon, selectedIsPaid ? styles.paidSectionIcon : styles.freeSectionIcon]}>
                    <Ionicons color={selectedIsPaid ? colors.goldSoft : colors.cyan} name={selectedIsPaid ? 'sparkles' : 'moon'} size={scale.tiny ? 16 : 18} />
                  </View>
                  <Text style={[styles.sectionTitle, { fontSize: scale.tiny ? 17 : 20 }]}>{selectedSectionTitle}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.sectionHint, { fontSize: scale.tiny ? 10 : 12 }]}>{selectedSectionHint}</Text>
              </View>

              <View style={[styles.roomGrid, { rowGap: scale.gap, columnGap: scale.gap }]}>
                {visibleRooms.map(renderRoomCard)}
              </View>

              {renderUpgradeCard()}
            </>
          )}
        </View>
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
    backgroundColor: colors.backgroundDeep,
  },
  backgroundDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,4,16,0.2)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 720,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(23,17,56,0.7)',
    borderColor: 'rgba(174,92,255,0.72)',
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.65,
    shadowRadius: 18,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowRadius: 8,
  },
  headerSubtitle: {
    color: '#B9A8FF',
    fontWeight: '800',
    marginTop: 1,
  },
  heroCard: {
    alignItems: 'center',
    borderColor: 'rgba(174,92,255,0.62)',
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(93,50,177,0.35)',
    borderColor: 'rgba(174,92,255,0.55)',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.text,
    fontWeight: '900',
  },
  heroText: {
    color: '#C7C0E7',
    fontWeight: '700',
    marginTop: 2,
  },
  heroBadge: {
    backgroundColor: 'rgba(92,44,174,0.58)',
    borderColor: 'rgba(203,84,255,0.62)',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  segmentWrap: {
    backgroundColor: 'rgba(10,11,31,0.78)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 3,
  },
  segmentPressable: {
    flex: 1,
  },
  segmentButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
  },
  activeFreeSegment: {
    borderColor: 'rgba(82,208,255,0.95)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 18,
  },
  activePaidSegment: {
    borderColor: 'rgba(255,218,138,0.82)',
    shadowColor: colors.goldSoft,
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '900',
  },
  paidSegmentText: {
    color: colors.goldSoft,
  },
  activeFreeSegmentText: {
    color: colors.text,
    textShadowColor: 'rgba(69,224,255,0.7)',
    textShadowRadius: 12,
  },
  activeSegmentText: {
    color: colors.text,
  },
  sectionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 9,
    minWidth: 0,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  freeSectionIcon: {
    backgroundColor: 'rgba(69,224,255,0.16)',
    borderColor: 'rgba(69,224,255,0.52)',
  },
  paidSectionIcon: {
    backgroundColor: 'rgba(244,180,94,0.16)',
    borderColor: 'rgba(244,180,94,0.5)',
  },
  sectionTitle: {
    color: colors.text,
    flexShrink: 1,
    fontWeight: '900',
  },
  sectionHint: {
    color: '#BEB9DF',
    flex: 1,
    fontWeight: '700',
    textAlign: 'right',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roomPressable: {
    flexShrink: 0,
  },
  roomCard: {
    borderRadius: 17,
    borderWidth: 1.4,
    overflow: 'hidden',
  },
  freeRoomCard: {
    borderColor: 'rgba(51,169,255,0.82)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.32,
    shadowRadius: 16,
  },
  paidRoomCard: {
    borderColor: 'rgba(255,204,125,0.78)',
    shadowColor: colors.pink,
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  fullRoomCard: {
    opacity: 0.72,
  },
  starDust: {
    backgroundColor: 'rgba(88,56,195,0.18)',
    borderRadius: 80,
    height: 116,
    position: 'absolute',
    right: -44,
    top: 54,
    width: 116,
  },
  paidStarDust: {
    backgroundColor: 'rgba(255,79,185,0.12)',
  },
  cardAccent: {
    bottom: 0,
    height: 2,
    left: 20,
    position: 'absolute',
    right: 20,
  },
  freeCardAccent: {
    backgroundColor: 'rgba(69,224,255,0.9)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.75,
    shadowRadius: 9,
  },
  paidCardAccent: {
    backgroundColor: 'rgba(255,218,138,0.95)',
    shadowColor: colors.goldSoft,
    shadowOpacity: 0.7,
    shadowRadius: 9,
  },
  roomCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'space-between',
  },
  roomName: {
    color: colors.text,
    flex: 1,
    fontWeight: '900',
  },
  roomCount: {
    color: colors.text,
    fontWeight: '900',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roomTag: {
    backgroundColor: 'rgba(38,145,217,0.23)',
    borderColor: 'rgba(69,224,255,0.48)',
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  paidTag: {
    backgroundColor: 'rgba(244,180,94,0.15)',
    borderColor: 'rgba(244,180,94,0.44)',
    color: colors.goldSoft,
  },
  fullTag: {
    backgroundColor: 'rgba(255,124,156,0.14)',
    borderColor: 'rgba(255,124,156,0.35)',
    color: colors.danger,
  },
  miniRoomScene: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbit: {
    borderColor: 'rgba(123,75,245,0.62)',
    borderRadius: 70,
    borderWidth: 1.2,
    height: '76%',
    position: 'absolute',
    width: '54%',
  },
  paidOrbit: {
    borderColor: 'rgba(244,180,94,0.42)',
  },
  miniTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,17,54,0.9)',
    borderColor: 'rgba(69,224,255,0.72)',
    borderWidth: 1.4,
    justifyContent: 'center',
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 13,
  },
  paidMiniTable: {
    backgroundColor: 'rgba(48,28,24,0.86)',
    borderColor: 'rgba(244,180,94,0.68)',
    shadowColor: colors.goldSoft,
  },
  miniSeat: {
    alignItems: 'center',
    backgroundColor: 'rgba(57,42,116,0.86)',
    borderColor: 'rgba(132,94,255,0.58)',
    borderWidth: 1.3,
    justifyContent: 'center',
    position: 'absolute',
  },
  paidMiniSeat: {
    backgroundColor: 'rgba(80,48,64,0.86)',
    borderColor: 'rgba(255,181,113,0.52)',
  },
  filledMiniSeat: {
    backgroundColor: 'rgba(186,67,255,0.38)',
    borderColor: 'rgba(255,99,241,0.95)',
    shadowColor: colors.pink,
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  paidFilledMiniSeat: {
    backgroundColor: 'rgba(244,180,94,0.24)',
    borderColor: 'rgba(255,213,154,0.88)',
  },
  emptyMiniSeatText: {
    color: '#D6D2F0',
    fontWeight: '800',
  },
  filledSeatName: {
    color: colors.text,
    fontWeight: '900',
    marginTop: 1,
    maxWidth: '92%',
    textAlign: 'center',
  },
  roomCardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
  },
  timePill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  timeText: {
    color: '#C5C7F4',
    fontWeight: '800',
  },
  priceText: {
    color: colors.goldSoft,
    flexShrink: 1,
    fontWeight: '900',
    textAlign: 'right',
  },
  inlineButton: {
    alignItems: 'center',
    borderColor: 'rgba(99,189,255,0.9)',
    borderRadius: radius.pill,
    borderWidth: 1.3,
    justifyContent: 'center',
    shadowColor: colors.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  paidInlineButton: {
    borderColor: 'rgba(255,202,128,0.78)',
    shadowColor: colors.goldSoft,
  },
  disabledInlineButton: {
    opacity: 0.62,
  },
  inlineButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  upgradeCard: {
    alignItems: 'center',
    borderColor: 'rgba(255,218,138,0.58)',
    borderRadius: 22,
    borderWidth: 1.3,
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
    shadowColor: colors.goldSoft,
    shadowOpacity: 0.26,
    shadowRadius: 16,
  },
  freeReturnCard: {
    borderColor: 'rgba(69,224,255,0.44)',
    shadowColor: colors.cyan,
  },
  upgradeIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(244,180,94,0.13)',
    borderColor: 'rgba(255,218,138,0.55)',
    borderRadius: radius.pill,
    borderWidth: 1.4,
    justifyContent: 'center',
  },
  freeReturnIcon: {
    backgroundColor: 'rgba(69,224,255,0.1)',
    borderColor: 'rgba(69,224,255,0.45)',
  },
  upgradeCopy: {
    flex: 1,
    minWidth: 0,
  },
  upgradeTitle: {
    color: colors.goldSoft,
    fontWeight: '900',
  },
  freeReturnTitle: {
    color: colors.cyan,
  },
  upgradeText: {
    color: '#C9C3D6',
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 1,
  },
  upgradeButtonPressable: {
    flexShrink: 0,
    maxWidth: '42%',
  },
  upgradeButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,218,138,0.62)',
    borderRadius: radius.pill,
    borderWidth: 1.2,
    flexDirection: 'row',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  freeReturnButton: {
    borderColor: 'rgba(69,224,255,0.52)',
  },
  upgradeButtonText: {
    color: colors.goldSoft,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  freeReturnButtonText: {
    color: colors.cyan,
  },
  closedCard: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 24,
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
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: colors.muted,
    lineHeight: 20,
  },
});
