import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ImageBackground, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { NoticeModal } from '../components/NoticeModal';
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
import { VoiceRoom, VoiceRoomJoinRequest, VoiceRoomMember } from '../types';

const nightRoomBackground = require('../../assets/images/night-room-background.png');

type ModalState = {
  title: string;
  message: string;
};

type LayoutMetrics = {
  avatarSize: number;
  compact: boolean;
  sceneHeight: number;
  seatHeight: number;
  seatWidth: number;
  tableSize: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function getSeatPointerStyle(seatIndex: number) {
  return [styles.pointerTop, styles.pointerRight, styles.pointerBottom, styles.pointerLeft][seatIndex];
}

function RoomBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground resizeMode="cover" source={nightRoomBackground} style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundDim} />
      <LinearGradient
        colors={['rgba(5,6,20,0.28)', 'rgba(5,6,20,0.38)', 'rgba(5,6,20,0.48)']}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {children}
    </ImageBackground>
  );
}

export function NightRoomScreen({ navigation, route }: AppScreenProps<'NightRoom'>) {
  const { roomId } = route.params;
  const { height, width } = useWindowDimensions();
  const glow = useRef(new Animated.Value(0.72)).current;
  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [nameEditorVisible, setNameEditorVisible] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [draftRoomName, setDraftRoomName] = useState('');
  const [lastPaidWarningKey, setLastPaidWarningKey] = useState<string | null>(null);

  const compact = height < 780;
  const tiny = height < 700;
  const horizontalPadding = width < 380 ? 14 : 20;
  const contentGap = tiny ? 6 : compact ? 8 : 10;
  const layout = useMemo<LayoutMetrics>(
    () => ({
      avatarSize: tiny ? 38 : compact ? 44 : 50,
      compact,
      sceneHeight: clamp(height * (tiny ? 0.37 : compact ? 0.39 : 0.42), tiny ? 262 : 302, compact ? 346 : 392),
      seatHeight: tiny ? 82 : compact ? 94 : 106,
      seatWidth: clamp((width - horizontalPadding * 2 - 28) / 2, tiny ? 94 : 104, compact ? 116 : 128),
      tableSize: tiny ? 102 : compact ? 116 : 132,
    }),
    [compact, height, horizontalPadding, tiny, width],
  );

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
    const sideTop = layout.sceneHeight / 2 - layout.seatHeight / 2;
    const seatPositionStyle = [
      { left: '50%' as const, marginLeft: -layout.seatWidth / 2, top: 0 },
      { right: 0, top: sideTop },
      { bottom: 0, left: '50%' as const, marginLeft: -layout.seatWidth / 2 },
      { left: 0, top: sideTop },
    ][seatIndex];

    return (
      <Animated.View
        key={seatIndex}
        style={[
          styles.roomSeat,
          seatPositionStyle,
          { height: layout.seatHeight, width: layout.seatWidth },
          isActive && { opacity: glow },
          isCurrentUser && styles.currentUserSeat,
        ]}
      >
        <View pointerEvents="none" style={[styles.seatPointer, getSeatPointerStyle(seatIndex)]} />
        <LinearGradient
          colors={member ? ['rgba(255,79,185,0.16)', 'rgba(69,224,255,0.1)', 'rgba(255,255,255,0.045)'] : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.022)']}
          style={[styles.seatShell, !member && styles.emptySeatShell, isCurrentUser && styles.currentSeatShell, { minHeight: layout.seatHeight }]}
        >
          {member ? (
            <>
              {isSeatOwner ? (
                <View style={styles.ownerBadge}>
                  <Ionicons color={colors.goldSoft} name="star" size={10} />
                </View>
              ) : null}
              <View style={styles.avatarRing}>
                <Avatar avatar={getAvatarById(member.avatarId)} size={layout.avatarSize} />
              </View>
              <Text numberOfLines={1} style={[styles.seatName, layout.compact && styles.compactSeatName]}>{isCurrentUser ? 'Sen' : member.username}</Text>
              <View style={[styles.memberStatusBadge, isActive && !controlsLocked && styles.activeStatusBadge]}>
                <Text style={styles.memberStatusText}>{getMemberStatusLabel(member, controlsLocked)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.emptyChairIcon, layout.compact && styles.compactEmptyChairIcon]}>
                <Ionicons color={colors.dim} name="add" size={layout.compact ? 20 : 23} />
              </View>
              <Text numberOfLines={1} style={styles.emptySeatText}>Boş Koltuk</Text>
              <Text numberOfLines={1} style={styles.emptySeatHint}>Katılımcı bekleniyor</Text>
            </>
          )}
        </LinearGradient>

        {isOwner && member && member.userId !== currentUserId ? (
          <View style={styles.ownerSeatActions}>
            <Pressable onPress={() => void handleToggleAudio(member)} style={styles.iconButton}>
              <Ionicons color={colors.text} name="options" size={14} />
            </Pressable>
            <Pressable onPress={() => room && void runRoomAction(() => removeVoiceRoomMember(room.id, member.userId))} style={styles.iconButton}>
              <Ionicons color={colors.danger} name="close" size={14} />
            </Pressable>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  function renderRequestRow(request: VoiceRoomJoinRequest) {
    return (
      <View key={request.id} style={styles.requestRow}>
        <View style={styles.requestUser}>
          <Avatar avatar={getAvatarById(request.requesterAvatarId)} size={36} />
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
    );
  }

  if (loading) {
    return (
      <RoomBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingBody}>
            <ActivityIndicator color={colors.cyan} />
            <Text style={styles.loadingText}>Oda hazırlanıyor...</Text>
          </View>
        </SafeAreaView>
      </RoomBackground>
    );
  }

  if (!room) {
    return (
      <RoomBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.content, { gap: contentGap, paddingHorizontal: horizontalPadding }]}>
            <Header compact={compact} onBack={() => navigation.goBack()} roomType="Gece Modu Odası" />
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Oda şu anda kullanılamıyor.</Text>
            </View>
          </View>
        </SafeAreaView>
      </RoomBackground>
    );
  }

  const remainingMs = getRoomRemainingMs(room, nowMs);
  const timerText = remainingMs === null ? (room.pricingType === 'paid' ? '3:00:00' : '30:00') : formatRemaining(remainingMs, room.pricingType === 'paid');
  const roomStatusLabel = getRoomStatusLabel(room);

  return (
    <RoomBackground>
      <View pointerEvents="none" style={[styles.pageGlow, styles.pageGlowTop]} />
      <View pointerEvents="none" style={[styles.pageGlow, styles.pageGlowBottom]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, { gap: contentGap, paddingHorizontal: horizontalPadding }]}>
          <Header compact={compact} onBack={() => navigation.goBack()} roomType={room.pricingType === 'paid' ? 'Ücretli oda' : 'Ücretsiz oda'} />

          <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(153,70,255,0.08)', 'rgba(255,255,255,0.035)']} style={[styles.infoPanel, compact && styles.compactInfoPanel]}>
            <View style={styles.infoIcon}>
              <Ionicons color={colors.goldSoft} name="moon" size={compact ? 18 : 22} />
            </View>
            <View style={styles.infoCopy}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.roomTitle, compact && styles.compactRoomTitle]}>{room.name}</Text>
              <Text numberOfLines={1} style={[styles.roomSubtitle, compact && styles.compactRoomSubtitle]}>{roomStatusLabel}</Text>
              <View style={styles.infoChipRow}>
                <View style={[styles.infoChip, room.pricingType === 'paid' && styles.paidInfoChip]}>
                  <Text style={styles.infoChipText}>{room.pricingType === 'paid' ? 'Ücretli' : 'Ücretsiz'}</Text>
                </View>
                <View style={styles.infoChip}>
                  <Ionicons color={colors.cyan} name="people" size={12} />
                  <Text style={styles.infoChipText}>{room.currentCount}/{room.capacity}</Text>
                </View>
                <View style={[styles.infoChip, styles.timerInfoChip]}>
                  <Ionicons color={colors.goldSoft} name="time" size={12} />
                  <Text style={styles.infoChipText}>{timerText}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.stage, { height: layout.sceneHeight }]}>
            <View pointerEvents="none" style={[styles.ambientGlow, styles.ambientGlowTop]} />
            <View pointerEvents="none" style={[styles.ambientGlow, styles.ambientGlowBottom]} />
            <View pointerEvents="none" style={[styles.orbitRing, styles.orbitRingOuter, { height: layout.sceneHeight * 0.92, marginLeft: -(layout.sceneHeight * 0.92) / 2, marginTop: -(layout.sceneHeight * 0.92) / 2, width: layout.sceneHeight * 0.92 }]} />
            <View pointerEvents="none" style={[styles.orbitRing, styles.orbitRingMiddle, { height: layout.sceneHeight * 0.68, marginLeft: -(layout.sceneHeight * 0.68) / 2, marginTop: -(layout.sceneHeight * 0.68) / 2, width: layout.sceneHeight * 0.68 }]} />
            <Animated.View style={[styles.tablePulse, { height: layout.tableSize, marginLeft: -layout.tableSize / 2, marginTop: -layout.tableSize / 2, opacity: glow, width: layout.tableSize }]}>
              <LinearGradient colors={[...gradients.primary]} style={[styles.centerTableGlow, { borderRadius: layout.tableSize / 2, height: layout.tableSize, width: layout.tableSize }]}>
                <View style={[styles.centerTableOuter, { borderRadius: (layout.tableSize - 12) / 2, height: layout.tableSize - 12, width: layout.tableSize - 12 }]}>
                  <View style={[styles.centerTable, { borderRadius: (layout.tableSize - 26) / 2, height: layout.tableSize - 26, width: layout.tableSize - 26 }]}>
                    <Ionicons color={colors.goldSoft} name="moon" size={layout.compact ? 24 : 28} />
                    <Text style={[styles.centerTableTitle, layout.compact && styles.compactCenterTableTitle]}>Gece Sohbet</Text>
                    {!tiny ? <Text style={styles.centerTableSubtitle}>Odası</Text> : null}
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
            {seatMembers.map(renderSeat)}
          </View>

          {isFreeWaiting ? (
            <LinearGradient colors={['rgba(244,180,94,0.16)', 'rgba(153,70,255,0.08)', 'rgba(255,255,255,0.04)']} style={[styles.noticeCard, compact && styles.compactNoticeCard]}>
              <View style={styles.noticeIconWrap}>
                <Ionicons color={colors.goldSoft} name="lock-closed" size={16} />
              </View>
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>Konuşma kilitli</Text>
                <Text numberOfLines={2} style={styles.noticeText}>4 kişi tamamlanınca mikrofon ve hoparlör aktif olacak.</Text>
              </View>
            </LinearGradient>
          ) : null}

          <View style={styles.controlRow}>
            <ControlButton
              disabled={!currentMembership || busy}
              icon={controlsLocked || !currentMembership?.micEnabled ? 'mic-off' : 'mic'}
              locked={controlsLocked}
              onPress={() => currentMembership && void handleToggleAudio(currentMembership)}
              title="Mikrofon"
              tone={currentMembership?.micEnabled && !controlsLocked ? 'cyan' : 'muted'}
            />
            <ControlButton
              disabled={!currentMembership || busy}
              icon={controlsLocked || !currentMembership?.speakerEnabled ? 'volume-mute' : 'volume-high'}
              locked={controlsLocked}
              onPress={() => currentMembership && void handleToggleAudio(currentMembership)}
              title="Hoparlör"
              tone={currentMembership?.speakerEnabled && !controlsLocked ? 'green' : 'muted'}
            />
          </View>

          <View style={styles.actionsGrid}>
            {!currentMembership && room.pricingType === 'free' ? (
              <ActionTile icon="add-circle-outline" onPress={handleTakeSeat} title="Boş Koltuğa Otur" primary />
            ) : null}
            {currentMembership ? (
              <ActionTile disabled={busy} icon="exit-outline" onPress={() => void runRoomAction(() => leaveVoiceRoom(room.id)).then(() => navigation.goBack())} title="Odadan Çık" />
            ) : null}
            {canRenameRoom ? (
              <ActionTile
                disabled={busy}
                icon="create-outline"
                onPress={() => {
                  setDraftRoomName(room.name);
                  setNameEditorVisible(true);
                }}
                primary
                title="Oda Adını Düzenle"
              />
            ) : null}
            {isOwner && room.requests.length > 0 ? (
              <ActionTile icon="mail-outline" onPress={() => setRequestModalVisible(true)} title={`İstekler (${room.requests.length})`} />
            ) : null}
          </View>
        </View>

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

        <NoticeModal
          actions={[{ label: 'Kapat', onPress: () => setRequestModalVisible(false), variant: 'secondary' }]}
          message=""
          onClose={() => setRequestModalVisible(false)}
          title="İstek Listesi"
          visible={requestModalVisible}
        >
          <View style={styles.requestList}>{room.requests.map(renderRequestRow)}</View>
        </NoticeModal>
      </SafeAreaView>
    </RoomBackground>
  );
}

type HeaderProps = {
  compact: boolean;
  onBack: () => void;
  roomType: string;
};

function Header({ compact, onBack, roomType }: HeaderProps) {
  return (
    <View style={[styles.header, compact && styles.compactHeader]}>
      <Pressable onPress={onBack} style={[styles.backButton, compact && styles.compactBackButton]}>
        <Ionicons color={colors.text} name="chevron-back" size={compact ? 25 : 30} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={[styles.headerTitle, compact && styles.compactHeaderTitle]}>Gece Modu Odası</Text>
        <Text style={styles.headerSubtitle}>{roomType}</Text>
      </View>
    </View>
  );
}

type ControlButtonProps = {
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  locked: boolean;
  onPress: () => void;
  title: string;
  tone: 'cyan' | 'green' | 'muted';
};

function ControlButton({ disabled, icon, locked, onPress, title, tone }: ControlButtonProps) {
  const iconColor = tone === 'cyan' ? colors.cyan : tone === 'green' ? colors.green : colors.dim;

  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.controlButton, disabled && styles.disabledControlButton]}>
      <Ionicons color={iconColor} name={icon} size={21} />
      <Text style={[styles.controlButtonText, tone === 'muted' && styles.mutedControlText]}>{title}</Text>
      {locked ? <Ionicons color={colors.dim} name="lock-closed" size={13} /> : null}
    </Pressable>
  );
}

type ActionTileProps = {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  title: string;
};

function ActionTile({ disabled = false, icon, onPress, primary = false, title }: ActionTileProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.actionTile, primary && styles.primaryActionTile, disabled && styles.disabledActionTile]}>
      <Ionicons color={colors.text} name={icon} size={22} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.actionTileText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,6,20,0.35)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 8,
    paddingTop: 6,
  },
  pageGlow: {
    borderRadius: 999,
    height: 260,
    position: 'absolute',
    width: 260,
  },
  pageGlowTop: {
    backgroundColor: 'rgba(153,70,255,0.16)',
    right: -110,
    top: -90,
  },
  pageGlowBottom: {
    backgroundColor: 'rgba(69,224,255,0.09)',
    bottom: 120,
    left: -120,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  emptyStateText: {
    color: colors.text,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
  },
  compactHeader: {
    minHeight: 52,
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
  compactBackButton: {
    borderRadius: 21,
    height: 42,
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
  },
  compactHeaderTitle: {
    fontSize: 22,
  },
  headerSubtitle: {
    color: '#BFB4FF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  infoPanel: {
    alignItems: 'center',
    borderColor: 'rgba(153,70,255,0.5)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 112,
    overflow: 'hidden',
    padding: spacing.md,
  },
  compactInfoPanel: {
    minHeight: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.12)',
    borderColor: 'rgba(69,224,255,0.24)',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  compactRoomTitle: {
    fontSize: 17,
  },
  roomSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  compactRoomSubtitle: {
    fontSize: 12,
  },
  infoChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  infoChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(69,224,255,0.13)',
    borderColor: 'rgba(69,224,255,0.25)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
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
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  ambientGlow: {
    borderRadius: 999,
    height: 170,
    position: 'absolute',
    width: 170,
  },
  ambientGlowTop: {
    backgroundColor: 'rgba(255,79,185,0.14)',
    right: -82,
    top: -62,
  },
  ambientGlowBottom: {
    backgroundColor: 'rgba(69,224,255,0.12)',
    bottom: -86,
    left: -70,
  },
  orbitRing: {
    borderColor: 'rgba(153,70,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    left: '50%',
    position: 'absolute',
    top: '50%',
  },
  orbitRingOuter: {
    borderColor: 'rgba(153,70,255,0.16)',
  },
  orbitRingMiddle: {
    borderColor: 'rgba(69,224,255,0.13)',
    borderStyle: 'dashed',
  },
  tablePulse: {
    alignItems: 'center',
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    top: '50%',
  },
  centerTableGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOpacity: 0.44,
    shadowRadius: 24,
  },
  centerTableOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.62)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    justifyContent: 'center',
  },
  centerTable: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,8,22,0.9)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  centerTableTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  compactCenterTableTitle: {
    fontSize: 13,
  },
  centerTableSubtitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
    textAlign: 'center',
  },
  roomSeat: {
    position: 'absolute',
  },
  seatShell: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 7,
    shadowColor: colors.purple,
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  emptySeatShell: {
    borderColor: 'rgba(126,135,217,0.48)',
  },
  currentSeatShell: {
    borderColor: 'rgba(174,111,255,0.9)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.42,
    shadowRadius: 18,
  },
  seatPointer: {
    backgroundColor: '#B47DFF',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 4,
    borderWidth: 1,
    height: 14,
    position: 'absolute',
    width: 14,
    zIndex: 2,
  },
  pointerTop: {
    alignSelf: 'center',
    bottom: -7,
    transform: [{ rotate: '45deg' }],
  },
  pointerRight: {
    left: -7,
    marginTop: -7,
    top: '50%',
    transform: [{ rotate: '45deg' }],
  },
  pointerBottom: {
    alignSelf: 'center',
    top: -7,
    transform: [{ rotate: '45deg' }],
  },
  pointerLeft: {
    marginTop: -7,
    right: -7,
    top: '50%',
    transform: [{ rotate: '45deg' }],
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
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 20,
  },
  avatarRing: {
    borderColor: 'rgba(174,111,255,0.62)',
    borderRadius: 999,
    borderWidth: 2,
    padding: 3,
  },
  seatName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 5,
    maxWidth: '100%',
  },
  compactSeatName: {
    fontSize: 12,
  },
  memberStatusBadge: {
    backgroundColor: 'rgba(69,224,255,0.13)',
    borderColor: 'rgba(69,224,255,0.28)',
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeStatusBadge: {
    backgroundColor: 'rgba(69,224,255,0.18)',
  },
  memberStatusText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyChairIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(126,135,217,0.7)',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  compactEmptyChairIcon: {
    height: 40,
    width: 40,
  },
  emptySeatText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  emptySeatHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    maxWidth: '100%',
  },
  ownerSeatActions: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  noticeCard: {
    alignItems: 'center',
    borderColor: 'rgba(174,111,255,0.5)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  compactNoticeCard: {
    minHeight: 54,
    paddingVertical: 7,
  },
  noticeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(244,180,94,0.12)',
    borderColor: 'rgba(244,180,94,0.35)',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 17,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  disabledControlButton: {
    opacity: 0.58,
  },
  controlButtonText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  mutedControlText: {
    color: colors.dim,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(126,135,217,0.62)',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 54,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  primaryActionTile: {
    backgroundColor: 'rgba(153,70,255,0.22)',
    borderColor: 'rgba(255,79,185,0.5)',
    shadowColor: colors.pink,
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  disabledActionTile: {
    opacity: 0.62,
  },
  actionTileText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  requestList: {
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
