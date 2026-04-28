import { Ionicons } from '@expo/vector-icons';
import { MembershipPlan, UiTheme } from '../../types';

export type HomePalette = {
  theme: UiTheme;
  background: readonly [string, string, string];
  orbPrimary: string;
  orbSecondary: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  text: string;
  muted: string;
  dim: string;
  pink: string;
  purple: string;
  blue: string;
  cyan: string;
  gold: string;
  green: string;
  tabInactive: string;
  shadow: string;
};

export type FeatureItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  glow: string;
};

export type DrawerItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export type ProfileCardData = {
  username: string;
  plan: MembershipPlan;
  score: number;
  level: number;
  progress: number;
  message: string;
};
