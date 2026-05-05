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

function getRoomStatusLabel(room: VoiceRoom) {
  if (room.pricingType === 'free' && room.currentCount < room.capacity) {
    return '4 kişi tamamlanınca konuşma başlar';
  }

  if (room.pricingType === 'paid' && room.ownerId && room.currentCount <= 1) {
    return 'Oda sahibini bekliyor';
  }

  return 'Oda aktif';
}

function getMemberStatusLabel(member: VoiceRoomMember, controlsLocked: boolean) {
  if (controlsLocked) {
    return 'Hazır';
  }

  if (member.micEnabled) {
    return 'Konuşuyor';
  }

  if (member.speakerEnabled) {
    return 'Dinliyor';
  }

  return 'Hazır';
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
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.72, duration: 1400, useNativeDriver: true }),
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
    const isSeatOwner = Boolean(member && room?.ownerId === member.userId);
    const seatPositionStyle = [styles.seatTop, styles.seatRight, styles.seatBottom, styles.seatLeft][seatIndex];

    return (
      <Animated.View key={seatIndex} style={[styles.roomSeat, seatPositionStyle, isActive && { opacity: glow }, isCurrentUser && styles.currentUserSeat]}>
        <LinearGradient
          colors={member ? ['rgba(255,79,185,0.16)', 'rgba(69,224,255,0.1)', 'rgba(255,255,255,0.045)'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.022)']}
          style={[styles.seatShell, !member && styles.emptySeatShell, isCurrentUser && styles.currentSeatShell]}
        >
          {member ? (
            <>
              {isSeatOwner ? (
                <View style={styles.ownerBadge}>
                  <Ionicons color={colors.goldSoft} name="star" size={11} />
                </View>
              ) : null}
              <View style={styles.avatarRing}>
                <Avatar avatar={getAvatarById(member.avatarId)} size={56} />
              </View>
              <Text numberOfLines={1} style={styles.seatName}>{isCurrentUser ? 'Sen' : member.username}</Text>
              <View style={[styles.memberStatusBadge, isActive && !controlsLocked && styles.activeStatusBadge]}>
                <Text style={styles.memberStatusText}>{getMemberStatusLabel(member, controlsLocked)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.emptyChairIcon}>
                <Ionicons color={colors.dim} name="add-circle-outline" size={22} />
              </View>
              <Text style={styles.emptySeatText}>Boş Koltuk</Text>
              <Text style={styles.emptySeatHint}>Katılımcı bekleniyor</Text>
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
  const roomStatusLabel = getRoomStatusLabel(room);

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle={room.pricingType === 'paid' ? 'Ücretli oda' : 'Ücretsiz oda'} title="Gece Modu Odası" />

      <View style={styles.topPanel}>
        <View style={styles.topTitleBlock}>
          <Text numberOfLines={1} style={styles.topTitle}>{room.name}</Text>
          <Text style={styles.topSubtitle}>{roomStatusLabel}</Text>
        </View>
        <View style={styles.topChipRow}>
          <View style={[styles.infoChip, room.pricingType === 'paid' && styles.paidInfoChip]}>
            <Text style={styles.infoChipText}>{room.pricingType === 'paid' ? 'Ücretli' : 'Ücretsiz'}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons color={colors.cyan} name="people" size={13} />
            <Text style={styles.infoChipText}>{room.currentCount}/{room.capacity}</Text>
          </View>
          <View style={[styles.infoChip, styles.timerInfoChip]}>
            <Ionicons color={colors.goldSoft} name="time" size={13} />
            <Text style={styles.infoChipText}>{timerText}</Text>
          </View>
        </View>
      </View>

      <LinearGradient colors={['rgba(255,79,185,0.14)', 'rgba(69,224,255,0.09)', 'rgba(153,70,255,0.08)', 'rgba(255,255,255,0.035)']} style={styles.stage}>
        <View pointerEvents="none" style={[styles.ambientGlow, styles.ambientGlowTop]} />
        <View pointerEvents="none" style={[styles.ambientGlow, styles.ambientGlowBottom]} />
        <View style={styles.roomScene}>
          <Animated.View style={[styles.tablePulse, { opacity: glow }]}>
            <LinearGradient colors={[...gradients.primary]} style={styles.centerTableGlow}>
              <View style={styles.centerTableOuter}>
                <View style={styles.centerTable}>
                  <Ionicons color={colors.goldSoft} name="moon" size={24} />
                  <Text numberOfLines={2} style={styles.centerTableTitle}>{room.name}</Text>
                  <Text style={styles.centerTableSubtitle}>{room.pricingType === 'paid' ? 'Ücretli oda' : 'Gece sohbet odası'}</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
          {seatMembers.map(renderSeat)}
        </View>
      </LinearGradient>

      {isFreeWaiting ? (
        <LinearGradient colors={['rgba(244,180,94,0.16)', 'rgba(255,255,255,0.045)']} style={styles.noticeCard}>
          <View style={styles.noticeIconWrap}>
            <Ionicons color={colors.goldSoft} name="lock-closed" size={17} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Konuşma kilitli</Text>
            <Text style={styles.noticeText}>4 kişi tamamlanınca mikrofon ve hoparlör aktif olacak.</Text>
          </View>
        </LinearGradient>
      ) : null}

      <View style={styles.controlRow}>
        <Pressable
          disabled={!currentMembership || busy}
          onPress={() => currentMembership && void handleToggleAudio(currentMembership)}
          style={[styles.audioControl, controlsLocked && styles.lockedControl]}
        >
          <Ionicons color={controlsLocked || !currentMembership?.micEnabled ? colors.dim : colors.cyan} name={controlsLocked || !currentMembership?.micEnabled ? 'mic-off' : 'mic'} size={20} />
          <Text style={styles.audioControlText}>Mikrofon</Text>
          {controlsLocked ? <Ionicons color={colors.dim} name="lock-closed" size={12} /> : null}
        </Pressable>
        <Pressable
          disabled={!currentMembership || busy}
          onPress={() => currentMembership && void handleToggleAudio(currentMembership)}
          style={[styles.audioControl, controlsLocked && styles.lockedControl]}
        >
          <Ionicons color={controlsLocked || !currentMembership?.speakerEnabled ? colors.dim : colors.green} name={controlsLocked || !currentMembership?.speakerEnabled ? 'volume-mute' : 'volume-high'} size={20} />
          <Text style={styles.audioControlText}>Hoparlör</Text>
          {controlsLocked ? <Ionicons color={colors.dim} name="lock-closed" size={12} /> : null}
        </Pressable>
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
        <LinearGradient colors={['rgba(244,180,94,0.13)', 'rgba(255,255,255,0.04)']} style={styles.noticeCard}>
          <View style={styles.noticeIconWrap}>
            <Ionicons color={colors.goldSoft} name="card" size={17} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Oda yenileme</Text>
            <Text style={styles.noticeText}>Mağaza içi satın alma ile yakında aktif olacak.</Text>
          </View>
        </LinearGradient>
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
  topPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  topTitleBlock: {
    gap: 4,
  },
  topTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  topSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  topChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.22)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  paidInfoChip: {
    backgroundColor: 'rgba(244,180,94,0.14)',
    borderColor: 'rgba(244,180,94,0.28)',
  },
  timerInfoChip: {
    backgroundColor: 'rgba(244,180,94,0.12)',
  },
  infoChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  stage: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 458,
    overflow: 'hidden',
    padding: spacing.md,
  },
  ambientGlow: {
    borderRadius: 999,
    height: 180,
    position: 'absolute',
    width: 180,
  },
  ambientGlowTop: {
    backgroundColor: 'rgba(255,79,185,0.13)',
    right: -80,
    top: -65,
  },
  ambientGlowBottom: {
    backgroundColor: 'rgba(69,224,255,0.12)',
    bottom: -80,
    left: -70,
  },
  roomScene: {
    flex: 1,
    minHeight: 426,
    position: 'relative',
  },
  tablePulse: {
    alignItems: 'center',
    height: 136,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -68,
    marginTop: -68,
    position: 'absolute',
    top: '50%',
    width: 136,
  },
  centerTableGlow: {
    alignItems: 'center',
    borderRadius: 68,
    height: 136,
    justifyContent: 'center',
    width: 136,
  },
  centerTableOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.62)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 61,
    borderWidth: 1,
    height: 122,
    justifyContent: 'center',
    width: 122,
  },
  centerTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.88)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 54,
    borderWidth: 1,
    height: 108,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 108,
  },
  centerTableTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },
  centerTableSubtitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  roomSeat: {
    position: 'absolute',
    width: 112,
  },
  seatShell: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 124,
    padding: spacing.sm,
    shadowColor: colors.purple,
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  emptySeatShell: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderStyle: 'dashed',
  },
  currentSeatShell: {
    borderColor: 'rgba(69,224,255,0.68)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  seatTop: {
    left: '50%',
    marginLeft: -56,
    top: 4,
  },
  seatRight: {
    marginTop: -62,
    right: 0,
    top: '50%',
  },
  seatBottom: {
    bottom: 4,
    left: '50%',
    marginLeft: -56,
  },
  seatLeft: {
    left: 0,
    marginTop: -62,
    top: '50%',
  },
  currentUserSeat: {
    shadowColor: colors.cyan,
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  ownerBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(244,180,94,0.18)',
    borderColor: 'rgba(244,180,94,0.34)',
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 22,
  },
  avatarRing: {
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 34,
    borderWidth: 1,
    padding: 3,
  },
  seatName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 7,
    maxWidth: '100%',
  },
  memberStatusBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeStatusBadge: {
    backgroundColor: 'rgba(69,224,255,0.14)',
    borderColor: 'rgba(69,224,255,0.28)',
  },
  memberStatusText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
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
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
  emptySeatHint: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  ownerSeatActions: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  noticeCard: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  noticeCopy: {
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
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
    gap: 6,
    justifyContent: 'center',
    minHeight: 76,
    paddingVertical: spacing.sm,
  },
  lockedControl: {
    opacity: 0.58,
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
