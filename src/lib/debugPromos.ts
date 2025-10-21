/**
 * Debug utility for promos integration
 * Only active when EXPO_PUBLIC_DEBUG_PROMOS=true
 */

export const debugPromos = {
  isEnabled: () => process.env.EXPO_PUBLIC_DEBUG_PROMOS === 'true',
  
  log: (message: string, data?: any) => {
    if (process.env.EXPO_PUBLIC_DEBUG_PROMOS === 'true') {
      console.log(`[DEBUG_PROMOS] ${message}`, data || '');
    }
  },
  
  logStoreId: (storeId: string | null) => {
    if (process.env.EXPO_PUBLIC_DEBUG_PROMOS === 'true') {
      console.log(`[DEBUG_PROMOS] Active storeId: ${storeId || 'null'}`);
    }
  },
  
  logApiCall: (url: string) => {
    if (process.env.EXPO_PUBLIC_DEBUG_PROMOS === 'true') {
      console.log(`[DEBUG_PROMOS] API URL: ${url}`);
    }
  },
  
  logResponse: (count: number, payload: any) => {
    if (process.env.EXPO_PUBLIC_DEBUG_PROMOS === 'true') {
      console.log(`[DEBUG_PROMOS] Response count: ${count}`);
      console.log(`[DEBUG_PROMOS] Response payload:`, payload);
    }
  }
};
