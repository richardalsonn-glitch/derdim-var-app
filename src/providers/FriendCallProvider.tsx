import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { FriendIncomingCallModal } from '../components/FriendIncomingCallModal';
import { logSafeDebug } from '../lib/safeLogger';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { getCurrentUser } from '../services/authService';
import {
  expireOldFriendCallInvites,
  FriendCallInvite,
  getFriendCallInvite,
  getFriendCallPeerProfile,
  getLatestIncomingFriendCallInvite,
  respondFriendCallInvite,
  subscribeToFriendCallInvite,
  subscribeToIncomingFriendCallInvites,
} from '../services/friendCallService';
import { playIncomingRingtone, stopAllCallSounds, stopIncomingRingtone } from '../services/callSoundService';
import { FriendSummary } from '../types';

type FriendCallProviderProps = PropsWithChildren<{
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}>;

function getRemainingMs(invite: FriendCallInvite) {
  return Math.max(0, new Date(invite.expiresAt).getTime() - Date.now());
}

function getCallerDisplayName(profile: FriendSummary | null, resolved: boolean) {
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
  const [actionPending, setActionPending] = useState(false);
  const activeInviteIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalVisible = Boolean(incomingInvite);
  const callerName = useMemo(
    () => getCallerDisplayName(callerProfile, callerProfileResolved),
    [callerProfile, callerProfileResolved],
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

    if (currentRoute?.name === 'VoiceCall') {
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
      setCallerProfile(profileResult.data);
      setCallerProfileResolved(true);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void expireOldFriendCallInvites();
      clearIncomingInvite();
    }, getRemainingMs(invite) + 600);
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

  useEffect(() => () => {
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
        partnerName: getCallerDisplayName(partner, true),
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

  return (
    <>
      {children}
      <FriendIncomingCallModal
        actionPending={actionPending}
        callerName={callerName}
        callerProfile={callerProfile}
        onAccept={() => void acceptIncomingCall()}
        onMessage={() => void messageIncomingCaller()}
        onReject={() => void rejectIncomingCall()}
        visible={modalVisible}
      />
    </>
  );
}
