export type Gender = 'Kadın' | 'Erkek';

export type MembershipPlan = 'free' | 'plus' | 'vip';

export type MatchRole = 'derdim-var' | 'derman-olan';

export type TopicTag = 'İlişki' | 'İş' | 'Para' | 'Sağlık' | 'Genel';

export type AvatarOption = {
  id: string;
  gender: Gender;
  name: string;
  vibe: string;
  palette: [string, string];
  skinTone: string;
  hairColor: string;
  outfitColor: string;
  accentColor: string;
  accessory: 'sparkles' | 'moon' | 'rose' | 'flash' | 'leaf' | 'star' | 'shield' | 'mic';
};

export type GiftItem = {
  id: string;
  name: string;
  symbol: string;
  price: string;
  caption: string;
  accent: [string, string];
};

export type Plan = {
  id: MembershipPlan;
  name: string;
  price: string;
  description: string;
  badge: string;
  accent: [string, string];
  icon: 'sparkles' | 'flash' | 'trophy';
  features: string[];
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: 'shield-checkmark' | 'heart' | 'star' | 'flash' | 'moon' | 'mail';
  gradient: [string, string];
};

export type Letter = {
  id: string;
  title: string;
  preview: string;
  ageLabel: string;
};

export type NightRoomUser = {
  id: string;
  alias: string;
  role: string;
  avatarId: string;
  speaking?: boolean;
};

export type Listener = {
  id: string;
  avatarId: string;
  muted: boolean;
};

export type ReceivedGift = {
  id: string;
  name: string;
  symbol: string;
  count: number;
};

export type AppProfile = {
  username: string;
  gender: Gender;
  age: number;
  relationshipStatus: string;
  joinDate: string;
  plan: MembershipPlan;
  avatarId: string;
  mood: string;
  email?: string;
  lastUsernameChangeDate: string;
  autoCallEnabled: boolean;
};
