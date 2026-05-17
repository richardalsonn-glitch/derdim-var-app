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
import { resolveAvatarId } from '../utils/avatarResolver';
import { getSymbolDefinition, isSymbolId } from '../utils/symbolAvatar';

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
    id: 'aphrodite',
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
    id: 'athena',
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
    id: 'selene',
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
    id: 'iris',
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
    id: 'apollo',
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
    id: 'hermes',
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
    id: 'ares',
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
    id: 'poseidon',
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
  { id: 'heart', name: 'Kalp', symbol: '❤️', price: '49.99 TRY', priceTry: 49.99, bonusSeconds: 300, caption: '+5 dakika özel destek', accent: ['#FF4F9B', '#FF7EB3'] },
  { id: 'car', name: 'Araba', symbol: '🏎', price: '49.99 TRY', priceTry: 49.99, bonusSeconds: 300, caption: '+5 dakika hızlı sürpriz', accent: ['#49A8FF', '#7158FF'] },
  { id: 'star', name: 'Yıldız', symbol: '⭐', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika parlak destek', accent: ['#FFD66B', '#FF8A4C'] },
  { id: 'moon', name: 'Ay', symbol: '🌙', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika sakin gece', accent: ['#7DA2FF', '#8F46FF'] },
  { id: 'coffee', name: 'Kahve', symbol: '☕', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika sıcak mola', accent: ['#FFAE57', '#8E4E2A'] },
  { id: 'flower', name: 'Çiçek', symbol: '🌸', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika nazik dokunuş', accent: ['#FF78C9', '#FFB5D9'] },
  { id: 'rose', name: 'Gül', symbol: '🌹', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika içten jest', accent: ['#FF5A75', '#A93DFF'] },
  { id: 'diamond', name: 'Elmas', symbol: '💎', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika değerli an', accent: ['#5BE7FF', '#7C5CFF'] },
  { id: 'crown', name: 'Taç', symbol: '👑', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika premium jest', accent: ['#FFD15E', '#C18424'] },
  { id: 'microphone', name: 'Mikrofon', symbol: '🎙️', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika konuşma desteği', accent: ['#40D9FF', '#2D62FF'] },
  { id: 'headphones', name: 'Kulaklık', symbol: '🎧', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika net bağlantı', accent: ['#6EE7FF', '#5F67FF'] },
  { id: 'balloon', name: 'Balon', symbol: '🎈', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika hafif sevinç', accent: ['#FF5EA8', '#FF745B'] },
  { id: 'lightning', name: 'Şimşek', symbol: '⚡', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika enerjik destek', accent: ['#FFE667', '#FF7E35'] },
  { id: 'butterfly', name: 'Kelebek', symbol: '🦋', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika yumuşak his', accent: ['#54D6FF', '#D35BFF'] },
  { id: 'sun', name: 'Güneş', symbol: '☀️', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika sıcak moral', accent: ['#FFD560', '#FF8C42'] },
  { id: 'evil-eye', name: 'Nazar', symbol: '🧿', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika koruyucu jest', accent: ['#2CE3FF', '#315BFF'] },
  { id: 'key', name: 'Anahtar', symbol: '🗝️', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika yeni kapı', accent: ['#FFC857', '#7A5CFF'] },
  { id: 'rocket', name: 'Roket', symbol: '🚀', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika hızlı destek', accent: ['#FF6F8F', '#6B66FF'] },
  { id: 'pearl', name: 'İnci', symbol: '⚪', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika zarif hediye', accent: ['#E8F7FF', '#A88CFF'] },
  { id: 'angel-wing', name: 'Melek Kanadı', symbol: '🪽', price: '19.99 TRY', priceTry: 19.99, bonusSeconds: 120, caption: '+2 dakika yumuşak destek', accent: ['#E8F4FF', '#FF9EE8'] },
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
  { id: '1', alias: 'Miray', role: 'Konuşuyor', avatarId: 'athena', speaking: true },
  { id: '2', alias: 'Eren', role: 'Dinliyor', avatarId: 'hermes' },
  { id: '3', alias: 'Nova', role: 'Dinliyor', avatarId: 'aphrodite' },
  { id: '4', alias: 'Baran', role: 'Dinliyor', avatarId: 'poseidon' },
];

export const silentListeners: Listener[] = [
  { id: '1', avatarId: 'aphrodite', muted: true },
  { id: '2', avatarId: 'apollo', muted: true },
  { id: '3', avatarId: 'selene', muted: true },
  { id: '4', avatarId: 'ares', muted: true },
  { id: '5', avatarId: 'iris', muted: true },
  { id: '6', avatarId: 'hermes', muted: true },
  { id: '7', avatarId: 'athena', muted: true },
  { id: '8', avatarId: 'poseidon', muted: true },
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
  birthDate: '2002-04-12',
  relationshipStatus: 'Bekar',
  joinDate: '12.03.2024',
  plan: 'free' as const,
  avatarId: 'aphrodite',
  mood: 'Konuşmak istiyorum',
  email: 'gizli@derdimvar.app',
  lastUsernameChangeDate: '2026-04-01T12:00:00.000Z',
  autoCallEnabled: true,
  isFrozen: false,
};

export const guestProfile = {
  username: 'atlas_anon',
  avatarId: 'apollo',
};

export function getAvatarOptionByCanonicalId(avatarId: string) {
  const avatar = avatarOptions.find((item) => item.id === avatarId);

  if (avatar) {
    return avatar;
  }

  if (isSymbolId(avatarId)) {
    const symbol = getSymbolDefinition(avatarId);

    return {
      id: symbol.id,
      gender: 'Kadın' as const,
      name: symbol.title,
      vibe: symbol.subtitle,
      palette: symbol.palette,
      skinTone: symbol.accent,
      hairColor: symbol.glow,
      outfitColor: symbol.palette[0],
      accentColor: symbol.accent,
      accessory: 'sparkles' as const,
    };
  }

  return avatarOptions[0];
}

export function getAvatarById(avatarId: string) {
  const resolvedAvatarId = resolveAvatarId(avatarId);
  return getAvatarOptionByCanonicalId(resolvedAvatarId);
}
