/**
 * Analytics Service - Lightweight event tracking
 * Fails silently, never blocks app functionality
 */

import { APP_CONFIG } from '@/constants/config';
import { sessionService } from './session';

// Analytics event types
export type AnalyticsEventType =
  | 'APP_OPEN' // Deprecated - use SESSION_START
  | 'SESSION_START' // New session begins
  | 'VIEW_TAB'
  | 'TAB_VIEW' // User views a tab (with duration)
  | 'START_ORDER_CLICK'
  | 'JOIN_CREW_CLICK'
  | 'PUSH_OPEN'
  | 'REFERRAL_LINK_CLICK'
  | 'PROMO_VIEW' // User views promo modal
  | 'PROMO_CLICK' // User clicks promo
  | 'FEATURE_USE' // User uses specific features
  | 'SCREEN_VIEW' // User views a screen
  | 'TIME_ON_SCREEN'; // Time spent on screen

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
