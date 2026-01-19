/**
 * Lightspeed Retail (X-Series) API Service
 * 
 * Centralized service for all Lightspeed API calls.
 * Handles authentication, error handling, and data transformation.
 */

const TOKEN = (process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '').trim();
const DOMAIN_PREFIX = (process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco').trim();
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

// Helpful 401 hint (avoids logging the token)
const LIGHTSPEED_401_HINT = `Check EXPO_PUBLIC_LIGHTSPEED_TOKEN in .env is set and valid. Regenerate at: https://${DOMAIN_PREFIX}.retail.lightspeed.app/setup/api (Personal tokens). For EAS builds, set in project secrets.`;

interface LightspeedResponse<T> {
  data?: T;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
  };
  version?: {
    min: number;
    max: number;
  };
  page_info?: {
    start_cursor?: string;
    end_cursor?: string;
    has_next_page?: boolean;
  };
}

async function apiRequest<T = any>(endpoint: string): Promise<T> {
  if (!TOKEN) {
    throw new Error(
      'EXPO_PUBLIC_LIGHTSPEED_TOKEN is not set. Add it to .env for local dev (see docs/LIGHTSPEED_API_SETUP.md). For EAS builds, set in EAS project secrets.'
    );
  }

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error(`Lightspeed API Error (401): ${body || 'Unauthorized'}. ${LIGHTSPEED_401_HINT}`);
    }
    throw new Error(`Lightspeed API Error (${response.status}): ${body}`);
  }

  return response.json();
}

/**
 * Get store/retailer information
 */
export async function getRetailer() {
  return apiRequest('/retailer');
}

/**
 * Get all outlets (store locations)
 */
export async function getOutlets() {
  const data = await apiRequest<LightspeedResponse<any[]>>('/outlets');
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Get today's sales summary
 */
export async function getTodaySales() {
  const retailer = await getRetailer();
  const storeTimezone = retailer.time_zone || 'America/Chicago';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: storeTimezone });

  const search = await apiRequest<LightspeedResponse<any[]>>(`/search?type=sales&page_size=200`);
  const sales = Array.isArray(search.data) ? search.data : [];

  let saleCount = 0;
  let totalRevenue = 0;
  let lastSaleUtc: Date | null = null;

  for (const sale of sales) {
    if (!sale?.created_at) continue;

    const isClosed = sale.status === 'CLOSED' && sale.state === 'closed';
    if (!isClosed) continue;

    const createdAt = new Date(sale.created_at);
    const saleDayInStore = createdAt.toLocaleDateString('en-CA', { timeZone: storeTimezone });
    if (saleDayInStore !== todayStr) continue;

    const amount = typeof sale.total_price === 'number' ? sale.total_price : 0;
    saleCount += 1;
    totalRevenue += amount;
    if (!lastSaleUtc || createdAt > lastSaleUtc) lastSaleUtc = createdAt;
  }

  return {
    count: saleCount,
    total: totalRevenue,
    average: saleCount > 0 ? totalRevenue / saleCount : 0,
    lastSaleTime: lastSaleUtc,
    storeTimezone,
  };
}

/**
 * Get recent sales with customer and employee details
 */
export async function getRecentSales(limit: number = 10) {
  const search = await apiRequest<LightspeedResponse<any[]>>(`/search?type=sales&page_size=${limit}`);
  const sales = Array.isArray(search.data) ? search.data.slice(0, limit) : [];

  // Get outlets for location names
  const outlets = await getOutlets();
  const outletMap = new Map<string, any>();
  outlets.forEach((outlet: any) => {
    if (outlet.id) outletMap.set(outlet.id, outlet);
  });

  const retailer = await getRetailer();
  const storeTimezone = retailer.time_zone || 'America/Chicago';

  const salesWithDetails = await Promise.all(
    sales.map(async (sale) => {
      let customerName = 'Walk-in';
      let customerId = '';
      let customerPhone = '';
      let employeeName = '';
      let locationName = '';

      // Get customer details
      if (sale.customer_id) {
        try {
          const customerResponse = await apiRequest(`/customers/${sale.customer_id}`);
          const customerData = customerResponse.data || customerResponse;
          customerName = customerData.name || 
            (customerData.first_name && customerData.last_name 
              ? `${customerData.first_name} ${customerData.last_name}` 
              : customerData.first_name || customerData.last_name || 'Walk-in');
          customerId = customerData.customer_code || customerData.id || sale.customer_id;
          customerPhone = customerData.phone || customerData.mobile || customerData.phone_number || '';
        } catch (e) {
          // Customer might not exist
        }
      }

      // Get employee/user details
      if (sale.user_id) {
        try {
          const userResponse = await apiRequest(`/users/${sale.user_id}`);
          const userData = userResponse.data || userResponse;
          employeeName = userData.display_name || userData.username || userData.name || 
            (userData.first_name && userData.last_name 
              ? `${userData.first_name} ${userData.last_name}` 
              : userData.first_name || '');
        } catch (e) {
          // User might not exist
        }
      }

      // Get location name
      if (sale.outlet_id) {
        const outlet = outletMap.get(sale.outlet_id);
        if (outlet) {
          locationName = outlet.name || '';
        }
      }

      const saleDate = sale.created_at ? new Date(sale.created_at) : new Date();
      const saleDateLocal = saleDate.toLocaleString('en-US', { 
        timeZone: storeTimezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const saleTotal = typeof sale.total_price_incl === 'number'
        ? sale.total_price_incl
        : typeof sale.total_price === 'number'
          ? sale.total_price
          : 0;

      return {
        id: sale.id,
        receiptNumber: sale.receipt_number || sale.invoice_number || sale.id?.substring(0, 8) || 'N/A',
        dateTime: saleDateLocal,
        createdAt: sale.created_at,
        customer: {
          name: customerName,
          id: customerId,
          phone: customerPhone,
        },
        employee: {
          name: employeeName,
        },
        location: locationName,
        total: saleTotal,
        totalExclTax: typeof sale.total_price === 'number' ? sale.total_price : 0,
        totalTax: typeof sale.total_tax === 'number' ? sale.total_tax : 0,
        status: sale.status || sale.state || 'N/A',
        note: sale.note || '',
      };
    })
  );

  return salesWithDetails;
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string) {
  const response = await apiRequest(`/customers/${customerId}`);
  return response.data || response;
}

/**
 * Search customers
 */
export async function searchCustomers(query: string, limit: number = 20) {
  try {
    // First try the search endpoint
    const search = await apiRequest<LightspeedResponse<any[]>>(
      `/search?type=customers&q=${encodeURIComponent(query)}&page_size=${limit}`
    );
    const searchResults = Array.isArray(search.data) ? search.data : [];

    if (searchResults.length > 0) {
      return searchResults;
    }

    // If search returns nothing, try /customers endpoint as fallback
    const customers = await apiRequest<LightspeedResponse<any[]>>(
      `/customers?email=${encodeURIComponent(query)}&page_size=${limit}`
    );
    const customersResults = Array.isArray(customers.data) ? customers.data : [];

    return customersResults;
  } catch (error) {
    console.error('[Lightspeed] Error searching customers:', error);
    return [];
  }
}

/**
 * Get products
 */
export async function getProducts(page: number = 1, pageSize: number = 50) {
  const data = await apiRequest<LightspeedResponse<any[]>>(
    `/products?page=${page}&page_size=${pageSize}`
  );
  return {
    products: Array.isArray(data.data) ? data.data : [],
    pagination: data.pagination,
  };
}

/**
 * Get inventory for a specific outlet
 */
export async function getInventory(outletId?: string, page: number = 1, pageSize: number = 50) {
  let endpoint = `/inventory?page=${page}&page_size=${pageSize}`;
  if (outletId) {
    endpoint += `&outlet_id=${outletId}`;
  }
  const data = await apiRequest<LightspeedResponse<any[]>>(endpoint);
  return {
    inventory: Array.isArray(data.data) ? data.data : [],
    pagination: data.pagination,
  };
}
