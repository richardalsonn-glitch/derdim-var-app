import { gifts } from './mockData';

export const giftCatalog = gifts.map((gift, index) => ({
  ...gift,
  coinCost: [10, 25, 40, 60, 80][index] ?? 20,
}));
