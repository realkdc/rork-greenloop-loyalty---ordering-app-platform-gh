import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { searchCustomersByEmail } from '@/lib/lightspeedClient';

export function useCustomerData() {
  const { user } = useAuth();
  const email = user?.email;

  // Use console.error so logs show up (console.log is disabled by logger.ts)
  // Clean email once at the hook level to ensure consistency
  let cleanedEmail = email?.trim() || '';
  cleanedEmail = cleanedEmail.replace(/Edit$/i, '').trim();
  const emailMatch = cleanedEmail.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  if (emailMatch && emailMatch[1]) {
    cleanedEmail = emailMatch[1].trim();
  }

  console.error('[useCustomerData] Hook called:', {
    hasUser: !!user,
    originalEmail: email,
    cleanedEmail: cleanedEmail,
    userId: user?.id,
    enabled: !!cleanedEmail,
  });

  const { data: customer, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', cleanedEmail], // Use cleaned email in query key
    queryFn: async () => {
      console.error('[useCustomerData] ⚡ Query function EXECUTING for email:', cleanedEmail);
      console.error('[useCustomerData] 📧 Original email was:', email);
      if (!cleanedEmail) {
        console.error('[useCustomerData] ❌ No email provided after cleaning, returning null');
        return null;
      }
      
      console.error('[useCustomerData] 🔍 Fetching customer for cleaned email:', cleanedEmail);
      try {
        // searchCustomersByEmail now returns only exact matches, so no need to filter again
        const customers = await searchCustomersByEmail(cleanedEmail);
        console.error('[useCustomerData] API returned', customers.length, 'customers (already filtered to exact matches)');
        const found = customers.length > 0 ? customers[0] : null;
        console.error('[useCustomerData] ✅ Found customer:', found?.id || 'none');
        if (found) {
          console.error('[useCustomerData] Customer details:', {
            id: found.id,
            name: found.name,
            email: found.email,
            first_name: found.first_name,
            last_name: found.last_name,
            loyalty_balance: found.loyalty_balance,
            customer_code: found.customer_code,
          });
          // If customer has no email, it's probably not the right one
          if (!found.email) {
            console.error('[useCustomerData] ⚠️ WARNING: Customer found but has no email - might be wrong customer!');
          }
        } else {
          console.error('[useCustomerData] ⚠️ No customer found in Lightspeed for email:', cleanedEmail);
          console.error('[useCustomerData] ⚠️ Original email was:', email);
          console.error('[useCustomerData] ⚠️ This might mean:');
          console.error('[useCustomerData]   1. Customer has not made a purchase yet (not in POS system)');
          console.error('[useCustomerData]   2. Email in Lightspeed is different from logged-in email');
          console.error('[useCustomerData]   3. API search is not working correctly');
        }
        return found;
      } catch (err) {
        console.error('[useCustomerData] ❌ Error in queryFn:', err);
        throw err;
      }
    },
    enabled: !!cleanedEmail,
    retry: 1,
    staleTime: 0, // Don't cache - always fetch fresh data
    cacheTime: 0, // Don't cache in memory
    onError: (err) => {
      console.error('[useCustomerData] Query error:', err);
    },
    onSuccess: (data) => {
      console.error('[useCustomerData] Query success, customer:', data?.id || 'none');
    },
  });
  
  console.error('[useCustomerData] Query status:', {
    enabled: !!cleanedEmail,
    isLoading,
    hasData: customer !== undefined,
    hasCustomer: !!customer,
  });

  // Get loyalty points from Lightspeed customer data
  // Lightspeed uses `loyalty_balance` which is the dollar amount in their loyalty account
  // Convert dollars to points: $5.00 = 500 points (assuming 1 point = $0.01)
  const loyaltyBalance = customer?.loyalty_balance ?? 0;
  const points = Math.round(loyaltyBalance * 100);
  
  // Calculate tier based on points
  const tier = customer 
    ? (points >= 1000 ? 'gold' : points >= 500 ? 'silver' : 'bronze')
    : 'bronze';
  
  // Get customer display name
  const customerName = customer?.name || 
    (customer?.first_name && customer?.last_name 
      ? `${customer.first_name} ${customer.last_name}`
      : customer?.first_name || customer?.last_name || null);
  
  // Log for debugging - use console.error so logs show up
  console.error('[useCustomerData] Return values:', {
    hasCustomer: !!customer,
    customerName,
    customerEmail: customer?.email || null,
    points,
    tier,
    isLoading,
    hasError: !!error,
    errorMessage: error ? (error instanceof Error ? error.message : String(error)) : null,
  });

  if (customer) {
    console.error('[useCustomerData] ✅ Customer data loaded:', {
      customerId: customer.id,
      name: customerName,
      email: customer.email,
      loyaltyBalance,
      points,
      tier,
    });
  } else if (cleanedEmail) {
    console.error('[useCustomerData] ⚠️ No customer found in Lightspeed for email:', cleanedEmail);
  } else {
    console.error('[useCustomerData] ⚠️ No email available - cannot fetch customer');
  }

  return {
    customer,
    customerName,
    customerEmail: customer?.email || null,
    points,
    tier,
    isLoading,
    error,
    refetch,
  };
}
