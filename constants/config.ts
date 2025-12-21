import { Platform } from 'react-native';

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
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://greenhaus-admin.vercel.app/api',
  // Auto-login for App Store review (magic links don't work for reviewers)
  // This bypasses magic link auth but provides full app functionality
  DEMO_MODE: false, // Set to true for App Store review, false for production
};

// Review build flags for Apple App Store submission
export const REVIEW_BUILD = true; // <<< MUST be true for Apple review submission
export const GEO_RESTRICT_FOR_REVIEW = false; // MUST be false for Apple review - allows access from anywhere
export const REVIEW_ALLOWED_STATES = ['TN']; // Only used when GEO_RESTRICT_FOR_REVIEW is true
export const SAFE_MODE = false; // Disable content blurring in development; set to true for Apple review builds
// Hide vape-related tiles/categories without using SAFE_MODE blurring
export const HIDE_VAPE_CONTENT = true;
// Temporary debug switch: when true, disable nearly all WebView injections/customizations
export const WEBVIEW_MINIMAL_MODE = false;

// Review flags - Keep auto-login but NO visible demo messaging
export const REVIEW_DEMO_FAKE_AUTH = false; // Disabled - Apple rejects visible demo mode
export const REVIEW_DEMO_FAKE_CHECKOUT = false; // Disabled - Apple rejects fake checkout

// Platform-specific configuration for Google Play compliance
export const PLATFORM_CONFIG = {
  // iOS: Full functionality including checkout
  ios: {
    enableCheckout: true,
    showCart: true,
    allowPurchaseFlow: true,
  },
  // Android: Informational only - no checkout (Google Play policy compliance)
  android: {
    enableCheckout: false,
    showCart: false, // Hide cart tab, redirect to website
    allowPurchaseFlow: false,
  },
};

// Helper to get current platform config
export const getPlatformConfig = () => {
  const config = PLATFORM_CONFIG[Platform.OS as 'ios' | 'android'] || PLATFORM_CONFIG.ios;
  console.log('[CONFIG] 🔍 Platform.OS:', Platform.OS);
  console.log('[CONFIG] 🔍 Selected config:', JSON.stringify(config));
  return config;
};
