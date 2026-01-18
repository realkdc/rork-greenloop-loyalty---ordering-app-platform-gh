/**
 * Screen Time Tracking Hook
 * Tracks time spent on each screen
 */

import { useEffect, useRef } from 'react';
import { trackAnalyticsEvent } from '@/services/analytics';
import { debugLog } from '@/lib/logger';

/**
 * Hook to track screen time
 * Automatically tracks when user enters and leaves the screen
 */
export function useScreenTime(screenName: string, userId?: string | null) {
  const startTimeRef = useRef<number | null>(null);
  const screenNameRef = useRef(screenName);

  useEffect(() => {
    // Update screen name ref
    screenNameRef.current = screenName;

    // Track screen view
    debugLog(`📺 [ScreenTime] User entered screen: ${screenName}`);
    startTimeRef.current = Date.now();

    trackAnalyticsEvent('SCREEN_VIEW', { screen: screenName }, userId);

    // Cleanup - track time spent when leaving screen
    return () => {
      if (startTimeRef.current) {
        const duration = Date.now() - startTimeRef.current;
        const durationSeconds = Math.floor(duration / 1000);

        debugLog(`📺 [ScreenTime] User left screen: ${screenNameRef.current} (${durationSeconds}s)`);

        trackAnalyticsEvent(
          'TIME_ON_SCREEN',
          {
            screen: screenNameRef.current,
            duration: durationSeconds,
          },
          userId
        );

        startTimeRef.current = null;
      }
    };
  }, [screenName, userId]);
}
