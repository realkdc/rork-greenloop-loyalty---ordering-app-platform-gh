import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getCustomerSales } from '@/lib/lightspeedClient';

export function useOrderHistory(limit?: number) {
  const { user } = useAuth();
  const email = user?.email;

  // Use console.error so logs show up (console.log is disabled by logger.ts)
  console.error('[useOrderHistory] Hook called with:', { email, limit: limit || 'ALL TIME', hasUser: !!user });

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', email, limit || 'all'],
    queryFn: async () => {
      console.error('[useOrderHistory] ⚡ Query function EXECUTING for email:', email);
      if (!email) {
        console.error('[useOrderHistory] ❌ No email - returning empty array');
        return [];
      }
      
      // Clean email before searching
      let cleanedEmail = email.trim();
      cleanedEmail = cleanedEmail.replace(/Edit$/i, '').trim();
      const emailMatch = cleanedEmail.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch && emailMatch[1]) {
        cleanedEmail = emailMatch[1].trim();
      }
      
      console.error('[useOrderHistory] 🔍 Fetching orders for cleaned email:', cleanedEmail, limit ? `(limit: ${limit})` : '(ALL TIME)');
      try {
        const sales = await getCustomerSales(cleanedEmail, limit);
        console.error('[useOrderHistory] ✅ Successfully fetched orders:', sales.length, limit ? `(limited to ${limit})` : '(ALL TIME)');
        if (sales.length === 0) {
          console.error('[useOrderHistory] ⚠️ No orders found for this email in Lightspeed');
        }
        return sales;
      } catch (err) {
        console.error('[useOrderHistory] ❌ Error fetching orders:', err);
        throw err;
      }
    },
    enabled: !!email,
    retry: false,
    staleTime: 0, // Don't cache - always fetch fresh data
    cacheTime: 0, // Don't cache in memory
    onError: (err) => {
      console.error('[useOrderHistory] Query error:', err);
    },
    onSuccess: (data) => {
      console.error('[useOrderHistory] Query success, orders count:', data?.length || 0);
    },
  });
  
  console.error('[useOrderHistory] Query status:', {
    enabled: !!email,
    isLoading,
    hasData: orders !== undefined,
    dataLength: orders?.length || 0,
  });

  console.error('[useOrderHistory] Current state:', {
    ordersCount: orders?.length || 0,
    isLoading,
    hasError: !!error,
    errorMessage: error ? (error instanceof Error ? error.message : String(error)) : null,
  });

  return {
    orders: orders || [],
    isLoading,
    error,
    refetch,
  };
}
