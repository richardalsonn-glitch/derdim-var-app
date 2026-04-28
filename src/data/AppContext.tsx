import { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';

import { defaultProfile, getAvatarById, topics } from './mockData';
import { AppProfile, FriendRequestItem, FriendSummary, MatchRole, MembershipPlan, TopicTag, UiTheme } from '../types';

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

type DailyAppreciationResult = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
};

type FriendRequestDraft = FriendSummary;

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
  updateProfile: (patch: Partial<AppProfile>) => void;
  updateUsername: (username: string) => void;
  setPlan: (plan: MembershipPlan) => void;
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

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<AppProfile>(defaultProfile);
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
  const userLevel = getLevelFromScore(userScore);
  const effectiveUsage = dailyAppreciationUsage.dateKey === getTodayKey() ? dailyAppreciationUsage.used : 0;
  const dailyAppreciationLimit = getDailyAppreciationLimit(profile.plan);
  const blockedUserIds = blockedUsers.map((user) => user.id);
  const pendingIncomingFriendRequests = friendRequests.filter((request) => request.direction === 'incoming' && request.status === 'pending');

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
      updateProfile: (patch) => {
        setProfile((current) => {
          const next = { ...current, ...patch };

          if (!patch.avatarId && patch.gender && getAvatarById(current.avatarId).gender !== patch.gender) {
            next.avatarId = patch.gender === 'Kadın' ? 'f-1' : 'm-1';
          }

          return next;
        });
      },
      updateUsername: (username) => {
        setProfile((current) => ({
          ...current,
          username,
          lastUsernameChangeDate: new Date().toISOString(),
        }));
      },
      setPlan: (plan) => {
        setProfile((current) => ({ ...current, plan }));
      },
      setAvatar: (avatarId) => {
        setProfile((current) => ({ ...current, avatarId }));
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
