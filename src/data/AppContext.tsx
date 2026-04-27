import { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';

import { defaultProfile, getAvatarById, topics } from './mockData';
import { AppProfile, MatchRole, MembershipPlan, TopicTag } from '../types';

type AppContextValue = {
  profile: AppProfile;
  activeRole: MatchRole;
  activeTopic: TopicTag;
  updateProfile: (patch: Partial<AppProfile>) => void;
  setPlan: (plan: MembershipPlan) => void;
  setAvatar: (avatarId: string) => void;
  setActiveRole: (role: MatchRole) => void;
  setActiveTopic: (topic: TopicTag) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<AppProfile>(defaultProfile);
  const [activeRole, setActiveRole] = useState<MatchRole>('derdim-var');
  const [activeTopic, setActiveTopic] = useState<TopicTag>(topics[0]);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      activeRole,
      activeTopic,
      updateProfile: (patch) => {
        setProfile((current) => {
          const next = { ...current, ...patch };

          if (!patch.avatarId && patch.gender && getAvatarById(current.avatarId).gender !== patch.gender) {
            const fallback = patch.gender === 'Kadın' ? 'f-1' : 'm-1';
            next.avatarId = fallback;
          }

          return next;
        });
      },
      setPlan: (plan) => {
        setProfile((current) => ({ ...current, plan }));
      },
      setAvatar: (avatarId) => {
        setProfile((current) => ({ ...current, avatarId }));
      },
      setActiveRole,
      setActiveTopic,
    }),
    [activeRole, activeTopic, profile],
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
