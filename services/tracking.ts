import { APP_CONFIG } from '@/constants/config';
import { StorageService } from './storage';
import type { Event } from '@/types';

export const TrackingService = {
  async logEvent(
    type: Event['type'],
    userId: string,
    metadata?: {
      campaignId?: string;
      retailer?: string;
      [key: string]: any;
    }
  ): Promise<void> {
    const event: Event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId,
      campaignId: metadata?.campaignId,
      retailer: metadata?.retailer,
      metadata,
      timestamp: new Date(),
    };

    console.log('📊 Event logged:', event);

    await StorageService.addEvent(event);

    if (typeof fetch !== 'undefined') {
      try {
        await fetch(`${APP_CONFIG.apiBaseUrl}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }).catch(() => {});
      } catch {
        console.log('Event sync failed (offline mode)');
      }
    }
  },

  buildShopUrl(baseUrl: string, userId: string, additionalParams?: Record<string, string>): string {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', APP_CONFIG.trackingSource);
    url.searchParams.set('gl_uid', userId);
    
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  },
};
