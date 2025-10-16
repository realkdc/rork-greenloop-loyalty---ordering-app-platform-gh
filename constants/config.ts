export interface BrandConfig {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  storeUrls: {
    shop: string;
    orders: string;
  };
  loyalty: {
    pointsPerDollar: number;
    welcomeBonus: number;
    referralBonus: number;
  };
  pushSenderName: string;
}

export const BRAND_CONFIG: BrandConfig = {
  brandName: 'GreenLoop',
  primaryColor: '#0F4C3A',
  accentColor: '#F59E0B',
  logoUrl: undefined,
  storeUrls: {
    shop: 'https://greenhauscc.com/products',
    orders: 'https://greenhauscc.com/account/orders',
  },
  loyalty: {
    pointsPerDollar: 1,
    welcomeBonus: 500,
    referralBonus: 200,
  },
  pushSenderName: 'GreenLoop',
};

export const APP_CONFIG = {
  trackingSource: 'greenloop',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.greenloop.app',
};
