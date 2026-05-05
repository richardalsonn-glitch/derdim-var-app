import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { isLiveKitEnabled } from '../config/features';
import { colors, gradients, radius, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { requestMicrophonePermission } from '../services/permissionsService';
import {
  decidePaidVoiceRoomRequest,
  expireVoiceRoom,
  fetchNightVoiceRoom,
  getCurrentUserId,
  joinVoiceRoomSeat,
  leaveVoiceRoom,
  removeVoiceRoomMember,
  renameVoiceRoom,
  setVoiceRoomMemberAudio,
  subscribeToNightVoiceRoom,
} from '../services/voiceRoomService';
import { VoiceRoom, VoiceRoomMember } from '../types';

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

function getFreeSeat(room: VoiceRoom) {
  for (let seatIndex = 0; seatIndex < room.capacity; seatIndex += 1) {
    if (!room.members.some((member) => member.seatIndex === seatIndex)) {
      return seatIndex;
    }
  }

  return null;
}

export function NightRoomScreen({ navigation, route }: AppScreenProps<'NightRoom'>) {
  const { roomId } = route.params;
  const glow = useRef(new Animated.Value(0.72)).current;
  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [nameEditorVisible, setNameEditorVisible] = useState(false);
  const [draftRoomName, setDraftRoomName] = useState('');
  const [lastPaidWarningKey, setLastPaidWarningKey] = useState<string | null>(null);

  const currentMembership = room?.members.find((member) => member.userId === currentUserId) ?? null;
  const isOwner = Boolean(room?.ownerId && room.ownerId === currentUserId);
  const firstFreeMember = room?.members.slice().sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
  const canRenameRoom = Boolean(room && (isOwner || (room.pricingType === 'free' && firstFreeMember?.userId === currentUserId)));
  const isFreeWaiting = Boolean(room && room.pricingType === 'free' && room.currentCount < room.capacity);
  const controlsLocked = Boolean(room && room.pricingType === 'free' && room.currentCount < room.capacity);

  const loadRoom = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    const [userId, roomResult] = await Promise.all([getCurrentUserId(), fetchNightVoiceRoom(roomId)]);
    setCurrentUserId(userId);

    if (roomResult.data) {
      setRoom(roomResult.data);
    } else if (roomResult.error && !silent) {
      setModal({ title: 'Oda bulunamadı', message: roomResult.error.message });
    }

    if (!silent) {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => subscribeToNightVoiceRoom(roomId, () => void loadRoom(true)), [loadRoom, roomId]);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      void loadRoom(true);
    }, 10000);

    return () => clearInterval(refreshTimer);
  }, [loadRoom]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.72, duration: 1200, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [glow]);

  useEffect(() => {
    if (!room?.expiresAt) {
      return;
    }

    const remainingMs = getRoomRemainingMs(room, nowMs);

    if (remainingMs === null) {
      return;
    }

    if (remainingMs <= 0) {
      void expireVoiceRoom(room.id).then(() => {
        setModal({ title: 'Oda kapandı', message: 'Oda süresi doldu.' });
        navigation.goBack();
      });
      return;
    }

    if (room.pricingType !== 'paid') {
      return;
    }

    const warningKey = remainingMs <= 60000 ? `${room.id}:one` : remainingMs <= 300000 ? `${room.id}:five` : null;

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
  }, [lastPaidWarningKey, navigation, nowMs, room]);

  const seatMembers = useMemo(
    () => Array.from({ length: room?.capacity ?? 4 }).map((_, index) => room?.members.find((member) => member.seatIndex === index) ?? null),
    [room],
  );

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

    await loadRoom(true);
    return true;
  }

  async function handleTakeSeat() {
    if (!room) {
      return;
    }

    if (!currentUserId) {
      setModal({ title: 'Giriş gerekli', message: 'Odaya oturmak için giriş yapman gerekiyor.' });
      return;
    }

    const seat = getFreeSeat(room);

    if (seat === null) {
      setModal({ title: 'Oda dolu', message: 'Bu odada şu an boş koltuk yok.' });
      return;
    }

    await runRoomAction(() => joinVoiceRoomSeat(room.id, seat));
  }

  async function handleToggleAudio(member: VoiceRoomMember) {
    if (!room) {
      return;
    }

    if (controlsLocked) {
      setModal({ title: 'Kontroller kilitli', message: 'Ücretsiz odada 4 kişi tamamlanınca konuşma başlayacak.' });
      return;
    }

    if (isLiveKitEnabled && !member.micEnabled) {
      const result = await requestMicrophonePermission();

      if (!result.granted) {
        setModal({ title: 'Mikrofon izni gerekli', message: 'Mikrofonu açmak için izin vermen gerekiyor.' });
        return;
      }
    }

    await runRoomAction(() => setVoiceRoomMemberAudio(room.id, member.userId, !member.micEnabled, !member.speakerEnabled));
  }

  async function handleRename() {
    if (!room) {
      return;
    }

    const name = draftRoomName.trim() || 'Şu anda bu oda müsaittir';
    const success = await runRoomAction(() => renameVoiceRoom(room.id, name));

    if (success) {
      setNameEditorVisible(false);
    }
  }

  function renderSeat(member: VoiceRoomMember | null, seatIndex: number) {
    const isCurrentUser = Boolean(member && member.userId === currentUserId);
    const isActive = Boolean(member && (member.micEnabled || member.speakerEnabled));
    const seatPositionStyle = [styles.seatTop, styles.seatRight, styles.seatBottom, styles.seatLeft][seatIndex];

    return (
      <Animated.View key={seatIndex} style={[styles.roomSeat, seatPositionStyle, isActive && { opacity: glow }, isCurrentUser && styles.currentUserSeat]}>
        <LinearGradient
          colors={member ? ['rgba(153,70,255,0.24)', 'rgba(69,224,255,0.08)'] : ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.025)']}
          style={styles.seatShell}
        >
          {member ? (
            <>
              <Avatar avatar={getAvatarById(member.avatarId)} size={54} />
              <Text numberOfLines={1} style={styles.seatName}>{isCurrentUser ? 'Sen' : member.username}</Text>
              <View style={styles.seatStatusRow}>
                <Ionicons color={!controlsLocked && member.micEnabled ? colors.cyan : colors.dim} name={!controlsLocked && member.micEnabled ? 'mic' : 'mic-off'} size={13} />
                <Ionicons color={!controlsLocked && member.speakerEnabled ? colors.green : colors.dim} name={!controlsLocked && member.speakerEnabled ? 'volume-high' : 'volume-mute'} size={13} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.emptyChairIcon}>
                <Ionicons color={colors.dim} name="person-add-outline" size={20} />
              </View>
              <Text style={styles.emptySeatText}>Boş</Text>
            </>
          )}
        </LinearGradient>

        {isOwner && member && member.userId !== currentUserId ? (
          <View style={styles.ownerSeatActions}>
            <Pressable onPress={() => void handleToggleAudio(member)} style={styles.iconButton}>
              <Ionicons color={colors.text} name="options" size={15} />
            </Pressable>
            <Pressable onPress={() => room && void runRoomAction(() => removeVoiceRoomMember(room.id, member.userId))} style={styles.iconButton}>
              <Ionicons color={colors.danger} name="close" size={15} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  if (loading) {
    return (
      <PremiumScreen scroll={false}>
        <View style={styles.loadingBody}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loadingText}>Oda hazırlanıyor...</Text>
        </View>
      </PremiumScreen>
    );
  }

  if (!room) {
    return (
      <PremiumScreen>
        <ScreenHeader onBack={() => navigation.goBack()} title="Gece Modu Odası" />
        <GlassCard style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Oda şu anda kullanılamıyor.</Text>
        </GlassCard>
      </PremiumScreen>
    );
  }

  const remainingMs = getRoomRemainingMs(room, nowMs);
  const timerText = remainingMs === null ? (room.pricingType === 'paid' ? '3:00:00' : '30:00') : formatRemaining(remainingMs, room.pricingType === 'paid');

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle={room.pricingType === 'paid' ? 'Ücretli oda' : 'Ücretsiz oda'} title="Gece Modu Odası" />

      <LinearGradient colors={['rgba(255,79,185,0.12)', 'rgba(69,224,255,0.08)', 'rgba(255,255,255,0.035)']} style={styles.stage}>
        <View style={styles.stageHeader}>
          <View style={styles.stageTitleBlock}>
            <Text numberOfLines={1} style={styles.roomName}>{room.name}</Text>
            <Text style={styles.roomMeta}>{room.currentCount}/{room.capacity} kişi • {room.pricingType === 'paid' ? '79,99 TL / oda' : 'Ücretsiz'}</Text>
          </View>
          <View style={styles.timerPill}>
            <Ionicons color={colors.goldSoft} name="time" size={14} />
            <Text style={styles.timerText}>{timerText}</Text>
          </View>
        </View>

        <View style={styles.roomScene}>
          <LinearGradient colors={[...gradients.primary]} style={styles.centerTableGlow}>
            <View style={styles.centerTable}>
              <Ionicons color={colors.text} name="moon" size={24} />
              <Text style={styles.centerTableText}>Masa</Text>
            </View>
          </LinearGradient>
          {seatMembers.map(renderSeat)}
        </View>
      </LinearGradient>

      {isFreeWaiting ? (
        <GlassCard style={styles.noticeCard}>
          <Ionicons color={colors.goldSoft} name="lock-closed" size={18} />
          <Text style={styles.noticeText}>4 kişi tamamlanınca mikrofon ve hoparlör aktif olacak.</Text>
        </GlassCard>
      ) : null}

      <View style={styles.controlRow}>
        <View style={[styles.audioControl, controlsLocked && styles.lockedControl]}>
          <Ionicons color={controlsLocked || !currentMembership?.micEnabled ? colors.dim : colors.cyan} name={controlsLocked || !currentMembership?.micEnabled ? 'mic-off' : 'mic'} size={20} />
          <Text style={styles.audioControlText}>Mikrofon</Text>
        </View>
        <View style={[styles.audioControl, controlsLocked && styles.lockedControl]}>
          <Ionicons color={controlsLocked || !currentMembership?.speakerEnabled ? colors.dim : colors.green} name={controlsLocked || !currentMembership?.speakerEnabled ? 'volume-mute' : 'volume-high'} size={20} />
          <Text style={styles.audioControlText}>Hoparlör</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {!currentMembership && room.pricingType === 'free' ? (
          <GradientButton disabled={busy} icon="add-circle" onPress={handleTakeSeat} title="Boş Koltuğa Otur" />
        ) : null}
        {currentMembership ? (
          <GradientButton
            disabled={busy}
            icon="exit"
            onPress={() => void runRoomAction(() => leaveVoiceRoom(room.id)).then(() => navigation.goBack())}
            title="Odadan Çık"
            variant="ghost"
          />
        ) : null}
        {canRenameRoom ? (
          <GradientButton
            compact
            icon="create"
            onPress={() => {
              setDraftRoomName(room.name);
              setNameEditorVisible(true);
            }}
            title="Oda Adını Düzenle"
            variant="secondary"
          />
        ) : null}
      </View>

      {isOwner && room.requests.length > 0 ? (
        <GlassCard style={styles.requestsCard}>
          <Text style={styles.requestsTitle}>İstek Listesi</Text>
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
        <GlassCard style={styles.noticeCard}>
          <Ionicons color={colors.goldSoft} name="card" size={18} />
          <Text style={styles.noticeText}>Oda yenileme mağaza içi satın alma ile yakında aktif olacak.</Text>
        </GlassCard>
      ) : null}

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
  content: {
    gap: spacing.md,
  },
  loadingBody: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyStateText: {
    color: colors.text,
    fontWeight: '800',
  },
  stage: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 470,
    overflow: 'hidden',
    padding: spacing.md,
  },
  stageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  stageTitleBlock: {
    flex: 1,
  },
  roomName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  roomMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  timerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(244,180,94,0.14)',
    borderColor: 'rgba(244,180,94,0.28)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timerText: {
    color: colors.goldSoft,
    fontSize: 12,
    fontWeight: '900',
  },
  roomScene: {
    flex: 1,
    marginTop: spacing.md,
    minHeight: 380,
    position: 'relative',
  },
  centerTableGlow: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 58,
    height: 116,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -58,
    marginTop: -58,
    position: 'absolute',
    top: '50%',
    width: 116,
  },
  centerTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.82)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 50,
    borderWidth: 1,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  centerTableText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  roomSeat: {
    position: 'absolute',
    width: 126,
  },
  seatShell: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 132,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  seatTop: {
    alignSelf: 'center',
    left: '50%',
    marginLeft: -63,
    top: 6,
  },
  seatRight: {
    right: 0,
    top: '50%',
    marginTop: -66,
  },
  seatBottom: {
    bottom: 6,
    left: '50%',
    marginLeft: -63,
  },
  seatLeft: {
    left: 0,
    top: '50%',
    marginTop: -66,
  },
  currentUserSeat: {
    shadowColor: colors.cyan,
    shadowOpacity: 0.36,
    shadowRadius: 18,
  },
  seatName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
    maxWidth: '100%',
  },
  seatStatusRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 6,
  },
  emptyChairIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptySeatText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 8,
  },
  ownerSeatActions: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  noticeCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noticeText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  audioControl: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: 7,
    minHeight: 74,
    justifyContent: 'center',
  },
  lockedControl: {
    opacity: 0.56,
  },
  audioControlText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  actions: {
    gap: spacing.sm,
  },
  requestsCard: {
    gap: spacing.sm,
  },
  requestsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
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
  nameInput: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
