export const colors = {
  background: '#060816',
  backgroundAlt: '#0C0E24',
  backgroundDeep: '#040512',
  surface: 'rgba(16, 18, 48, 0.86)',
  surfaceSoft: 'rgba(20, 24, 60, 0.58)',
  surfaceStrong: '#171A42',
  glass: 'rgba(255, 255, 255, 0.07)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(175, 124, 255, 0.35)',
  text: '#F7EEFF',
  muted: '#B6B2D8',
  dim: '#7D7A9D',
  pink: '#FF4FB9',
  purple: '#9946FF',
  blue: '#46A5FF',
  cyan: '#45E0FF',
  gold: '#F4B45E',
  goldSoft: '#FFDA8A',
  green: '#63E4A3',
  danger: '#FF7C9C',
  shadow: 'rgba(73, 24, 137, 0.45)',
};

export const gradients = {
  background: ['#040713', '#0A0D24', '#13092D'] as const,
  primary: ['#FF4FB9', '#9A46FF', '#3F85FF'] as const,
  secondary: ['#2A2E7A', '#6B35FF'] as const,
  accent: ['#3F85FF', '#55D8FF'] as const,
  pink: ['#FF4FB9', '#FF7B91'] as const,
  blue: ['#3D7BFF', '#46D7FF'] as const,
  warm: ['#855A1D', '#D59A3C'] as const,
  surface: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)'] as const,
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 26,
  xl: 32,
  pill: 999,
};

export const typography = {
  hero: 42,
  title: 30,
  heading: 22,
  subheading: 18,
  body: 15,
  caption: 12,
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  glow: {
    shadowColor: colors.purple,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  pinkGlow: {
    shadowColor: colors.pink,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
};

export const layout = {
  maxWidth: 460,
};
