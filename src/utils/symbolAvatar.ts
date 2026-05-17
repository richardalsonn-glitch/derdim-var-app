import { Ionicons } from '@expo/vector-icons';

export type SymbolId = 'heart' | 'moon' | 'headset' | 'wave';

export type SymbolAvatarDefinition = {
  id: SymbolId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: [string, string];
  accent: string;
  glow: string;
};

export const symbolAvatarIds: SymbolId[] = ['heart', 'moon', 'headset', 'wave'];

export const symbolAvatarOptions: SymbolAvatarDefinition[] = [
  {
    id: 'heart',
    title: 'Kalp',
    subtitle: 'Icini dokmek isteyen',
    icon: 'heart',
    palette: ['#FF4FB9', '#FF7A96'],
    accent: '#FFD1EA',
    glow: '#FF4FB9',
  },
  {
    id: 'moon',
    title: 'Ay',
    subtitle: 'Gece sohbetcisi',
    icon: 'moon',
    palette: ['#5867FF', '#A35CFF'],
    accent: '#DCD6FF',
    glow: '#8C7BFF',
  },
  {
    id: 'headset',
    title: 'Kulaklik',
    subtitle: 'Dinlemeyi seven',
    icon: 'headset',
    palette: ['#37D6FF', '#5677FF'],
    accent: '#C8F6FF',
    glow: '#45DFFF',
  },
  {
    id: 'wave',
    title: 'Dalga',
    subtitle: 'Sakinlestirici',
    icon: 'water',
    palette: ['#23C6C8', '#2F72FF'],
    accent: '#C6FFFF',
    glow: '#34D6EA',
  },
];

export const legacyAvatarToSymbolMap: Record<string, SymbolId> = {
  star: 'moon',
  mask: 'moon',
  bolt: 'wave',
  lotus: 'wave',
  aphrodite: 'heart',
  athena: 'headset',
  selene: 'moon',
  iris: 'heart',
  apollo: 'moon',
  hermes: 'headset',
  ares: 'wave',
  poseidon: 'wave',
  'f-1': 'heart',
  'f-2': 'headset',
  'f-3': 'moon',
  'f-4': 'heart',
  'm-1': 'moon',
  'm-2': 'headset',
  'm-3': 'wave',
  'm-4': 'wave',
  'female-1': 'heart',
  'female-2': 'headset',
  'female-3': 'moon',
  'female-4': 'heart',
  'woman-1': 'heart',
  'woman-2': 'headset',
  'woman-3': 'moon',
  'woman-4': 'heart',
  'male-1': 'moon',
  'male-2': 'headset',
  'male-3': 'wave',
  'male-4': 'wave',
  'man-1': 'moon',
  'man-2': 'headset',
  'man-3': 'wave',
  'man-4': 'wave',
};

export function isSymbolId(value: unknown): value is SymbolId {
  return typeof value === 'string' && symbolAvatarIds.includes(value as SymbolId);
}

export function getSymbolDefinition(symbolId: unknown) {
  const normalizedSymbolId = isSymbolId(symbolId)
    ? symbolId
    : typeof symbolId === 'string'
      ? legacyAvatarToSymbolMap[symbolId.trim().toLocaleLowerCase('tr-TR')] ?? 'heart'
      : 'heart';
  return symbolAvatarOptions.find((symbol) => symbol.id === normalizedSymbolId) ?? symbolAvatarOptions[0];
}
