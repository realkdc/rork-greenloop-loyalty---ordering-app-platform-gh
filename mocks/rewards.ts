export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'discount' | 'product' | 'experience';
  imageUrl: string;
  available: boolean;
}

export const MOCK_REWARDS: Reward[] = [
  {
    id: 'r1',
    title: '$5 Off Next Purchase',
    description: 'Save $5 on any order over $25',
    pointsCost: 250,
    category: 'discount',
    imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=400',
    available: true,
  },
  {
    id: 'r2',
    title: 'Free Pre-Roll',
    description: 'Choose any pre-roll on us',
    pointsCost: 500,
    category: 'product',
    imageUrl: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=400',
    available: true,
  },
  {
    id: 'r3',
    title: '$10 Off Next Purchase',
    description: 'Save $10 on any order over $50',
    pointsCost: 750,
    category: 'discount',
    imageUrl: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=400',
    available: true,
  },
  {
    id: 'r4',
    title: 'Free Edible',
    description: 'Choose any edible product',
    pointsCost: 1000,
    category: 'product',
    imageUrl: 'https://images.unsplash.com/photo-1576673442511-7e39b6545c87?w=400',
    available: true,
  },
  {
    id: 'r5',
    title: 'VIP Tasting Event',
    description: 'Exclusive invite to our next tasting',
    pointsCost: 2000,
    category: 'experience',
    imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400',
    available: true,
  },
  {
    id: 'r6',
    title: '$25 Off Next Purchase',
    description: 'Save $25 on any order over $100',
    pointsCost: 1500,
    category: 'discount',
    imageUrl: 'https://images.unsplash.com/photo-1607083206325-caf1edba7a0f?w=400',
    available: true,
  },
];

export interface Transaction {
  id: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  date: Date;
}

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    type: 'earned',
    points: 500,
    description: 'Welcome bonus',
    date: new Date('2025-01-01'),
  },
  {
    id: 't2',
    type: 'earned',
    points: 125,
    description: 'Purchase at Main St. location',
    date: new Date('2025-01-05'),
  },
  {
    id: 't3',
    type: 'redeemed',
    points: -250,
    description: 'Redeemed: $5 Off Next Purchase',
    date: new Date('2025-01-10'),
  },
  {
    id: 't4',
    type: 'earned',
    points: 200,
    description: 'Referral bonus',
    date: new Date('2025-01-15'),
  },
  {
    id: 't5',
    type: 'earned',
    points: 300,
    description: 'Purchase at Downtown location',
    date: new Date('2025-01-20'),
  },
];

export interface Campaign {
  id: string;
  name: string;
  type: 'new_customer' | 'reorder' | 'vip';
  qrCode: string;
  pointsReward: number;
  description: string;
  active: boolean;
}

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'New Customer Welcome',
    type: 'new_customer',
    qrCode: 'GREENLOOP_NEW_2025',
    pointsReward: 500,
    description: 'Scan in-store to claim your welcome bonus',
    active: true,
  },
  {
    id: 'c2',
    name: 'Reorder Bonus',
    type: 'reorder',
    qrCode: 'GREENLOOP_REORDER_2025',
    pointsReward: 200,
    description: 'Scan with every purchase to earn bonus points',
    active: true,
  },
  {
    id: 'c3',
    name: 'VIP Exclusive',
    type: 'vip',
    qrCode: 'GREENLOOP_VIP_2025',
    pointsReward: 1000,
    description: 'Exclusive for Gold & Platinum members',
    active: true,
  },
];
