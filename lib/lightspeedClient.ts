/**
 * Direct Lightspeed API client for mobile app
 * This bypasses tRPC and calls Lightspeed directly
 */

const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

interface LightspeedResponse<T> {
  data: T;
  version?: {
    min: string;
    max: string;
  };
}

interface LightspeedCustomer {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  loyalty_balance: number;
  balance: number;
  year_to_date: number;
  enable_loyalty: boolean;
  customer_code: string | null;
  created_at: string;
  updated_at: string;
}

interface LightspeedSale {
  id: string;
  receipt_number: string;
  sale_date: string;
  total_price: number;
  total_tax: number;
  status: string;
  customer_id: string | null;
  outlet_id: string;
  register_id: string;
  user_id: string;
  line_items?: any[];
}

async function apiRequest<T = any>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Use console.error so logs show up (console.log is disabled by logger.ts)
  console.error(`[LightspeedClient] Fetching: ${endpoint}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LightspeedClient] Error ${response.status}:`, errorText.substring(0, 200));
      throw new Error(`Lightspeed API Error (${response.status})`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`[LightspeedClient] Non-JSON response:`, text.substring(0, 200));
      throw new Error(`Non-JSON response from Lightspeed`);
    }

    return response.json();
  } catch (error) {
    console.error(`[LightspeedClient] Request failed:`, error);
    throw error;
  }
}

/**
 * Search customers by email
 * Uses the /search endpoint which is more reliable for email searches
 */
export async function searchCustomersByEmail(email: string): Promise<LightspeedCustomer[]> {
  try {
    // First try the search endpoint (more reliable for email searches)
    console.error(`[LightspeedClient] Searching customers by email using /search endpoint: ${email}`);
    const searchResult = await apiRequest<LightspeedResponse<LightspeedCustomer[]>>(
      `/search?type=customers&q=${encodeURIComponent(email)}&page_size=100`
    );
    
    let customers = searchResult.data || [];
    console.error(`[LightspeedClient] Search endpoint returned ${customers.length} customers`);
    
    // Filter to exact email matches (case-insensitive)
    const exactMatches = customers.filter(c => {
      const customerEmail = c.email?.toLowerCase().trim() || '';
      const searchEmail = email.toLowerCase().trim();
      return customerEmail === searchEmail;
    });
    
    if (exactMatches.length > 0) {
      console.error(`[LightspeedClient] Found ${exactMatches.length} exact email matches`);
      return exactMatches;
    }
    
    // If no exact matches, try the /customers endpoint as fallback
    console.error(`[LightspeedClient] No exact matches from search, trying /customers endpoint...`);
    const customersResult = await apiRequest<LightspeedResponse<LightspeedCustomer[]>>(
      `/customers?email=${encodeURIComponent(email)}&page_size=100`
    );
    
    const customersFromDirect = customersResult.data || [];
    console.error(`[LightspeedClient] /customers endpoint returned ${customersFromDirect.length} customers`);
    
    // Filter to exact email matches
    const exactMatchesFromDirect = customersFromDirect.filter(c => {
      const customerEmail = c.email?.toLowerCase().trim() || '';
      const searchEmail = email.toLowerCase().trim();
      return customerEmail === searchEmail;
    });
    
    if (exactMatchesFromDirect.length > 0) {
      console.error(`[LightspeedClient] Found ${exactMatchesFromDirect.length} exact email matches from /customers`);
      return exactMatchesFromDirect;
    }
    
    // If still no matches, return empty array
    console.error(`[LightspeedClient] ⚠️ No exact email matches found for: ${email}`);
    return [];
  } catch (error) {
    console.error('[LightspeedClient] searchCustomersByEmail error:', error);
    return [];
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<LightspeedCustomer | null> {
  try {
    const result = await apiRequest<LightspeedResponse<LightspeedCustomer>>(
      `/customers/${customerId}`
    );
    return result.data || null;
  } catch (error) {
    console.error('[LightspeedClient] getCustomerById error:', error);
    return null;
  }
}

/**
 * Get ALL sales (orders) for a customer - ALL TIME
 * Improved: Finds customer by email first, then searches sales by customer_id
 * Uses pagination to fetch ALL historical orders (2023-2026, etc.)
 */
export async function getCustomerSales(customerEmail?: string, limit?: number): Promise<any[]> {
  // Use console.error so logs show up (console.log is disabled by logger.ts)
  console.error(`[LightspeedClient] getCustomerSales called with email: ${customerEmail || 'none'}, limit: ${limit || 'ALL'}`);
  
  if (!customerEmail) {
    console.error('[LightspeedClient] No customer email provided, returning empty array');
    return [];
  }
  
  try {
    // Step 1: Find customer by email to get customer_id
    console.error(`[LightspeedClient] Step 1: Finding customer by email...`);
    const customer = await searchCustomersByEmail(customerEmail);
    
    if (!customer || customer.length === 0) {
      console.error(`[LightspeedClient] ⚠️ No customer found with email: ${customerEmail}`);
      return [];
    }
    
    const customerId = customer[0].id;
    console.error(`[LightspeedClient] ✅ Found customer: ${customerId}`);
    
    // Step 2: Fetch ALL sales by customer_id using /search endpoint (this works correctly!)
    console.error(`[LightspeedClient] Step 2: Fetching ALL sales for customer_id: ${customerId}...`);
    
    const allCustomerSales: any[] = [];
    const pageSize = 200;
    let offset = 0;
    let hasMore = true;
    let consecutiveEmpty = 0;
    
    // Paginate through all sales for this customer using /search endpoint
    // This endpoint correctly filters by customer_id, unlike /sales endpoint
    while (hasMore && consecutiveEmpty < 3) {
      try {
        // Use /search endpoint with customer_id filter - THIS IS THE CORRECT ENDPOINT!
        const result = await apiRequest<LightspeedResponse<any[]>>(
          `/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`
        );
        
        const sales = Array.isArray(result.data) ? result.data : [];
        
        if (sales.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) break;
          offset += pageSize;
          continue;
        }
        
        consecutiveEmpty = 0;
        
        // Filter to only closed/completed sales
        const closedSales = sales.filter((sale: any) => 
          sale.status === 'CLOSED' && sale.state === 'closed'
        );
        
        allCustomerSales.push(...closedSales);
        
        console.error(`[LightspeedClient] Fetched ${closedSales.length} closed sales (Total: ${allCustomerSales.length})`);
        
        // If limit is specified and we've reached it, stop
        if (limit && allCustomerSales.length >= limit) {
          allCustomerSales.splice(limit);
          break;
        }
        
        // If we got fewer results than page size, we're done
        if (sales.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`[LightspeedClient] Error fetching sales page: ${error.message}`);
        break;
      }
    }
    
    console.error(`[LightspeedClient] ✅ Fetched ${allCustomerSales.length} total closed sales for customer_id: ${customerId}`);
    
    if (allCustomerSales.length === 0) {
      return [];
    }
    
    // Step 3: Get outlet info for location names
    const outletsResult = await apiRequest<LightspeedResponse<any[]>>('/outlets');
    const outlets = outletsResult.data || [];
    const outletMap = new Map<string, any>();
    outlets.forEach((outlet: any) => {
      if (outlet.id) outletMap.set(outlet.id, outlet);
    });
    
    // Step 4: Get full sale details and format (limit to requested limit if specified)
    const salesToProcess = limit ? allCustomerSales.slice(0, limit) : allCustomerSales;
    const salesWithDetails = await Promise.all(
      salesToProcess.map(async (sale: any) => {
        try {
          // Get full sale details
          const saleDetail = await apiRequest<LightspeedResponse<any>>(`/sales/${sale.id}`);
          const fullSale = saleDetail.data;
          
          const outlet = outletMap.get(fullSale.outlet_id);
          return {
            id: fullSale.id,
            receiptNumber: fullSale.receipt_number || fullSale.invoice_number || fullSale.id,
            dateTime: fullSale.sale_date || fullSale.created_at,
            total: typeof fullSale.total_price_incl === 'number' 
              ? fullSale.total_price_incl 
              : (typeof fullSale.total_price === 'number' ? fullSale.total_price : 0),
            status: fullSale.status || 'completed',
            location: outlet?.name || 'GreenHaus',
            items: fullSale.line_items || [],
            customer: fullSale.customer || customer[0],
          };
        } catch (error) {
          console.error(`[LightspeedClient] Error fetching sale ${sale.id}:`, error);
          return null;
        }
      })
    );
    
    const filteredSales = salesWithDetails.filter(Boolean);
    console.error(`[LightspeedClient] ✅ Returning ${filteredSales.length} formatted sales for ${customerEmail} (ALL TIME)`);
    return filteredSales;
  } catch (error) {
    console.error('[LightspeedClient] getCustomerSales error:', error);
    return [];
  }
}

/**
 * Get store/retailer info
 */
export async function getStoreInfo(): Promise<any> {
  try {
    const result = await apiRequest<LightspeedResponse<any>>('/retailer');
    return result.data;
  } catch (error) {
    console.error('[LightspeedClient] getStoreInfo error:', error);
    return null;
  }
}
