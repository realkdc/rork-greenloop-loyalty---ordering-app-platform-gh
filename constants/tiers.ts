/**
 * GreenHaus Crew - Loyalty & Rewards Tier System
 *
 * Tiers are based on ROLLING 90-DAY spend (not lifetime value).
 * Customers must maintain their spending level to keep their tier.
 *
 * Updated: January 2026 - Switched from lifetime CLV to 90-day rolling window
 */

export type TierLevel = 'seed' | 'sprout' | 'bloom' | 'evergreen';

export interface Tier {
  level: TierLevel;
  name: string;
  min90DaySpend: number; // Minimum spend in last 90 days to qualify
  color: string;
  lightspeedGroupId: string;
  perks: string[];
  promos: {
    alwaysOn: string[];
    monthly?: string;
  };
}

export const TIERS: Tier[] = [
  {
    level: 'seed',
    name: 'Seed',
    min90DaySpend: 0, // First purchase / crew entry
    color: '#8BC34A',
    lightspeedGroupId: '02269032-111f-11f0-fa97-eb16249d0715',
    perks: [
      'Member-only drops / app-first promos',
      'Member pricing on Smoking Accessories + Drinks',
    ],
    promos: {
      alwaysOn: [
        'Seed Member Pricing: 10% off Smoking Accessories + Drinks',
      ],
      monthly: 'Crew Day (All Crew): 15% off Smoking Accessories + Drinks (1st Thursday monthly)',
    },
  },
  {
    level: 'sprout',
    name: 'Sprout',
    min90DaySpend: 250, // $250 in last 90 days
    color: '#4CAF50',
    lightspeedGroupId: '02269032-111f-11f0-fa97-eb1725275e64',
    perks: [
      '24h early access to drops/restocks',
      'All Seed perks',
    ],
    promos: {
      alwaysOn: [
        'Sprout Cart Boost: $8 off $75+',
        'Seed Member Pricing: 10% off Smoking Accessories + Drinks (or upgrade to 12%)',
      ],
      monthly: 'Crew Day (All Crew): 15% off Smoking Accessories + Drinks',
    },
  },
  {
    level: 'bloom',
    name: 'Bloom',
    min90DaySpend: 750, // $750 in last 90 days
    color: '#FF9800',
    lightspeedGroupId: '02269032-111f-11f0-fa97-eb175d275306',
    perks: [
      'Hold 1 item for 24h',
      '48h early access to limited drops/restocks',
      'All Sprout & Seed perks',
    ],
    promos: {
      alwaysOn: [
        'Bloom Cart Boost: $12 off $100+',
      ],
      monthly: 'Bloom Bundle: 1 pre-built bundle promo/month (2nd week monthly)',
    },
  },
  {
    level: 'evergreen',
    name: 'Evergreen',
    min90DaySpend: 1500, // $1,500 in last 90 days
    color: '#2E7D32',
    lightspeedGroupId: '02269032-111f-11f0-fa97-eb1779efd27b',
    perks: [
      'VIP window / private drop access',
      'Priority help / faster issue resolution',
      'All Bloom, Sprout & Seed perks',
    ],
    promos: {
      alwaysOn: [
        'Evergreen Cart Boost: $15 off $125+',
        '15% off Smoking Accessories + Drinks',
      ],
      monthly: 'Evergreen Private Drop: limited-time code (3rd Saturday monthly)',
    },
  },
];

/**
 * Get tier based on 90-day rolling spend
 */
export function getTierBySpend(rolling90DaySpend: number): Tier {
  const sortedTiers = [...TIERS].sort((a, b) => b.min90DaySpend - a.min90DaySpend);
  return sortedTiers.find(tier => rolling90DaySpend >= tier.min90DaySpend) || TIERS[0];
}

/**
 * Get next tier customer can achieve
 */
export function getNextTier(currentRolling90DaySpend: number): Tier | null {
  const currentTier = getTierBySpend(currentRolling90DaySpend);
  const currentIndex = TIERS.findIndex(t => t.level === currentTier.level);
  return currentIndex < TIERS.length - 1 ? TIERS[currentIndex + 1] : null;
}

/**
 * Calculate how much more customer needs to spend to reach next tier
 */
export function getSpendToNextTier(currentRolling90DaySpend: number): number {
  const nextTier = getNextTier(currentRolling90DaySpend);
  if (!nextTier) return 0;
  return Math.max(0, nextTier.min90DaySpend - currentRolling90DaySpend);
}

/**
 * First Time Buyer group (separate from main tier system)
 */
export const FIRST_TIME_BUYER = {
  name: 'First Time Buyer',
  lightspeedGroupId: '02269032-111f-11f0-fa97-eb12f658ba5a',
  promo: {
    name: 'Second Visit Booster',
    discount: '$5 off $35+',
    expiryDays: 7,
    usageLimit: '1 use/customer',
  },
};
