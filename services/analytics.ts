/**
 * Analytics Service - Lightweight event tracking
 * Fails silently, never blocks app functionality
 */

import { APP_CONFIG } from '@/constants/config';

// Analytics event types (aligned with iOS and admin dashboard)
export type AnalyticsEventType =
  | 'APP_OPEN'
  | 'SESSION_START'
  | 'TAB_SWITCH'      // from, to, duration — dashboard expects this
  | 'CHECKOUT_START'  // dashboard expects this (replaces START_ORDER_CLICK)
  | 'ORDER_COMPLETE'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'LOGIN'
  | 'SIGNUP'
  | 'PUSH_OPEN'
  | 'PROMO_VIEW'
  | 'PROMO_CLICK'
  // Legacy — still accepted by backend
  | 'VIEW_TAB'
  | 'START_ORDER_CLICK'
  | 'JOIN_CREW_CLICK'
  | 'REFERRAL_LINK_CLICK';

export interface AnalyticsMetadata {
  tab?: 'Home' | 'Browse' | 'Cart' | 'Orders' | 'Account';
  from?: string | null;
  to?: string;
  duration?: number;
  campaignId?: string;
  title?: string;
  referralCode?: string;
  [key: string]: any;
}

/**
 * Track an analytics event
 * Fire-and-forget - never throws errors, never awaited
 */
export const trackAnalyticsEvent = (
  eventType: AnalyticsEventType,
  metadata?: AnalyticsMetadata,
  userId?: string | null
): void => {
  // Non-blocking - runs in background
  Promise.resolve().then(async () => {
    try {
      const endpoint = `${APP_CONFIG.apiBaseUrl.replace('/api', '')}/api/analytics/events`;

      // Prepare request body
      const body = {
        eventType,
        metadata: metadata || {},
        userId: userId || null,
      };

      // Send event (timeout after 5s to prevent hanging)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    } catch {
      // Fail silently - never log errors to avoid console spam
    }
  });
};
