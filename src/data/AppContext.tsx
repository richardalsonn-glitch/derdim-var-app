import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { defaultProfile, topics } from './mockData';
import { logSafeDebug } from '../lib/safeLogger';
import { getCurrentUser, updateCurrentUserPlan } from '../services/authService';
import { preloadMessageNotificationSound } from '../services/messageSoundService';
import { setCurrentUserPresence, subscribeToIncomingMessageSounds } from '../services/socialService';
import { AppProfile, FriendRequestItem, FriendSummary, MatchRole, MembershipPlan, TopicTag, UiTheme } from '../types';
import { getDeterministicAvatarId, resolveAvatarMeta } from '../utils/avatarResolver';

function getLevelFromScore(score: number) {
  if (score >= 500) {
    return 4;
  }

  if (score >= 250) {
    return 3;
  }

  if (score >= 100) {
    return 2;
  }

  return 1;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyAppreciationLimit(plan: MembershipPlan) {
  return plan === 'free' ? 2 : 5;
}

function getGenderDefaultAvatarId(gender: AppProfile['gender']) {
  return gender === 'Erkek' ? 'headset' : 'heart';
}

type DailyAppreciationResult = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
};

type FriendRequestDraft = FriendSummary;

type AppProfileAvatarSource =
  | 'register-onboarding'
  | 'current-user'
  | 'restore-auth'
  | 'avatar-selection'
  | 'profile-edit'
  | 'profile-info'
  | 'set-plan'
  | 'fallback'
  | 'deterministic-fallback'
  | 'defaultProfile'
  | 'empty/null avatar patch'
  | 'peer'
  | 'peer-profile'
  | 'friend'
  | 'friend-profile'
  | 'match'
  | 'match-partner'
  | 'voicecall';

type UpdateProfileOptions = {
  source?: AppProfileAvatarSource;
};

type AppContextValue = {
  profile: AppProfile;
  activeRole: MatchRole;
  activeTopic: TopicTag;
  userScore: number;
  userLevel: number;
  skipCount: number;
  dailyAppreciationUsed: number;
  dailyAppreciationLimit: number;
  blockedUserIds: string[];
  friendRequests: FriendRequestItem[];
  pendingIncomingFriendRequests: FriendRequestItem[];
  friends: FriendSummary[];
  countdownAlertsEnabled: boolean;
  uiTheme: UiTheme;
  updateProfile: (patch: Partial<AppProfile>, options?: UpdateProfileOptions) => void;
  updateUsername: (username: string) => void;
  setPlan: (plan: MembershipPlan) => Promise<void>;
  setAvatar: (avatarId: string) => void;
  setAutoCallEnabled: (value: boolean) => void;
  setCountdownAlertsEnabled: (value: boolean) => void;
  setUiTheme: (value: UiTheme) => void;
  toggleUiTheme: () => void;
  setActiveRole: (role: MatchRole) => void;
  setActiveTopic: (topic: TopicTag) => void;
  adjustScore: (delta: number) => void;
  rewardMatch: () => void;
  penalizeMatch: () => void;
  registerSkip: () => void;
  useDailyAppreciation: () => DailyAppreciationResult;
  renewDailyAppreciation: () => void;
  blockUser: (user: FriendSummary) => void;
  sendFriendRequest: (user: FriendRequestDraft) => FriendRequestItem;
  receiveFriendRequest: (user: FriendRequestDraft) => FriendRequestItem;
  acceptFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const PRESENCE_HEARTBEAT_MS = 4 * 1000;
const AVATAR_UPDATE_ALLOWED_SOURCES: AppProfileAvatarSource[] = [
  'register-onboarding',
  'current-user',
  'restore-auth',
  'avatar-selection',
  'profile-edit',
];

function buildInitialProfile(): AppProfile {
  return {
    ...defaultProfile,
    avatarId: '',
  };
}

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<AppProfile>(buildInitialProfile);
  const [activeRole, setActiveRole] = useState<MatchRole>('derdim-var');
  const [activeTopic, setActiveTopic] = useState<TopicTag>(topics[0]);
  const [userScore, setUserScore] = useState(92);
  const [skipCount, setSkipCount] = useState(0);
  const [dailyAppreciationUsage, setDailyAppreciationUsage] = useState({ dateKey: getTodayKey(), used: 0 });
  const [blockedUsers, setBlockedUsers] = useState<FriendSummary[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [countdownAlertsEnabled, setCountdownAlertsEnabled] = useState(true);
  const [uiTheme, setUiTheme] = useState<UiTheme>('dark');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const userLevel = getLevelFromScore(userScore);
  const effectiveUsage = dailyAppreciationUsage.dateKey === getTodayKey() ? dailyAppreciationUsage.used : 0;
  const dailyAppreciationLimit = getDailyAppreciationLimit(profile.plan);
  const blockedUserIds = blockedUsers.map((user) => user.id);
  const pendingIncomingFriendRequests = friendRequests.filter((request) => request.direction === 'incoming' && request.status === 'pending');

  useEffect(() => {
    let mounted = true;

    void getCurrentUser().then((result) => {
      if (mounted) {
        setCurrentUserId(result.data?.id ?? null);
      }
    });

    void setCurrentUserPresence(true);

    const heartbeat = setInterval(() => {
      void setCurrentUserPresence(true);
    }, PRESENCE_HEARTBEAT_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      void setCurrentUserPresence(nextState === 'active');
    });

    return () => {
      mounted = false;
      clearInterval(heartbeat);
      subscription.remove();
      void setCurrentUserPresence(false);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    preloadMessageNotificationSound();
    const channel = subscribeToIncomingMessageSounds(currentUserId);

    return () => {
      if (channel) {
        void channel.unsubscribe();
      }
    };
  }, [currentUserId]);

  function applyProfileAvatarUpdate(
    current: AppProfile,
    next: AppProfile,
    input: {
      source: AppProfileAvatarSource;
      avatarId?: string | null;
      gender?: AppProfile['gender'];
      avatarPatchProvided: boolean;
    },
  ) {
    const previousAvatarId = typeof current.avatarId === 'string' ? current.avatarId.trim() : '';
    const fallbackGender = input.gender ?? next.gender ?? current.gender;
    const attemptedAvatarId = typeof input.avatarId === 'string' ? input.avatarId.trim() : '';
    const defaultAvatarId = getGenderDefaultAvatarId(fallbackGender);
    const deterministicAvatarId = currentUserId ? getDeterministicAvatarId(currentUserId, fallbackGender) : '';
    let preventedOverwrite = false;
    let reason = 'avatar-updated';

    if (!input.avatarPatchProvided) {
      next.avatarId = previousAvatarId;
      reason = 'preserved-existing-avatar-no-avatar-patch';
    } else if (!attemptedAvatarId) {
      next.avatarId = previousAvatarId;
      preventedOverwrite = true;
      reason = 'blocked-empty-avatar-patch';
    } else if (!AVATAR_UPDATE_ALLOWED_SOURCES.includes(input.source)) {
      next.avatarId = previousAvatarId;
      preventedOverwrite = true;
      reason = 'blocked-avatar-source';
    } else {
      const avatarMeta = resolveAvatarMeta(attemptedAvatarId, fallbackGender);
      const resolvedAvatarId = avatarMeta.canonicalId;
      const hasExistingAvatar = previousAvatarId.length > 0;
      const isDeterministicFallback =
        deterministicAvatarId.length > 0 &&
        resolvedAvatarId === deterministicAvatarId &&
        avatarMeta.fallbackUsed;
      const isDefaultFallbackOverwrite =
        hasExistingAvatar &&
        previousAvatarId !== resolvedAvatarId &&
        resolvedAvatarId === defaultAvatarId &&
        avatarMeta.fallbackUsed;

      if (isDeterministicFallback) {
        next.avatarId = previousAvatarId;
        preventedOverwrite = true;
        reason = 'blocked-fallback-overwrite';
      } else if (isDefaultFallbackOverwrite) {
        next.avatarId = previousAvatarId;
        preventedOverwrite = true;
        reason = 'blocked-default-avatar-overwrite';
      } else {
        next.avatarId = resolvedAvatarId;
      }
    }

    const finalAvatarId = typeof next.avatarId === 'string' ? next.avatarId.trim() : '';

    if (__DEV__) {
      logSafeDebug(
        '[app-profile-avatar]',
        `scope=[app-profile-avatar] currentUserId:${currentUserId ?? 'missing'} previousAvatarId:${previousAvatarId || 'empty'} attemptedAvatarId:${attemptedAvatarId || 'empty'} finalAvatarId:${finalAvatarId || 'empty'} source:${input.source} preventedOverwrite:${preventedOverwrite} reason:${reason}`,
      );
    }

    return next;
  }

  function safePatchProfile(current: AppProfile, patch: Partial<AppProfile>, options?: UpdateProfileOptions) {
    const avatarPatchProvided = Object.prototype.hasOwnProperty.call(patch, 'avatarId');
    const next = { ...current, ...patch };

    return applyProfileAvatarUpdate(current, next, {
      source: options?.source ?? 'current-user',
      avatarId: avatarPatchProvided ? patch.avatarId ?? null : undefined,
      gender: patch.gender,
      avatarPatchProvided,
    });
  }

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      activeRole,
      activeTopic,
      userScore,
      userLevel,
      skipCount,
      dailyAppreciationUsed: effectiveUsage,
      dailyAppreciationLimit,
      blockedUserIds,
      friendRequests,
      pendingIncomingFriendRequests,
      friends,
      countdownAlertsEnabled,
      uiTheme,
      updateProfile: (patch, options) => {
        setProfile((current) => safePatchProfile(current, patch, options));
      },
      updateUsername: (username) => {
        setProfile((current) => ({
          ...current,
          username,
          lastUsernameChangeDate: new Date().toISOString(),
        }));
      },
      setPlan: async (plan) => {
        const result = await updateCurrentUserPlan(plan);

        if (result.error || !result.data) {
          console.warn('[profile] setPlan failed:', result.error?.message ?? 'unknown error');
          return;
        }

        setProfile((current) =>
          safePatchProfile(current, {
            ...current,
            plan: result.data?.plan ?? 'free',
            username: result.data?.username || current.username,
            avatarId: result.data?.avatarId ?? current.avatarId,
          }, {
            source: 'set-plan',
          }),
        );
      },
      setAvatar: (avatarId) => {
        setProfile((current) => safePatchProfile(current, { avatarId }, { source: 'avatar-selection' }));
      },
      setAutoCallEnabled: (value) => {
        setProfile((current) => ({ ...current, autoCallEnabled: value }));
      },
      setCountdownAlertsEnabled,
      setUiTheme,
      toggleUiTheme: () => {
        setUiTheme((current) => (current === 'dark' ? 'light' : 'dark'));
      },
      setActiveRole,
      setActiveTopic,
      adjustScore: (delta) => {
        setUserScore((current) => Math.max(0, current + delta));
      },
      rewardMatch: () => {
        setUserScore((current) => Math.max(0, current + 12));
      },
      penalizeMatch: () => {
        setUserScore((current) => Math.max(0, current - 10));
      },
      registerSkip: () => {
        setSkipCount((current) => current + 1);
        setUserScore((current) => Math.max(0, current - 8));
      },
      useDailyAppreciation: () => {
        const todayKey = getTodayKey();
        const nextLimit = getDailyAppreciationLimit(profile.plan);
        const currentUsed = dailyAppreciationUsage.dateKey === todayKey ? dailyAppreciationUsage.used : 0;

        if (currentUsed >= nextLimit) {
          if (dailyAppreciationUsage.dateKey !== todayKey) {
            setDailyAppreciationUsage({ dateKey: todayKey, used: 0 });
          }

          return {
            allowed: false,
            used: currentUsed,
            remaining: 0,
            limit: nextLimit,
          };
        }

        const nextUsed = currentUsed + 1;
        setDailyAppreciationUsage({ dateKey: todayKey, used: nextUsed });

        return {
          allowed: true,
          used: nextUsed,
          remaining: Math.max(0, nextLimit - nextUsed),
          limit: nextLimit,
        };
      },
      renewDailyAppreciation: () => {
        setDailyAppreciationUsage({ dateKey: getTodayKey(), used: 0 });
      },
      blockUser: (user) => {
        setBlockedUsers((current) => (current.some((item) => item.id === user.id) ? current : [...current, user]));
      },
      sendFriendRequest: (user) => {
        const now = new Date().toISOString();
        const existingRequest =
          friendRequests.find((request) => request.id === user.id && request.direction === 'outgoing' && request.status !== 'rejected') ??
          friendRequests.find((request) => request.id === user.id && request.direction === 'incoming' && request.status === 'pending');

        if (existingRequest) {
          return existingRequest;
        }

        const request: FriendRequestItem = {
          ...user,
          direction: 'outgoing',
          status: 'pending',
          createdAt: now,
        };

        setFriendRequests((current) => [...current, request]);
        return request;
      },
      receiveFriendRequest: (user) => {
        const now = new Date().toISOString();
        const existingRequest =
          friendRequests.find((request) => request.id === user.id && request.direction === 'incoming' && request.status === 'pending') ??
          friendRequests.find((request) => request.id === user.id && request.status === 'accepted');

        if (existingRequest) {
          return existingRequest;
        }

        const request: FriendRequestItem = {
          ...user,
          direction: 'incoming',
          status: 'pending',
          createdAt: now,
        };

        setFriendRequests((current) => [...current, request]);
        return request;
      },
      acceptFriendRequest: (requestId) => {
        const targetRequest = friendRequests.find((request) => request.id === requestId);

        if (!targetRequest) {
          return;
        }

        setFriendRequests((current) =>
          current.map((request) => (request.id === requestId ? { ...request, status: 'accepted' } : request)),
        );
        setFriends((current) =>
          current.some((friend) => friend.id === targetRequest.id)
            ? current
            : [...current, { id: targetRequest.id, username: targetRequest.username, avatarId: targetRequest.avatarId, plan: targetRequest.plan }],
        );
      },
      rejectFriendRequest: (requestId) => {
        setFriendRequests((current) =>
          current.map((request) => (request.id === requestId ? { ...request, status: 'rejected' } : request)),
        );
      },
    }),
    [
      activeRole,
      activeTopic,
      blockedUserIds,
      countdownAlertsEnabled,
      currentUserId,
      dailyAppreciationLimit,
      dailyAppreciationUsage,
      effectiveUsage,
      friendRequests,
      friends,
      pendingIncomingFriendRequests,
      profile,
      skipCount,
      uiTheme,
      userLevel,
      userScore,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppState must be used inside AppProvider');
  }

  return context;
}
