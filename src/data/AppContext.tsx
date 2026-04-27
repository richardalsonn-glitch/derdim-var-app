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

type AppContextValue = {
  profile: AppProfile;
  activeRole: MatchRole;
  activeTopic: TopicTag;
  userScore: number;
  userLevel: number;
  skipCount: number;
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
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<AppProfile>(defaultProfile);
  const [activeRole, setActiveRole] = useState<MatchRole>('derdim-var');
  const [activeTopic, setActiveTopic] = useState<TopicTag>(topics[0]);
  const [userScore, setUserScore] = useState(92);
  const [skipCount, setSkipCount] = useState(0);
  const userLevel = getLevelFromScore(userScore);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      activeRole,
      activeTopic,
      userScore,
      userLevel,
      skipCount,
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
    }),
    [activeRole, activeTopic, profile, skipCount, userLevel, userScore],
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
