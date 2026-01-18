/**
 * Lightspeed Customer Lookup Service
 * Looks up customer data by email/phone from Lightspeed
 * and extracts customer segments
 */

import { searchCustomers } from './lightspeed';
import { debugLog } from '@/lib/logger';

export interface CustomerSegments {
  lightspeedCustomerId?: string;
  isVIP?: boolean;
  tier?: string;
  lifetimeValue?: number;
  orderCount?: number;
  lastOrderDate?: string;
  inactiveSegment?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  customerCode?: string;
}

/**
 * Look up customer in Lightspeed by email or phone
 * Returns customer segments and metadata
 */
export async function lookupCustomerByEmail(email: string): Promise<CustomerSegments | null> {
  if (!email) {
    debugLog('⚠️ [LightspeedLookup] No email provided');
    return null;
  }

  try {
    debugLog('🔍 [LightspeedLookup] Searching for customer by email:', email);

    // Search by email
    const customers = await searchCustomers(email, 5);

    if (!customers || customers.length === 0) {
      debugLog('❌ [LightspeedLookup] No customer found for email:', email);
      return null;
    }

    // Find exact email match (case insensitive) - MUST match, no fallback
    const customer = customers.find(
      (c: any) => c.email?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!customer) {
      debugLog('❌ [LightspeedLookup] No matching customer found');
      return null;
    }

    debugLog('✅ [LightspeedLookup] Found customer:', customer.id);

    // Extract customer segments
    const segments = extractCustomerSegments(customer);
    return segments;
  } catch (error) {
    console.error('❌ [LightspeedLookup] Error:', error);
    console.error('❌ [DEBUG] Error message:', (error as Error).message);
    debugLog('❌ [LightspeedLookup] Error looking up customer:', error);
    return null;
  }
}

/**
 * Look up customer in Lightspeed by phone
 * Returns customer segments and metadata
 */
export async function lookupCustomerByPhone(phone: string): Promise<CustomerSegments | null> {
  if (!phone) {
    debugLog('⚠️ [LightspeedLookup] No phone provided');
    return null;
  }

  try {
    debugLog('🔍 [LightspeedLookup] Searching for customer by phone:', phone);

    // Normalize phone number (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Search by phone
    const customers = await searchCustomers(phone, 5);

    if (!customers || customers.length === 0) {
      debugLog('❌ [LightspeedLookup] No customer found for phone:', phone);
      return null;
    }

    // Find exact phone match
    const customer = customers.find((c: any) => {
      const customerPhone = (c.phone || c.mobile || c.phone_number || '').replace(/\D/g, '');
      return customerPhone === normalizedPhone;
    }) || customers[0]; // Fallback to first result

    if (!customer) {
      debugLog('❌ [LightspeedLookup] No matching customer found');
      return null;
    }

    debugLog('✅ [LightspeedLookup] Found customer:', customer.id);

    // Extract customer segments
    const segments = extractCustomerSegments(customer);
    return segments;
  } catch (error) {
    console.error('❌ [LightspeedLookup] Error:', error);
    console.error('❌ [DEBUG] Error message:', (error as Error).message);
    debugLog('❌ [LightspeedLookup] Error looking up customer:', error);
    return null;
  }
}

/**
 * Extract customer segments from Lightspeed customer data
 */
function extractCustomerSegments(customer: any): CustomerSegments {
  // Extract name - try first_name/last_name, fallback to 'name' field, or use email prefix
  const firstName = customer.first_name || customer.name?.split(' ')[0] || customer.email?.split('@')[0] || 'Customer';
  const lastName = customer.last_name || customer.name?.split(' ').slice(1).join(' ') || '';

  const segments: CustomerSegments = {
    lightspeedCustomerId: customer.id,
    email: customer.email || '',
    phone: customer.phone || customer.mobile || customer.phone_number || '',
    firstName: firstName,
    lastName: lastName,
    customerCode: customer.customer_code || '',
  };

  // Extract LTV (lifetime value)
  if (customer.total_spent !== undefined) {
    segments.lifetimeValue = parseFloat(customer.total_spent) || 0;
  } else if (customer.lifetime_value !== undefined) {
    segments.lifetimeValue = parseFloat(customer.lifetime_value) || 0;
  } else if (customer.year_to_date !== undefined) {
    segments.lifetimeValue = parseFloat(customer.year_to_date) || 0;
  }

  // Extract order count
  if (customer.order_count !== undefined) {
    segments.orderCount = parseInt(customer.order_count) || 0;
  } else if (customer.total_orders !== undefined) {
    segments.orderCount = parseInt(customer.total_orders) || 0;
  }

  // Extract last order date
  if (customer.last_order_date) {
    segments.lastOrderDate = customer.last_order_date;
  } else if (customer.updated_at) {
    segments.lastOrderDate = customer.updated_at;
  }

  // Determine tier based on LTV (Seed = first purchase, Sprout = $250+, Bloom = $750+, Evergreen = $1500+)
  if (segments.lifetimeValue !== undefined) {
    if (segments.lifetimeValue >= 1500) {
      segments.tier = 'Evergreen';
    } else if (segments.lifetimeValue >= 750) {
      segments.tier = 'Bloom';
    } else if (segments.lifetimeValue >= 250) {
      segments.tier = 'Sprout';
    } else {
      segments.tier = 'Seed';
    }
  }

  // Determine VIP status (high LTV or high order count)
  if (segments.lifetimeValue && segments.lifetimeValue >= 1500) {
    segments.isVIP = true;
  } else if (segments.orderCount && segments.orderCount >= 20) {
    segments.isVIP = true;
  } else {
    segments.isVIP = false;
  }

  // Determine inactive segment based on last order date
  if (segments.lastOrderDate) {
    const lastOrderTime = new Date(segments.lastOrderDate).getTime();
    const now = Date.now();
    const daysSinceLastOrder = Math.floor((now - lastOrderTime) / (1000 * 60 * 60 * 24));

    if (daysSinceLastOrder >= 90) {
      segments.inactiveSegment = '90d+';
    } else if (daysSinceLastOrder >= 60) {
      segments.inactiveSegment = '60d';
    } else if (daysSinceLastOrder >= 30) {
      segments.inactiveSegment = '30d';
    } else {
      segments.inactiveSegment = 'active';
    }
  }

  debugLog('📊 [LightspeedLookup] Customer segments:', segments);
  return segments;
}

/**
 * Look up customer by email or phone (tries both)
 */
export async function lookupCustomer(
  email?: string,
  phone?: string
): Promise<CustomerSegments | null> {
  // Try email first
  if (email) {
    const segments = await lookupCustomerByEmail(email);
    if (segments) return segments;
  }

  // Fallback to phone
  if (phone) {
    const segments = await lookupCustomerByPhone(phone);
    if (segments) return segments;
  }

  return null;
}
