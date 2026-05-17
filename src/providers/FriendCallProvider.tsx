import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { FriendIncomingCallModal } from '../components/FriendIncomingCallModal';
import { NoticeModal } from '../components/NoticeModal';
import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { getCurrentUser } from '../services/authService';
import {
  cancelFriendCallInvite,
  createFriendCallInvite,
  expireOldFriendCallInvites,
  FriendCallInvite,
  getFriendCallInvite,
  getFriendCallPeerProfile,
  getLatestIncomingFriendCallInvite,
  markFriendCallInviteMissed,
  respondFriendCallInvite,
  subscribeToFriendCallInvite,
  subscribeToIncomingFriendCallInvites,
} from '../services/friendCallService';
import {
  playIncomingRingtone,
  playOutgoingCallTone,
  stopAllCallSounds,
  stopIncomingRingtone,
  stopOutgoingCallTone,
} from '../services/callSoundService';
import { FriendSummary } from '../types';
import { buildFriendCallAvatarLog } from '../utils/avatarLogger';

type FriendCallProviderProps = PropsWithChildren<{
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}>;

type StartFriendCallPeer = FriendSummary & {
  isOnline?: boolean;
};

type OutgoingCallState = 'ringing' | 'rejected' | 'missed';

type FriendCallContextValue = {
  isCallingFriend: boolean;
  startFriendCall: (peer: StartFriendCallPeer) => Promise<{ ok: boolean; message?: string }>;
};

const FriendCallContext = createContext<FriendCallContextValue | null>(null);
const FRIEND_CALL_RING_TIMEOUT_MS = 20000;
const FRIEND_CALL_TERMINAL_DISPLAY_MS = 3000;

export function useFriendCall() {
  const context = useContext(FriendCallContext);

  if (!context) {
    throw new Error('useFriendCall must be used within FriendCallProvider');
  }

  return context;
}

function getRemainingMs(invite: FriendCallInvite) {
  return Math.max(0, new Date(invite.expiresAt).getTime() - Date.now());
}

function getFriendDisplayName(profile: Pick<FriendSummary, 'username'> | null, resolved: boolean) {
  const username = profile?.username?.trim() ?? '';
  const genericName = ['anonim', 'anonymous', 'kullanıcı', 'kullanici'].includes(username.toLocaleLowerCase('tr-TR'));

  if (username && !genericName) {
    return username;
  }

  return resolved ? 'Anonim' : 'Arkadaşın';
}

export function FriendCallProvider({ children, navigationRef }: FriendCallProviderProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<FriendCallInvite | null>(null);
  const [callerProfile, setCallerProfile] = useState<FriendSummary | null>(null);
  const [callerProfileResolved, setCallerProfileResolved] = useState(false);
  const [outgoingInvite, setOutgoingInvite] = useState<FriendCallInvite | null>(null);
  const [outgoingPeer, setOutgoingPeer] = useState<StartFriendCallPeer | null>(null);
  const [outgoingPeerResolved, setOutgoingPeerResolved] = useState(false);
  const [outgoingCallState, setOutgoingCallState] = useState<OutgoingCallState>('ringing');
  const [creatingOutgoingCall, setCreatingOutgoingCall] = useState(false);
  const [callNoticeMessage, setCallNoticeMessage] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const activeInviteIdRef = useRef<string | null>(null);
  const activeOutgoingInviteRef = useRef<FriendCallInvite | null>(null);
  const outgoingPeerRef = useRef<StartFriendCallPeer | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTerminalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingTerminalInviteIdRef = useRef<string | null>(null);
  const modalVisible = Boolean(incomingInvite);
  const callerName = useMemo(
    () => getFriendDisplayName(callerProfile, callerProfileResolved),
    [callerProfile, callerProfileResolved],
  );
  const outgoingName = useMemo(
    () => getFriendDisplayName(outgoingPeer, outgoingPeerResolved),
    [outgoingPeer, outgoingPeerResolved],
  );

  useEffect(() => {
    let mounted = true;

    async function resolveUser() {
      const result = await getCurrentUser();

      if (mounted) {
        setCurrentUserId(result.data?.id ?? null);
      }
    }

    void resolveUser();

    if (!isSupabaseConfigured) {
      return () => {
        mounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  function clearIncomingInvite() {
    activeInviteIdRef.current = null;
    setIncomingInvite(null);
    setCallerProfile(null);
    setCallerProfileResolved(false);
    setActionPending(false);
    stopIncomingRingtone();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function clearOutgoingInvite() {
    activeOutgoingInviteRef.current = null;
    outgoingPeerRef.current = null;
    outgoingTerminalInviteIdRef.current = null;
    setOutgoingInvite(null);
    setOutgoingPeer(null);
    setOutgoingPeerResolved(false);
    setOutgoingCallState('ringing');
    setCreatingOutgoingCall(false);
    setActionPending(false);
    stopOutgoingCallTone();

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }

    if (outgoingTerminalTimeoutRef.current) {
      clearTimeout(outgoingTerminalTimeoutRef.current);
      outgoingTerminalTimeoutRef.current = null;
    }
  }

  function navigateToOutgoingFriendCall(invite: FriendCallInvite, peer: StartFriendCallPeer) {
    clearOutgoingInvite();
    stopAllCallSounds();

    logSafeDebug(
      '[friend-call-avatar] navigate outgoing',
      buildFriendCallAvatarLog({
        screen: 'outgoing',
        peerUserId: peer.id,
        rawAvatarId: peer.avatarId,
      }),
    );

    if (navigationRef.isReady()) {
      navigationRef.navigate('VoiceCall', {
        mode: 'friend_call',
        friendCall: true,
        matchReady: true,
        roomId: invite.roomId,
        matchRoomId: invite.roomId,
        matchedUserId: peer.id,
        partnerUserId: peer.id,
        partnerName: getFriendDisplayName(peer, true),
        partnerAvatarId: peer.avatarId,
        durationSeconds: 300,
      });
    }
  }

  function showOutgoingTerminalState(invite: FriendCallInvite, state: Exclude<OutgoingCallState, 'ringing'>) {
    if (outgoingTerminalInviteIdRef.current === `${invite.id}:${state}`) {
      return;
    }

    outgoingTerminalInviteIdRef.current = `${invite.id}:${state}`;
    activeOutgoingInviteRef.current = invite;
    setOutgoingInvite(invite);
    setOutgoingCallState(state);
    setCreatingOutgoingCall(false);
    setActionPending(true);
    stopOutgoingCallTone();

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }

    if (outgoingTerminalTimeoutRef.current) {
      clearTimeout(outgoingTerminalTimeoutRef.current);
    }

    outgoingTerminalTimeoutRef.current = setTimeout(() => {
      clearOutgoingInvite();
    }, FRIEND_CALL_TERMINAL_DISPLAY_MS);
  }

  async function handleOutgoingInviteChanged(invite: FriendCallInvite) {
    if (activeOutgoingInviteRef.current?.id !== invite.id) {
      return;
    }

    setOutgoingInvite(invite);

    if (invite.status === 'ringing' && getRemainingMs(invite) > 0) {
      return;
    }

    let peer = outgoingPeerRef.current ?? outgoingPeer;

    if (invite.status === 'accepted' && !peer) {
      const profileResult = await getFriendCallPeerProfile(invite.receiverId);
      peer = profileResult.data ? { ...profileResult.data, isOnline: true } : null;

      if (peer) {
        outgoingPeerRef.current = peer;
        setOutgoingPeer(peer);
        setOutgoingPeerResolved(true);
      }
    }

    if (invite.status === 'accepted' && peer) {
      navigateToOutgoingFriendCall(invite, peer);
      return;
    }

    if (invite.status === 'rejected') {
      showOutgoingTerminalState(invite, 'rejected');
      return;
    }

    if (invite.status === 'missed') {
      showOutgoingTerminalState(invite, 'missed');
      return;
    }

    clearOutgoingInvite();
  }

  async function handleInviteChanged(invite: FriendCallInvite) {
    if (activeInviteIdRef.current !== invite.id) {
      return;
    }

    if (invite.status === 'ringing' && getRemainingMs(invite) > 0) {
      return;
    }

    clearIncomingInvite();
  }

  async function showIncomingInvite(invite: FriendCallInvite) {
    if (!currentUserId || invite.receiverId !== currentUserId || invite.status !== 'ringing') {
      return;
    }

    const currentRoute = navigationRef.getCurrentRoute();

    if (currentRoute?.name === 'VoiceCall' || currentRoute?.name === 'NightRoom') {
      await respondFriendCallInvite(invite.id, 'reject');
      return;
    }

    if (activeInviteIdRef.current === invite.id) {
      return;
    }

    activeInviteIdRef.current = invite.id;
    setIncomingInvite(invite);
    setCallerProfile(null);
    setCallerProfileResolved(false);
    setActionPending(false);
    playIncomingRingtone();

    const profileResult = await getFriendCallPeerProfile(invite.callerId);

    if (activeInviteIdRef.current === invite.id) {
      logSafeDebug(
        '[friend-call-avatar] incoming invite peer resolved',
        buildFriendCallAvatarLog({
          screen: 'incoming',
          peerUserId: invite.callerId,
          rawAvatarId: profileResult.data?.avatarId,
        }),
      );
      setCallerProfile(profileResult.data);
      setCallerProfileResolved(true);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void markFriendCallInviteMissed(invite.id).then(() => expireOldFriendCallInvites());
      clearIncomingInvite();
    }, Math.min(getRemainingMs(invite), FRIEND_CALL_RING_TIMEOUT_MS) + 600);
  }

  async function startFriendCall(peer: StartFriendCallPeer) {
    if (creatingOutgoingCall || outgoingInvite || outgoingPeer) {
      return { ok: false, message: 'Şu anda devam eden bir çağrı var.' };
    }

    setCallNoticeMessage('');
    outgoingPeerRef.current = null;
    setOutgoingPeerResolved(false);
    setCreatingOutgoingCall(true);

    const result = await createFriendCallInvite(peer.id);

    if (result.error || !result.data) {
      clearOutgoingInvite();
      return {
        ok: false,
        message: result.error?.message ?? 'Çağrı başlatılamadı. Lütfen tekrar deneyin.',
      };
    }

    const invite = result.data;

    activeOutgoingInviteRef.current = invite;
    setOutgoingInvite(invite);
    setOutgoingCallState('ringing');
    setCreatingOutgoingCall(false);
    playOutgoingCallTone();

    const profileResult = await getFriendCallPeerProfile(peer.id);
    const resolvedPeer = profileResult.data ? { ...peer, ...profileResult.data } : peer;

    if (activeOutgoingInviteRef.current?.id === invite.id) {
      outgoingPeerRef.current = resolvedPeer;
      setOutgoingPeer(resolvedPeer);
      setOutgoingPeerResolved(true);

      logSafeDebug(
        '[friend-call-avatar] outgoing invite peer resolved',
        buildFriendCallAvatarLog({
          screen: 'outgoing',
          peerUserId: peer.id,
          rawAvatarId: resolvedPeer.avatarId,
        }),
      );
    }

    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
    }

    outgoingTimeoutRef.current = setTimeout(() => {
      void markFriendCallInviteMissed(invite.id).then(() => expireOldFriendCallInvites()).then(() => getFriendCallInvite(invite.id)).then((lookup) => {
        if (lookup.data?.status === 'accepted' || lookup.data?.status === 'rejected' || lookup.data?.status === 'missed') {
          void handleOutgoingInviteChanged(lookup.data);
          return;
        }

        showOutgoingTerminalState({ ...(lookup.data ?? invite), status: 'missed' }, 'missed');
      });
    }, Math.min(getRemainingMs(invite), FRIEND_CALL_RING_TIMEOUT_MS) + 700);

    return { ok: true };
  }

  useEffect(() => {
    if (!currentUserId) {
      clearIncomingInvite();
      return undefined;
    }

    const channel = subscribeToIncomingFriendCallInvites(currentUserId, (invite) => {
      void showIncomingInvite(invite);
    });

    const polling = setInterval(() => {
      void getLatestIncomingFriendCallInvite(currentUserId).then((result) => {
        if (result.data) {
          void showIncomingInvite(result.data);
        }
      });
    }, 2000);

    void getLatestIncomingFriendCallInvite(currentUserId).then((result) => {
      if (result.data) {
        void showIncomingInvite(result.data);
      }
    });

    return () => {
      clearInterval(polling);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, navigationRef]);

  useEffect(() => {
    if (!incomingInvite) {
      return undefined;
    }

    const channel = subscribeToFriendCallInvite(incomingInvite.id, (invite) => {
      void handleInviteChanged(invite);
    });

    const polling = setInterval(() => {
      void getFriendCallInvite(incomingInvite.id).then((result) => {
        if (result.data) {
          void handleInviteChanged(result.data);
        }
      });
    }, 2000);

    return () => {
      clearInterval(polling);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [incomingInvite?.id]);

  useEffect(() => {
    activeOutgoingInviteRef.current = outgoingInvite;
  }, [outgoingInvite]);

  useEffect(() => {
    outgoingPeerRef.current = outgoingPeer;
  }, [outgoingPeer]);

  useEffect(() => {
    if (!outgoingInvite) {
      return undefined;
    }

    const channel = subscribeToFriendCallInvite(outgoingInvite.id, (invite) => {
      void handleOutgoingInviteChanged(invite);
    });

    const polling = setInterval(() => {
      void getFriendCallInvite(outgoingInvite.id).then((result) => {
        if (result.data) {
          void handleOutgoingInviteChanged(result.data);
        }
      });
    }, 2000);

    return () => {
      clearInterval(polling);

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [outgoingInvite?.id, outgoingPeer?.id]);

  useEffect(() => () => {
    const invite = activeOutgoingInviteRef.current;

    if (invite?.status === 'ringing') {
      void cancelFriendCallInvite(invite.id);
    }

    stopAllCallSounds();
  }, []);

  async function acceptIncomingCall() {
    if (!incomingInvite || actionPending) {
      return;
    }

    setActionPending(true);
    stopIncomingRingtone();

    const invite = incomingInvite;
    const response = await respondFriendCallInvite(invite.id, 'accept');

    if (response.error || !response.data) {
      logSafeDebug('[friend-call] accept skipped', response.error, {
        functionName: 'FriendCallProvider.acceptIncomingCall',
      });
      clearIncomingInvite();
      return;
    }

    const acceptedInvite = response.data;
    const partner = callerProfile ?? (await getFriendCallPeerProfile(acceptedInvite.callerId)).data;

    logSafeDebug(
      '[friend-call-avatar] navigate accepted incoming',
      buildFriendCallAvatarLog({
        screen: 'incoming',
        peerUserId: acceptedInvite.callerId,
        rawAvatarId: partner?.avatarId,
      }),
    );

    clearIncomingInvite();
    stopAllCallSounds();

    if (navigationRef.isReady()) {
      navigationRef.navigate('VoiceCall', {
        mode: 'friend_call',
        friendCall: true,
        matchReady: true,
        roomId: acceptedInvite.roomId,
        matchRoomId: acceptedInvite.roomId,
        matchedUserId: acceptedInvite.callerId,
        partnerUserId: acceptedInvite.callerId,
        partnerName: getFriendDisplayName(partner, true),
        partnerAvatarId: partner?.avatarId,
        durationSeconds: 300,
      });
    }
  }

  async function rejectIncomingCall() {
    if (!incomingInvite || actionPending) {
      return;
    }

    setActionPending(true);
    stopIncomingRingtone();

    const response = await respondFriendCallInvite(incomingInvite.id, 'reject');

    if (response.error) {
      logSafeDebug('[friend-call] reject skipped', response.error, {
        functionName: 'FriendCallProvider.rejectIncomingCall',
      });
    }

    clearIncomingInvite();
  }

  async function messageIncomingCaller() {
    if (!incomingInvite || actionPending) {
      return;
    }

    setActionPending(true);
    stopIncomingRingtone();

    const invite = incomingInvite;
    const response = await respondFriendCallInvite(invite.id, 'reject');

    if (response.error) {
      logSafeDebug('[friend-call] message shortcut reject skipped', response.error, {
        functionName: 'FriendCallProvider.messageIncomingCaller',
      });
    }

    clearIncomingInvite();

    if (navigationRef.isReady()) {
      navigationRef.navigate('Chat', { peerUserId: invite.callerId });
    }
  }

  async function cancelOutgoingCall() {
    const invite = activeOutgoingInviteRef.current;

    clearOutgoingInvite();

    if (invite?.status === 'ringing') {
      const result = await cancelFriendCallInvite(invite.id);

      if (result.error) {
        setCallNoticeMessage('Çağrı iptal edilemedi. Lütfen tekrar deneyin.');
      }
    }
  }

  async function messageOutgoingPeer() {
    const peer = outgoingPeerRef.current ?? outgoingPeer;

    await cancelOutgoingCall();

    if (peer && navigationRef.isReady()) {
      navigationRef.navigate('Chat', { peerUserId: peer.id });
    }
  }

  const contextValue = useMemo<FriendCallContextValue>(() => ({
    isCallingFriend: creatingOutgoingCall || Boolean(outgoingInvite),
    startFriendCall,
  }), [creatingOutgoingCall, outgoingInvite]);

  return (
    <FriendCallContext.Provider value={contextValue}>
      {children}
      <FriendIncomingCallModal
        actionPending={actionPending}
        callerName={callerName}
        callerProfile={callerProfile}
        currentUserId={currentUserId}
        onAccept={() => void acceptIncomingCall()}
        onMessage={() => void messageIncomingCaller()}
        onReject={() => void rejectIncomingCall()}
        peerAvatarId={callerProfile?.avatarId}
        peerProfileLoading={modalVisible && !callerProfileResolved}
        peerUserId={incomingInvite?.callerId}
        visible={modalVisible}
      />
      <FriendIncomingCallModal
        actionPending={actionPending || creatingOutgoingCall}
        callState={outgoingCallState}
        callerName={outgoingName}
        callerProfile={outgoingPeer}
        currentUserId={currentUserId}
        mode="outgoing"
        onMessage={() => void messageOutgoingPeer()}
        onReject={() => void cancelOutgoingCall()}
        peerAvatarId={outgoingPeer?.avatarId}
        peerProfileLoading={Boolean(outgoingInvite) && !outgoingPeerResolved}
        peerUserId={outgoingPeer?.id}
        visible={Boolean(outgoingInvite)}
      />
      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setCallNoticeMessage(''), variant: 'secondary' }]}
        message={callNoticeMessage}
        title="Çağrı"
        visible={Boolean(callNoticeMessage)}
      />
    </FriendCallContext.Provider>
  );
}
