export type TierLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Tier {
  level: TierLevel;
  name: string;
  minPoints: number;
  color: string;
  benefits: string[];
}

export const TIERS: Tier[] = [
  {
    level: 'bronze',
    name: 'Bronze',
    minPoints: 0,
    color: '#CD7F32',
    benefits: ['Earn 1 point per $1', 'Birthday reward', 'Exclusive deals'],
  },
  {
    level: 'silver',
    name: 'Silver',
    minPoints: 500,
    color: '#C0C0C0',
    benefits: ['Earn 1.25 points per $1', 'Early access to sales', 'Free shipping on orders $50+'],
  },
  {
    level: 'gold',
    name: 'Gold',
    minPoints: 1500,
    color: '#FFD700',
    benefits: ['Earn 1.5 points per $1', 'Priority support', 'Exclusive products'],
  },
  {
    level: 'platinum',
    name: 'Platinum',
    minPoints: 3000,
    color: '#E5E4E2',
    benefits: ['Earn 2 points per $1', 'VIP events', 'Personal concierge'],
  },
];

export function getTierByPoints(points: number): Tier {
  const sortedTiers = [...TIERS].sort((a, b) => b.minPoints - a.minPoints);
  return sortedTiers.find(tier => points >= tier.minPoints) || TIERS[0];
}

export function getNextTier(currentPoints: number): Tier | null {
  const currentTier = getTierByPoints(currentPoints);
  const currentIndex = TIERS.findIndex(t => t.level === currentTier.level);
  return currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;
}
