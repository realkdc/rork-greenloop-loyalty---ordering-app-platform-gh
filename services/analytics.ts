/**
 * Analytics Service - Lightweight event tracking
 * Fails silently, never blocks app functionality
 */

import { APP_CONFIG } from '@/constants/config';
import { sessionService } from './session';

// Analytics event types
export type AnalyticsEventType =
  | 'APP_OPEN' // App was opened (always fires on app mount)
  | 'SESSION_START' // New session begins (after 30min timeout)
  | 'TAB_SWITCH' // User switched tabs (with from/to/duration)
  | 'CHECKOUT_START' // User started checkout flow
  | 'ORDER_COMPLETE' // User completed an order
  | 'PRODUCT_VIEW' // User viewed a product
  | 'ADD_TO_CART' // User added item to cart
  | 'LOGIN' // User logged in
  | 'SIGNUP' // User signed up
  | 'PUSH_OPEN' // User tapped a push notification
  | 'PROMO_VIEW' // User views promo modal
  | 'PROMO_CLICK' // User clicks promo
  | 'FEATURE_USE' // User uses specific features
  // Legacy - kept for backwards compatibility, will be removed
  | 'VIEW_TAB'
  | 'TAB_VIEW'
  | 'START_ORDER_CLICK'
  | 'JOIN_CREW_CLICK'
  | 'REFERRAL_LINK_CLICK'
  | 'SCREEN_VIEW'
  | 'TIME_ON_SCREEN';

export interface AnalyticsMetadata {
  tab?: 'Home' | 'Browse' | 'Cart' | 'Orders' | 'Account';
  campaignId?: string;
  title?: string;
  referralCode?: string;
  screen?: string;
  feature?: string;
  duration?: number;
  sessionId?: string;
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

      // Get current session
      const session = sessionService.getCurrentSession();

      // Prepare request body with session context
      const body = {
        eventType,
        metadata: {
          ...(metadata || {}),
          sessionId: session?.sessionId,
        },
        userId: userId || null,
      };

      // Track event in session
      if (session) {
        await sessionService.trackEvent(eventType);
      }

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
