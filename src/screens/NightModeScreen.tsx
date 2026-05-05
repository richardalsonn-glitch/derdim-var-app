import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { isDemoMode, isLiveKitEnabled } from '../config/features';
import { colors, radius, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { requestMicrophonePermission } from '../services/permissionsService';
import {
  decidePaidVoiceRoomRequest,
  expireVoiceRoom,
  fetchNightVoiceRooms,
  getCurrentUserId,
  joinVoiceRoomSeat,
  leaveVoiceRoom,
  removeVoiceRoomMember,
  renameVoiceRoom,
  requestPaidVoiceRoomJoin,
  setVoiceRoomMemberAudio,
} from '../services/voiceRoomService';
import { VoiceRoom, VoiceRoomMember } from '../types';
import { getNightModeSubtitle, isNightModeOpen, NIGHT_MODE_CLOSED_MESSAGE } from '../utils/nightMode';

type ModalState = {
  title: string;
  message: string;
};

function formatRemaining(ms: number, paid: boolean) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (paid) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getRoomRemainingMs(room: VoiceRoom, nowMs: number) {
  return room.expiresAt ? new Date(room.expiresAt).getTime() - nowMs : null;
}

function getRoomStateText(room: VoiceRoom) {
  if (room.currentCount >= room.capacity || room.status === 'full') {
    return 'Dolu';
  }

  if (room.status === 'active') {
    return 'Aktif';
  }

  return 'Açık';
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
  const glow = useRef(new Animated.Value(0.74)).current;
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nameEditorVisible, setNameEditorVisible] = useState(false);
  const [draftRoomName, setDraftRoomName] = useState('');
  const [lastPaidWarningKey, setLastPaidWarningKey] = useState<string | null>(null);
  const nightOpen = isDemoMode || isNightModeOpen();
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const currentMembership = selectedRoom?.members.find((member) => member.userId === currentUserId) ?? null;
  const isOwner = Boolean(selectedRoom?.ownerId && selectedRoom.ownerId === currentUserId);
  const firstFreeMember = selectedRoom?.members.slice().sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
  const canRenameSelectedRoom = Boolean(selectedRoom && (isOwner || (selectedRoom.pricingType === 'free' && firstFreeMember?.userId === currentUserId)));

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

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
      void loadRooms(true);
    }, 12000);

    return () => clearInterval(timer);
  }, [loadRooms]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.74, duration: 1200, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [glow]);

  useEffect(() => {
    if (!selectedRoom?.expiresAt) {
      return;
    }

    const remainingMs = getRoomRemainingMs(selectedRoom, nowMs);

    if (remainingMs === null) {
      return;
    }

    if (remainingMs <= 0) {
      void expireVoiceRoom(selectedRoom.id).then(() => {
        setSelectedRoomId(null);
        setModal({ title: 'Oda kapandı', message: 'Oda süresi doldu.' });
        void loadRooms(true);
      });
      return;
    }

    if (selectedRoom.pricingType !== 'paid') {
      return;
    }

    const warningKey = remainingMs <= 60000 ? `${selectedRoom.id}:one` : remainingMs <= 300000 ? `${selectedRoom.id}:five` : null;

    if (warningKey && warningKey !== lastPaidWarningKey) {
      setLastPaidWarningKey(warningKey);
      setModal({
        title: remainingMs <= 60000 ? 'Son 1 dakika' : 'Son 5 dakika',
        message: 'Oda yenileme mağaza içi satın alma ile yakında aktif olacak.',
      });

      if (remainingMs > 60000) {
        setTimeout(() => {
          setModal((current) => (current?.title === 'Son 5 dakika' ? null : current));
        }, 30000);
      }
    }
  }, [lastPaidWarningKey, loadRooms, nowMs, selectedRoom]);

  const freeRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'free'), [rooms]);
  const paidRooms = useMemo(() => rooms.filter((room) => room.pricingType === 'paid'), [rooms]);

  async function runRoomAction(action: () => Promise<{ data: true | null; error: { message: string } | null }>, successMessage?: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);

    if (result.error) {
      setModal({ title: 'İşlem tamamlanamadı', message: result.error.message });
      return false;
    }

    if (successMessage) {
      setModal({ title: 'Tamam', message: successMessage });
    }

    await loadRooms(true);
    return true;
  }

  async function handleJoinSeat(room: VoiceRoom, seatIndex: number) {
    if (!currentUserId) {
      setModal({ title: 'Giriş gerekli', message: 'Gece Modu odalarına katılmak için giriş yapman gerekiyor.' });
      return;
    }

    if (room.currentCount >= room.capacity) {
      setModal({ title: 'Oda dolu', message: 'Bu odada şu an boş koltuk yok.' });
      return;
    }

    await runRoomAction(() => joinVoiceRoomSeat(room.id, seatIndex));
    setSelectedRoomId(room.id);
  }

  async function handlePaidRequest(room: VoiceRoom) {
    if (!room.ownerId) {
      setModal({
        title: 'Ücretli Oda Aç',
        message: '79.99 TL ücretli oda açma ve mağaza içi satın alma yakında aktif olacak. Plus üyeler için aylık 2, VIP üyeler için aylık 3 ücretsiz hak alanı hazırlandı.',
      });
      return;
    }

    await runRoomAction(() => requestPaidVoiceRoomJoin(room.id), 'İsteğin oda sahibine gönderildi.');
  }

  async function handleToggleAudio(member: VoiceRoomMember) {
    if (!selectedRoom) {
      return;
    }

    if (isLiveKitEnabled && !member.micEnabled) {
      const result = await requestMicrophonePermission();

      if (!result.granted) {
        setModal({ title: 'Mikrofon izni gerekli', message: 'Mikrofonu açmak için izin vermen gerekiyor.' });
        return;
      }
    }

    await runRoomAction(() => setVoiceRoomMemberAudio(selectedRoom.id, member.userId, !member.micEnabled, !member.speakerEnabled));
  }

  async function handleRename() {
    if (!selectedRoom) {
      return;
    }

    const name = draftRoomName.trim() || 'Şu anda bu oda müsaittir';
    const success = await runRoomAction(() => renameVoiceRoom(selectedRoom.id, name));

    if (success) {
      setNameEditorVisible(false);
    }
  }

  function renderRoomCard(room: VoiceRoom) {
    const remainingMs = getRoomRemainingMs(room, nowMs);
    const remainingText = remainingMs === null ? 'Süre bekliyor' : formatRemaining(remainingMs, room.pricingType === 'paid');
    const isFull = room.currentCount >= room.capacity || room.status === 'full';
    const isMember = room.members.some((member) => member.userId === currentUserId);
    const hasPendingRequest = room.requests.some((request) => request.requesterId === currentUserId && request.status === 'pending');
    const buttonTitle =
      room.pricingType === 'free'
        ? isFull && !isMember
          ? 'Dolu'
          : isMember
            ? 'Odaya Gir'
            : 'Otur'
        : isFull && !isMember
          ? 'Dolu'
          : isMember
            ? 'Odaya Gir'
            : hasPendingRequest
              ? 'İstek Gönderildi'
              : room.ownerId
                ? 'İstek Gönder'
                : 'Ücretli Oda Aç';

    return (
      <GlassCard key={room.id} style={styles.roomCard}>
        <View style={styles.roomHeaderRow}>
          <View style={styles.roomTitleBlock}>
            <Text style={styles.roomName}>{room.name}</Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, room.pricingType === 'paid' && styles.goldBadge]}>{room.pricingType === 'paid' ? 'Ücretli' : 'Ücretsiz'}</Text>
              <Text style={styles.badge}>{getRoomStateText(room)}</Text>
            </View>
          </View>
          <Text style={styles.countText}>{room.currentCount}/{room.capacity}</Text>
        </View>

        <View style={styles.roomMetaRow}>
          <Ionicons color={colors.cyan} name="time" size={15} />
          <Text style={styles.roomMetaText}>{remainingText}</Text>
          <Ionicons color={colors.muted} name={room.ownerId ? 'person' : 'ellipse-outline'} size={15} />
          <Text style={styles.roomMetaText}>{room.ownerId ? 'Sahipli oda' : 'Boş oda'}</Text>
        </View>

        <GradientButton
          compact
          disabled={busy || hasPendingRequest || (isFull && !isMember)}
          icon={room.pricingType === 'paid' && !isMember ? 'mail' : 'enter'}
          onPress={() => {
            if (isMember) {
              setSelectedRoomId(room.id);
              return;
            }

            if (room.pricingType === 'paid') {
              void handlePaidRequest(room);
              return;
            }

            const seat = getFreeSeat(room);
            if (seat === null) {
              setModal({ title: 'Oda dolu', message: 'Bu odada şu an boş koltuk yok.' });
              return;
            }

            setSelectedRoomId(room.id);
          }}
          title={buttonTitle}
          variant={room.pricingType === 'paid' ? 'gold' : 'secondary'}
        />
      </GlassCard>
    );
  }

  function renderLobby() {
    return (
      <>
        <GlassCard style={styles.banner}>
          <Text style={styles.bannerTitle}>4 kişilik gerçek odalar</Text>
          <Text style={styles.bannerText}>Boş koltuklar boş görünür. Oda dolana kadar ücretsiz odalarda mikrofon ve hoparlör kapalı kalır.</Text>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ücretsiz Odalar</Text>
          <Text style={styles.sectionMeta}>5 oda</Text>
        </View>
        {freeRooms.map(renderRoomCard)}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ücretli Odalar</Text>
          <Text style={styles.sectionMeta}>79.99 TL placeholder</Text>
        </View>
        {paidRooms.map(renderRoomCard)}
      </>
    );
  }

  function renderSeat(room: VoiceRoom, seatIndex: number) {
    const member = room.members.find((item) => item.seatIndex === seatIndex);
    const isSpeaker = Boolean(member?.micEnabled || member?.speakerEnabled);

    if (!member) {
      return (
        <Pressable
          key={seatIndex}
          disabled={busy || room.pricingType === 'paid'}
          onPress={() => void handleJoinSeat(room, seatIndex)}
          style={[styles.seatCard, styles.emptySeat, room.pricingType === 'paid' && styles.disabledSeat]}
        >
          <Ionicons color={colors.dim} name="add-circle-outline" size={26} />
          <Text style={styles.emptySeatText}>Boş</Text>
        </Pressable>
      );
    }

    return (
      <Animated.View key={seatIndex} style={[styles.seatCard, isSpeaker && { opacity: glow }, isSpeaker && styles.speakingSeat]}>
        <Avatar avatar={getAvatarById(member.avatarId)} size={66} />
        <Text numberOfLines={1} style={styles.memberName}>{member.username}</Text>
        <View style={styles.audioRow}>
          <Ionicons color={member.micEnabled ? colors.cyan : colors.dim} name={member.micEnabled ? 'mic' : 'mic-off'} size={14} />
          <Ionicons color={member.speakerEnabled ? colors.green : colors.dim} name={member.speakerEnabled ? 'volume-high' : 'volume-mute'} size={14} />
        </View>
        {isOwner && member.userId !== currentUserId ? (
          <View style={styles.ownerControls}>
            <Pressable onPress={() => void handleToggleAudio(member)} style={styles.iconButton}>
              <Ionicons color={colors.text} name="options" size={15} />
            </Pressable>
            <Pressable onPress={() => void runRoomAction(() => removeVoiceRoomMember(room.id, member.userId))} style={styles.iconButton}>
              <Ionicons color={colors.danger} name="close" size={15} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  function renderSelectedRoom(room: VoiceRoom) {
    const remainingMs = getRoomRemainingMs(room, nowMs);
    const isFreeWaiting = room.pricingType === 'free' && room.currentCount < room.capacity;
    const timerText = remainingMs === null ? (room.pricingType === 'paid' ? '3:00:00' : '30:00') : formatRemaining(remainingMs, room.pricingType === 'paid');

    return (
      <>
        <GlassCard style={styles.roomDetailHeader}>
          <View style={styles.roomHeaderRow}>
            <View style={styles.roomTitleBlock}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomMetaText}>{room.pricingType === 'paid' ? 'Ücretli oda' : 'Ücretsiz oda'} • {room.currentCount}/{room.capacity}</Text>
            </View>
            <Text style={styles.timerText}>{timerText}</Text>
          </View>
          <View style={styles.detailActions}>
            {canRenameSelectedRoom ? (
              <GradientButton
                compact
                icon="create"
                onPress={() => {
                  setDraftRoomName(room.name);
                  setNameEditorVisible(true);
                }}
                title="Oda Adı"
                variant="ghost"
              />
            ) : null}
            {currentMembership ? (
              <GradientButton compact icon="exit" onPress={() => void runRoomAction(() => leaveVoiceRoom(room.id)).then(() => setSelectedRoomId(null))} title="Çık" variant="ghost" />
            ) : null}
          </View>
        </GlassCard>

        {isFreeWaiting ? (
          <GlassCard style={styles.waitingCard}>
            <Ionicons color={colors.goldSoft} name="lock-closed" size={18} />
            <Text style={styles.waitingText}>4 kişi tamamlanınca konuşma başlayacak.</Text>
          </GlassCard>
        ) : null}

        <View style={styles.seatGrid}>
          {Array.from({ length: room.capacity }).map((_, index) => renderSeat(room, index))}
        </View>

        {isOwner && room.requests.length > 0 ? (
          <GlassCard style={styles.requestsCard}>
            <Text style={styles.sectionTitle}>İstek Listesi</Text>
            {room.requests.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.requestUser}>
                  <Avatar avatar={getAvatarById(request.requesterAvatarId)} size={38} />
                  <Text style={styles.requestName}>{request.requesterUsername}</Text>
                </View>
                <View style={styles.requestActions}>
                  <Pressable onPress={() => void runRoomAction(() => decidePaidVoiceRoomRequest(request.id, true))} style={styles.iconButton}>
                    <Ionicons color={colors.green} name="checkmark" size={16} />
                  </Pressable>
                  <Pressable onPress={() => void runRoomAction(() => decidePaidVoiceRoomRequest(request.id, false))} style={styles.iconButton}>
                    <Ionicons color={colors.danger} name="close" size={16} />
                  </Pressable>
                </View>
              </View>
            ))}
          </GlassCard>
        ) : null}

        {room.pricingType === 'paid' ? (
          <GlassCard style={styles.waitingCard}>
            <Ionicons color={colors.goldSoft} name="card" size={18} />
            <Text style={styles.waitingText}>Oda yenileme mağaza içi satın alma ile yakında aktif olacak.</Text>
          </GlassCard>
        ) : null}
      </>
    );
  }

  return (
    <PremiumScreen>
      <ScreenHeader
        onBack={() => {
          if (selectedRoom) {
            setSelectedRoomId(null);
            return;
          }

          navigation.goBack();
        }}
        subtitle={getNightModeSubtitle(isDemoMode)}
        title={selectedRoom ? 'Gece Modu Odası' : 'Gece Modu'}
      />

      {!nightOpen ? (
        <GlassCard style={styles.closedCard}>
          <Ionicons color={colors.goldSoft} name="moon" size={28} />
          <Text style={styles.closedText}>{NIGHT_MODE_CLOSED_MESSAGE}</Text>
        </GlassCard>
      ) : loading ? (
        <GlassCard style={styles.loadingCard}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.bannerText}>Odalar hazırlanıyor...</Text>
        </GlassCard>
      ) : selectedRoom ? (
        renderSelectedRoom(selectedRoom)
      ) : (
        renderLobby()
      )}

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setModal(null), variant: 'secondary' }]}
        message={modal?.message ?? ''}
        onClose={() => setModal(null)}
        title={modal?.title ?? ''}
        visible={Boolean(modal)}
      />

      <NoticeModal
        actions={[
          { label: 'Kaydet', onPress: handleRename },
          { label: 'Vazgeç', onPress: () => setNameEditorVisible(false), variant: 'ghost' },
        ]}
        message="Oda adı en fazla 48 karakter olabilir."
        onClose={() => setNameEditorVisible(false)}
        title="Oda Adı"
        visible={nameEditorVisible}
      >
        <TextInput
          maxLength={48}
          onChangeText={setDraftRoomName}
          placeholder="Oda adı"
          placeholderTextColor={colors.dim}
          style={styles.nameInput}
          value={draftRoomName}
        />
      </NoticeModal>
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 6,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bannerText: {
    color: colors.muted,
    lineHeight: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  roomCard: {
    gap: spacing.sm,
  },
  roomHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  roomTitleBlock: {
    flex: 1,
    gap: 8,
  },
  roomName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(69, 224, 255, 0.12)',
    borderColor: 'rgba(69, 224, 255, 0.22)',
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  goldBadge: {
    backgroundColor: 'rgba(244, 180, 94, 0.14)',
    borderColor: 'rgba(244, 180, 94, 0.3)',
    color: colors.goldSoft,
  },
  countText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  roomMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  roomMetaText: {
    color: colors.muted,
    fontSize: 12,
  },
  roomDetailHeader: {
    gap: spacing.md,
  },
  detailActions: {
    gap: spacing.sm,
  },
  timerText: {
    color: colors.goldSoft,
    fontSize: 18,
    fontWeight: '900',
  },
  waitingCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  waitingText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  seatCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 7,
    minHeight: 178,
    padding: spacing.sm,
    width: '48%',
  },
  emptySeat: {
    justifyContent: 'center',
  },
  disabledSeat: {
    opacity: 0.58,
  },
  emptySeatText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '800',
  },
  speakingSeat: {
    borderColor: 'rgba(69, 224, 255, 0.55)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    maxWidth: '100%',
  },
  audioRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ownerControls: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  requestsCard: {
    gap: spacing.sm,
  },
  requestRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  requestUser: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestName: {
    color: colors.text,
    fontWeight: '800',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
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
  nameInput: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
