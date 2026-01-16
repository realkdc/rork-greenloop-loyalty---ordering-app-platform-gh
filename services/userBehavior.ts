/**
 * User Behavior Tracking Service
 * Tracks user behavior patterns, feature usage, and engagement
 */

import { trackAnalyticsEvent } from './analytics';
import { debugLog } from '@/lib/logger';

export type FeatureType =
  | 'promo_modal'
  | 'order_history'
  | 'loyalty_points'
  | 'referral_code'
  | 'qr_scanner'
  | 'store_picker'
  | 'push_notifications'
  | 'account_settings'
  | 'browse_menu'
  | 'cart'
  | 'checkout';

export type UserJourneyStep =
  | 'home'
  | 'browse'
  | 'cart'
  | 'orders'
  | 'account'
  | 'promo_view'
  | 'promo_click'
  | 'qr_scan'
  | 'store_select';

/**
 * Track feature usage
 */
export function trackFeatureUse(
  feature: FeatureType,
  metadata?: Record<string, any>,
  userId?: string | null
): void {
  debugLog(`🎯 [UserBehavior] Feature used: ${feature}`);

  trackAnalyticsEvent('FEATURE_USE', {
    feature,
    ...metadata,
  }, userId);
}

/**
 * Track promo view
 */
export function trackPromoView(
  promoId: string,
  promoTitle: string,
  userId?: string | null
): void {
  debugLog(`👁️ [UserBehavior] Promo viewed: ${promoTitle}`);

  trackAnalyticsEvent('PROMO_VIEW', {
    promoId,
    promoTitle,
  }, userId);
}

/**
 * Track promo click
 */
export function trackPromoClick(
  promoId: string,
  promoTitle: string,
  userId?: string | null
): void {
  debugLog(`👆 [UserBehavior] Promo clicked: ${promoTitle}`);

  trackAnalyticsEvent('PROMO_CLICK', {
    promoId,
    promoTitle,
  }, userId);
}

/**
 * Track tab view with duration
 */
export function trackTabView(
  tabName: string,
  duration?: number,
  userId?: string | null
): void {
  debugLog(`📑 [UserBehavior] Tab viewed: ${tabName}${duration ? ` (${duration}s)` : ''}`);

  trackAnalyticsEvent('TAB_VIEW', {
    tab: tabName as any,
    duration,
  }, userId);
}

/**
 * Track user journey step
 */
export function trackJourneyStep(
  step: UserJourneyStep,
  metadata?: Record<string, any>,
  userId?: string | null
): void {
  debugLog(`🗺️ [UserBehavior] Journey step: ${step}`);

  trackAnalyticsEvent('FEATURE_USE', {
    feature: `journey_${step}`,
    ...metadata,
  }, userId);
}
