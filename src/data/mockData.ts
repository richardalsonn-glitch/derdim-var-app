import {
  AvatarOption,
  Badge,
  GiftItem,
  Letter,
  Listener,
  MatchRole,
  MembershipPlan,
  NightRoomUser,
  Plan,
  ReceivedGift,
  TopicTag,
} from '../types';

export const topics: TopicTag[] = ['İlişki', 'İş', 'Para', 'Sağlık', 'Genel'];

export const roleLabels: Record<MatchRole, string> = {
  'derdim-var': 'Derdim Var',
  'derman-olan': 'Derman Olan',
};

export const planDurations: Record<MembershipPlan, number> = {
  free: 30,
  plus: 60,
  vip: 180,
};

export const giftBonusByPlan: Record<MembershipPlan, number> = {
  free: 60,
  plus: 60,
  vip: 120,
};

export const avatarOptions: AvatarOption[] = [
  {
    id: 'f-1',
    gender: 'Kadın',
    name: 'Nova',
    vibe: 'Sakin güç',
    palette: ['#5B7CFF', '#A856FF'],
    skinTone: '#F7C8B8',
    hairColor: '#342250',
    outfitColor: '#D860FF',
    accentColor: '#7BE4FF',
    accessory: 'sparkles',
  },
  {
    id: 'f-2',
    gender: 'Kadın',
    name: 'Luna',
    vibe: 'Gece kuşu',
    palette: ['#0E8FFF', '#8147FF'],
    skinTone: '#EAB69E',
    hairColor: '#1E173C',
    outfitColor: '#6C8DFF',
    accentColor: '#F7A1FF',
    accessory: 'moon',
  },
  {
    id: 'f-3',
    gender: 'Kadın',
    name: 'Rhea',
    vibe: 'Nezaket',
    palette: ['#FF6B97', '#FF9E63'],
    skinTone: '#F6D2BF',
    hairColor: '#48274A',
    outfitColor: '#FF6E9A',
    accentColor: '#FFD36E',
    accessory: 'rose',
  },
  {
    id: 'f-4',
    gender: 'Kadın',
    name: 'Mira',
    vibe: 'Empati',
    palette: ['#2CCCF7', '#4A65FF'],
    skinTone: '#E8B79B',
    hairColor: '#3D2A21',
    outfitColor: '#3BD1FF',
    accentColor: '#B670FF',
    accessory: 'leaf',
  },
  {
    id: 'm-1',
    gender: 'Erkek',
    name: 'Atlas',
    vibe: 'Güven',
    palette: ['#3E63FF', '#00B8FF'],
    skinTone: '#D8A887',
    hairColor: '#271C1C',
    outfitColor: '#3255FF',
    accentColor: '#80F1FF',
    accessory: 'shield',
  },
  {
    id: 'm-2',
    gender: 'Erkek',
    name: 'Eren',
    vibe: 'Dinleyici',
    palette: ['#7A50FF', '#C13DFF'],
    skinTone: '#E5B08C',
    hairColor: '#1B203A',
    outfitColor: '#7852FF',
    accentColor: '#FF80D5',
    accessory: 'mic',
  },
  {
    id: 'm-3',
    gender: 'Erkek',
    name: 'Kuzey',
    vibe: 'Hızlı enerji',
    palette: ['#F86A82', '#FD9A3D'],
    skinTone: '#E2B693',
    hairColor: '#352118',
    outfitColor: '#F96D6D',
    accentColor: '#FFD95F',
    accessory: 'flash',
  },
  {
    id: 'm-4',
    gender: 'Erkek',
    name: 'Baran',
    vibe: 'Sabit duruş',
    palette: ['#1FC8AA', '#2F6DFF'],
    skinTone: '#C8946D',
    hairColor: '#101520',
    outfitColor: '#27C7A8',
    accentColor: '#8EE7FF',
    accessory: 'star',
  },
];

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Ücretsiz',
    price: '0 TL / ay',
    description: 'Temel sesli görüşme deneyimi',
    badge: 'Başlangıç',
    accent: ['#1B214D', '#141831'],
    icon: 'sparkles',
    features: ['30 sn sesli görüşme', 'Standart eşleşme', 'Temel profil görünümü'],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '89.99 TL / ay',
    description: 'Daha fazla kontrol ve daha fazla temas',
    badge: 'Mavi Şimşek',
    accent: ['#2158FF', '#753CFF'],
    icon: 'flash',
    features: [
      'Kadın/erkek eşleşme tercihi',
      'Aylık 100 mesaj',
      'Mavi şimşek rozeti',
      '1 dk konuşma',
      '10 arkadaş ekleme hakkı',
      'Arkadaşlarla 5 dk sohbet başlangıcı',
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    price: '149.99 TL / ay',
    description: 'Öncelik, daha uzun görüşme ve premium görünürlük',
    badge: 'Altın Taç',
    accent: ['#6F4800', '#D7A648'],
    icon: 'trophy',
    features: [
      'Sınırsız mesaj',
      'Sınırsız arkadaş ekleme',
      '3 dk konuşma',
      'Öncelikli eşleşme',
      'VIP rozeti',
      'Hediye sonrası +2 dk avantajı',
      'Tekrar eşleşme avantajı',
    ],
  },
];

export const gifts: GiftItem[] = [
  { id: 'heart', name: 'Kalp', symbol: '❤️', price: '79.99 TL', caption: 'Kalpten destek', accent: ['#FF4F9B', '#FF7EB3'] },
  { id: 'rose', name: 'Gül', symbol: '🌹', price: '59.99 TL', caption: 'Nazik bir dokunuş', accent: ['#FF5A75', '#A93DFF'] },
  { id: 'coffee', name: 'Kahve', symbol: '☕', price: '59.99 TL', caption: 'Sıcacık mola', accent: ['#FFAE57', '#8E4E2A'] },
  { id: 'flower', name: 'Çiçek', symbol: '🌸', price: '59.99 TL', caption: 'Moral yükseltir', accent: ['#FF78C9', '#FFB5D9'] },
  { id: 'car', name: 'Araba', symbol: '🏎', price: '59.99 TL', caption: 'Hızlı sürpriz', accent: ['#49A8FF', '#7158FF'] },
  { id: 'wine', name: 'Şarap', symbol: '🍷', price: '59.99 TL', caption: 'Uzun gece bonusu', accent: ['#C64FFF', '#FF6799'] },
  { id: 'credits', name: '10 hediye kredisi', symbol: '🎁', price: '149.99 TL', caption: 'Toplu kredi', accent: ['#6F6BFF', '#43D4FF'] },
];

export const badges: Badge[] = [
  { id: 'supporter', name: 'Destekçi', description: '10 kişiye derman oldun', icon: 'shield-checkmark', gradient: ['#56D7FF', '#386CFF'] },
  { id: 'kind', name: 'İyi Kalpli', description: '50 kişi seni beğendi', icon: 'heart', gradient: ['#FF78B7', '#FF9E6D'] },
  { id: 'legend', name: 'Efsane Dinleyici', description: 'En çok beğenilen kullanıcı', icon: 'star', gradient: ['#FFD86A', '#FF8C47'] },
  { id: 'healer', name: 'Derman Veren', description: '100 konuşma tamamladı', icon: 'flash', gradient: ['#79E6FF', '#2978FF'] },
  { id: 'night', name: 'Gece Kuşu', description: 'Gece modunda 20 konuşma', icon: 'moon', gradient: ['#B77BFF', '#6E4BFF'] },
  { id: 'silent', name: 'Sessiz Dost', description: '20 anonim mektup bıraktı', icon: 'mail', gradient: ['#FFC1A4', '#FF89D8'] },
];

export const letters: Letter[] = [
  { id: '1', title: 'Umarım iyisindir.', preview: 'Bugün içime doğdu; sana bunu bırakmak istedim.', ageLabel: 'Bugün' },
  { id: '2', title: 'Dün iyi dinledin.', preview: 'Teşekkür ederim, gecem biraz daha hafif geçti.', ageLabel: 'Dün' },
  { id: '3', title: 'Yalnız değilsin.', preview: 'Bazen sadece biri bunu söylesin istiyor insan.', ageLabel: '2 gün önce' },
  { id: '4', title: 'İyi ki varsın.', preview: 'Bir cümle bile bazen çok şeyi değiştiriyor.', ageLabel: '3 gün önce' },
];

export const nightRoomUsers: NightRoomUser[] = [
  { id: '1', alias: 'Miray', role: 'Konuşuyor', avatarId: 'f-2', speaking: true },
  { id: '2', alias: 'Eren', role: 'Dinliyor', avatarId: 'm-2' },
  { id: '3', alias: 'Nova', role: 'Dinliyor', avatarId: 'f-1' },
  { id: '4', alias: 'Baran', role: 'Dinliyor', avatarId: 'm-4' },
];

export const silentListeners: Listener[] = [
  { id: '1', avatarId: 'f-1', muted: true },
  { id: '2', avatarId: 'm-1', muted: true },
  { id: '3', avatarId: 'f-3', muted: true },
  { id: '4', avatarId: 'm-3', muted: true },
  { id: '5', avatarId: 'f-4', muted: true },
  { id: '6', avatarId: 'm-2', muted: true },
  { id: '7', avatarId: 'f-2', muted: true },
  { id: '8', avatarId: 'm-4', muted: true },
];

export const receivedGifts: ReceivedGift[] = [
  { id: 'heart', name: 'Kalp', symbol: '❤️', count: 12 },
  { id: 'rose', name: 'Gül', symbol: '🌹', count: 6 },
  { id: 'coffee', name: 'Kahve', symbol: '☕', count: 9 },
  { id: 'flower', name: 'Çiçek', symbol: '🌸', count: 4 },
];

export const helpedToday = 3;

export const moodOptions = ['Yalnızım', 'Kırgınım', 'Mutluyum', 'Konuşmak istiyorum', 'Sadece dinlenmek istiyorum'];

export const profileStats = {
  score: 4.8,
  helpedCount: 27,
  likes: 148,
  completedTalks: 100,
};

export const defaultProfile = {
  username: 'merve_24',
  gender: 'Kadın' as const,
  age: 24,
  relationshipStatus: 'Bekar',
  joinDate: '12.03.2024',
  plan: 'vip' as const,
  avatarId: 'f-2',
  mood: 'Konuşmak istiyorum',
  email: 'gizli@derdimvar.app',
  lastUsernameChangeDate: '2026-04-01T12:00:00.000Z',
  autoCallEnabled: true,
};

export const guestProfile = {
  username: 'atlas_anon',
  avatarId: 'm-1',
};

export function getAvatarById(avatarId: string) {
  return avatarOptions.find((avatar) => avatar.id === avatarId) ?? avatarOptions[0];
}
