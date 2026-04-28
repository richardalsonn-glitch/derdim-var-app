import { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';

import { defaultProfile, getAvatarById, topics } from './mockData';
import { AppProfile, MatchRole, MembershipPlan, TopicTag } from '../types';

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

type AppContextValue = {
  profile: AppProfile;
  activeRole: MatchRole;
  activeTopic: TopicTag;
  userScore: number;
  userLevel: number;
  skipCount: number;
  dailyAppreciationUsed: number;
  dailyAppreciationLimit: number;
  updateProfile: (patch: Partial<AppProfile>) => void;
  updateUsername: (username: string) => void;
  setPlan: (plan: MembershipPlan) => void;
  setAvatar: (avatarId: string) => void;
  setAutoCallEnabled: (value: boolean) => void;
  setActiveRole: (role: MatchRole) => void;
  setActiveTopic: (topic: TopicTag) => void;
  adjustScore: (delta: number) => void;
  rewardMatch: () => void;
  penalizeMatch: () => void;
  registerSkip: () => void;
  useDailyAppreciation: () => DailyAppreciationResult;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<AppProfile>(defaultProfile);
  const [activeRole, setActiveRole] = useState<MatchRole>('derdim-var');
  const [activeTopic, setActiveTopic] = useState<TopicTag>(topics[0]);
  const [userScore, setUserScore] = useState(92);
  const [skipCount, setSkipCount] = useState(0);
  const [dailyAppreciationUsage, setDailyAppreciationUsage] = useState({ dateKey: getTodayKey(), used: 0 });
  const userLevel = getLevelFromScore(userScore);
  const effectiveUsage = dailyAppreciationUsage.dateKey === getTodayKey() ? dailyAppreciationUsage.used : 0;
  const dailyAppreciationLimit = getDailyAppreciationLimit(profile.plan);

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
    }),
    [activeRole, activeTopic, dailyAppreciationLimit, dailyAppreciationUsage, effectiveUsage, profile, skipCount, userLevel, userScore],
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
