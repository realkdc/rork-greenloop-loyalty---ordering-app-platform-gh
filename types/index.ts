export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  tier: TierLevel;
  referralCode: string;
  joinDate: Date;
}

export type TierLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Campaign {
  id: string;
  name: string;
  code: string;
  pointsReward: number;
  description: string;
  active: boolean;
  retailer?: string;
  maxRedemptionsPerUser?: number;
  expiresAt?: Date;
}

export interface Event {
  id: string;
  type: 'shop_open' | 'qr_scanned' | 'code_redeemed' | 'signup' | 'referral';
  userId: string;
  campaignId?: string;
  retailer?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  campaignId?: string;
  date: Date;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'discount' | 'product' | 'experience';
  imageUrl: string;
  available: boolean;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  menuUrl: string;
  cartUrl: string;
  accountUrl: string;
  ordersUrl: string;
  loginUrl: string;
  hours: string;
}

export interface OnboardingState {
  ageVerified: boolean;
  state: string | null;
  stateSupported: boolean;
  activeStoreId: string | null;
  completedOnboarding: boolean;
}
