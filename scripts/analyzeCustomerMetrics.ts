#!/usr/bin/env node
/**
 * Customer Analytics & Segmentation Script (UPDATED)
 * 
 * Analyzes all customers with their order history to calculate:
 * - Lifetime Value (LTV)
 * - Average Order Value (AOV)
 * - Repeat order count
 * - Days since last purchase
 * - Customer segments (VIP, Inactive 30/60/90, etc.)
 * - Deduplicates customer records
 * 
 * Usage: npx tsx scripts/analyzeCustomerMetrics.ts [--reuse-customers]
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

// Check for flags
const REUSE_CUSTOMERS = process.argv.includes('--reuse-customers');
const USE_CACHE = process.argv.includes('--cache') || true; // Default to true
const CACHE_DIR = path.join(process.cwd(), '.analytics-cache');

// Segment thresholds
const VIP_THRESHOLD = 1000; // $1000+ lifetime spend = VIP
const HIGH_VALUE_THRESHOLD = 500; // $500+ = High Value
const INACTIVE_30_DAYS = 30;
const INACTIVE_60_DAYS = 60;
const INACTIVE_90_DAYS = 90;

// Cache the online/eCom register ID so we don't fetch registers for every customer
let ONLINE_REGISTER_ID: string | null | undefined = undefined;

async function getOnlineRegisterId(): Promise<string | null> {
  if (ONLINE_REGISTER_ID !== undefined) {
    return ONLINE_REGISTER_ID;
  }
  try {
    const registers = await apiRequest('/registers');
    const registerList = Array.isArray(registers.data) ? registers.data : [];
    const onlineRegister = registerList.find((r: any) => {
      const name = (r.name || '').toLowerCase();
      return name.includes('online') || name.includes('ecom');
    });
    ONLINE_REGISTER_ID = onlineRegister ? onlineRegister.id : null;
  } catch (e) {
    ONLINE_REGISTER_ID = null;
  }
  return ONLINE_REGISTER_ID;
}

interface CustomerMetrics {
  customerId: string;
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  // Metrics
  lifetimeValue: number;
  orderCount: number;
  averageOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  // Segments
  isVIP: boolean;
  isHighValue: boolean;
  inactiveSegment: string; // 'active', '30d', '60d', '90d'
  // Tier (for ambassador program - based on referrals, but we'll track spend too)
  tier: string;
  referredSales: number; // Will be 0 until referral tracking is set up
  // Deduplication info
  duplicateIds?: string[]; // IDs of merged duplicate records
  isDuplicate?: boolean; // True if this is a duplicate that was merged
}

async function apiRequest<T = any>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error.substring(0, 200)}`);
  }

  return response.json();
}

/**
 * Get cache file path for a customer's sales
 */
function getSalesCachePath(customerId: string): string {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  return path.join(CACHE_DIR, `sales_${customerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
}

/**
 * Load cached sales for a customer
 */
function loadCachedSales(customerId: string): any[] | null {
  if (!USE_CACHE) return null;
  
  try {
    const cachePath = getSalesCachePath(customerId);
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      // Cache valid for 24 hours
      if (ageHours < 24) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        return cached.sales || null;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }
  return null;
}

/**
 * Save sales to cache
 */
function saveCachedSales(customerId: string, sales: any[]): void {
  if (!USE_CACHE) return;
  
  try {
    const cachePath = getSalesCachePath(customerId);
    fs.writeFileSync(cachePath, JSON.stringify({
      customerId,
      sales,
      cachedAt: new Date().toISOString(),
    }), 'utf-8');
  } catch (e) {
    // Ignore cache errors
  }
}

/**
 * Load existing customers from CSV if available
 */
function loadExistingCustomers(): any[] | null {
  if (!REUSE_CUSTOMERS) return null;
  
  // Find the most recent all_customers CSV
  const files = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('all_customers_') && f.endsWith('.csv'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.log('   ⚠️  No existing customer CSV found, will fetch from API\n');
    return null;
  }
  
  const latestFile = files[0];
  console.log(`   📂 Loading customers from: ${latestFile}\n`);
  
  try {
    const content = fs.readFileSync(latestFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    
    // Find column indices
    const idIdx = headers.findIndex(h => h.toLowerCase().includes('id') && !h.toLowerCase().includes('code'));
    const codeIdx = headers.findIndex(h => h.toLowerCase().includes('code'));
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name'));
    const emailIdx = headers.findIndex(h => h.toLowerCase().includes('email'));
    const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone'));
    
    const customers: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, ''));
      if (values[idIdx]) {
        customers.push({
          id: values[idIdx],
          customer_code: values[codeIdx] || '',
          name: values[nameIdx] || '',
          email: values[emailIdx] || '',
          phone: values[phoneIdx] || '',
        });
      }
    }
    
    console.log(`   ✅ Loaded ${customers.length} customers from CSV\n`);
    return customers;
  } catch (error: any) {
    console.log(`   ⚠️  Error loading CSV: ${error.message}, will fetch from API\n`);
    return null;
  }
}

async function getAllCustomers(): Promise<any[]> {
  console.log('📥 Fetching all customers...\n');
  
  // Try to load existing customers first
  const existingCustomers = loadExistingCustomers();
  if (existingCustomers) {
    return existingCustomers;
  }
  
  const firstPage = await apiRequest(`/search?type=customers&page_size=1`);
  const totalCount = firstPage.total_count || 0;
  console.log(`   Total customers: ${totalCount}\n`);
  
  const allCustomers: any[] = [];
  const pageSize = 200;
  let offset = 0;

  while (offset < totalCount) {
    const data = await apiRequest(`/search?type=customers&page_size=${pageSize}&offset=${offset}`);
    const customers = Array.isArray(data.data) ? data.data : [];
    allCustomers.push(...customers);
    
    const progress = ((allCustomers.length / totalCount) * 100).toFixed(1);
    process.stdout.write(`\r   Fetched: ${allCustomers.length}/${totalCount} (${progress}%)`);
    
    offset += pageSize;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ Fetched ${allCustomers.length} customers\n`);
  return allCustomers;
}

/**
 * Deduplicate customers by email and phone
 * Merges duplicate records into a single customer record
 */
function deduplicateCustomers(customers: any[]): any[] {
  console.log('🔍 Deduplicating customers...\n');
  
  const emailMap = new Map<string, any[]>();
  const phoneMap = new Map<string, any[]>();
  const seenIds = new Set<string>();
  const deduplicated: any[] = [];
  
  // Group by email and phone
  // IMPORTANT: Only group by REAL emails/phones, not empty strings
  for (const customer of customers) {
    const email = (customer.email || '').toLowerCase().trim();
    const phone = (customer.phone || customer.mobile || customer.phone_number || '').replace(/\D/g, '');

    // Only group by email if it's a real email (not empty)
    if (email && email.includes('@')) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(customer);
    }

    // Only group by phone if it's a real phone (10+ digits)
    if (phone && phone.length >= 10) {
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone)!.push(customer);
    }
  }
  
  // Find duplicates - also cross-reference email and phone
  const duplicateGroups = new Map<string, any[]>();
  const customerToGroup = new Map<string, string>(); // Maps customer ID to group key
  
  // Group by email
  for (const [email, group] of emailMap.entries()) {
    if (group.length > 1) {
      const key = `email:${email}`;
      duplicateGroups.set(key, group);
      group.forEach(c => customerToGroup.set(c.id, key));
    }
  }
  
  // Group by phone
  for (const [phone, group] of phoneMap.entries()) {
    if (group.length > 1) {
      const key = `phone:${phone}`;
      
      // Check if any customer in this phone group is already in an email group
      let merged = false;
      for (const customer of group) {
        const existingKey = customerToGroup.get(customer.id);
        if (existingKey && duplicateGroups.has(existingKey)) {
          // Merge into existing group
          const existing = duplicateGroups.get(existingKey)!;
          for (const c of group) {
            if (!existing.find((ec: any) => ec.id === c.id)) {
              existing.push(c);
              customerToGroup.set(c.id, existingKey);
            }
          }
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        duplicateGroups.set(key, group);
        group.forEach(c => customerToGroup.set(c.id, key));
      }
    }
  }
  
  // Now cross-reference: Build a map of email->phone and phone->email relationships
  // This helps us find customers that should be merged even if they don't share identifiers
  const crossReferenceMap = new Map<string, Set<string>>(); // email -> Set<phone>
  const phoneToEmailMap = new Map<string, Set<string>>(); // phone -> Set<email>
  
  // First pass: Build the cross-reference from customers that have BOTH email and phone
  // IMPORTANT: Only cross-reference REAL data (email must have @, phone must be 10+ digits)
  for (const customer of customers) {
    const email = (customer.email || '').toLowerCase().trim();
    const phone = (customer.phone || customer.mobile || customer.phone_number || '').replace(/\D/g, '');

    // Only cross-reference if BOTH are real (email has @, phone is 10+ digits)
    if (email && email.includes('@') && phone && phone.length >= 10) {
      if (!crossReferenceMap.has(email)) crossReferenceMap.set(email, new Set());
      crossReferenceMap.get(email)!.add(phone);

      if (!phoneToEmailMap.has(phone)) phoneToEmailMap.set(phone, new Set());
      phoneToEmailMap.get(phone)!.add(email);
    }
  }
  
  // Second pass: For customers with ONLY email, check if their email is linked to a phone
  // For customers with ONLY phone, check if their phone is linked to an email
  // This finds cases where the same person has two separate records
  
  // Find customers that should be merged based on email-phone cross-reference
  // This handles cases where one record has email and another has phone for the same person
  for (const customer of customers) {
    const email = (customer.email || '').toLowerCase().trim();
    const phone = (customer.phone || customer.mobile || customer.phone_number || '').replace(/\D/g, '');
    const customerId = customer.id;
    
    // Skip if already in a duplicate group
    if (customerToGroup.has(customerId)) continue;
    
    // If customer has ONLY email (no phone), find customers with phones that match known email-phone pairs
    if (email && (!phone || phone.length < 10)) {
      // Check if this email is known to be associated with any phone
      if (crossReferenceMap.has(email)) {
        const knownPhones = crossReferenceMap.get(email)!;
        for (const knownPhone of knownPhones) {
          const phoneCustomers = phoneMap.get(knownPhone) || [];
          for (const phoneCustomer of phoneCustomers) {
            if (phoneCustomer.id !== customerId && !customerToGroup.has(phoneCustomer.id)) {
              // Check if phone customer has no email (or different email) - likely same person
              const phoneCustomerEmail = (phoneCustomer.email || '').toLowerCase().trim();
              if (!phoneCustomerEmail || phoneCustomerEmail !== email) {
                // These should be merged - create or add to group
                const key = `cross:${email}:${knownPhone}`;
                if (!duplicateGroups.has(key)) {
                  duplicateGroups.set(key, [customer, phoneCustomer]);
                  customerToGroup.set(customer.id, key);
                  customerToGroup.set(phoneCustomer.id, key);
                } else {
                  // Add to existing group
                  const existing = duplicateGroups.get(key)!;
                  if (!existing.find((c: any) => c.id === customer.id)) existing.push(customer);
                  if (!existing.find((c: any) => c.id === phoneCustomer.id)) existing.push(phoneCustomer);
                  customerToGroup.set(customer.id, key);
                  customerToGroup.set(phoneCustomer.id, key);
                }
              }
            }
          }
        }
      }
    }
    
    // If customer has ONLY phone (no email), find customers with emails that match known phone-email pairs
    if (phone && phone.length >= 10 && (!email || email === '')) {
      // Check if this phone is known to be associated with any email
      if (phoneToEmailMap.has(phone)) {
        const knownEmails = phoneToEmailMap.get(phone)!;
        for (const knownEmail of knownEmails) {
          const emailCustomers = emailMap.get(knownEmail) || [];
          for (const emailCustomer of emailCustomers) {
            if (emailCustomer.id !== customerId && !customerToGroup.has(emailCustomer.id)) {
              // Check if email customer has no phone (or different phone) - likely same person
              const emailCustomerPhone = (emailCustomer.phone || emailCustomer.mobile || emailCustomer.phone_number || '').replace(/\D/g, '');
              if (!emailCustomerPhone || emailCustomerPhone !== phone) {
                // These should be merged
                const key = `cross:${knownEmail}:${phone}`;
                if (!duplicateGroups.has(key)) {
                  duplicateGroups.set(key, [customer, emailCustomer]);
                  customerToGroup.set(customer.id, key);
                  customerToGroup.set(emailCustomer.id, key);
                } else {
                  // Add to existing group
                  const existing = duplicateGroups.get(key)!;
                  if (!existing.find((c: any) => c.id === customer.id)) existing.push(customer);
                  if (!existing.find((c: any) => c.id === emailCustomer.id)) existing.push(emailCustomer);
                  customerToGroup.set(customer.id, key);
                  customerToGroup.set(emailCustomer.id, key);
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Merge duplicates - keep the customer with most complete data
  for (const [key, group] of duplicateGroups.entries()) {
    if (group.length > 1) {
      // Sort by: has email, has phone, has name, created_at (newest first)
      group.sort((a, b) => {
        const aScore = (a.email ? 1000 : 0) + (a.phone || a.mobile ? 100 : 0) + (a.name ? 10 : 0);
        const bScore = (b.email ? 1000 : 0) + (b.phone || b.mobile ? 100 : 0) + (b.name ? 10 : 0);
        if (aScore !== bScore) return bScore - aScore;
        
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
      
      const primary = group[0];
      const duplicates = group.slice(1);
      
      // Merge data from duplicates into primary
      // IMPORTANT: Always merge email and phone - keep BOTH if they exist
      for (const dup of duplicates) {
        // Merge email (keep both if different, prefer non-empty)
        if (dup.email && (!primary.email || primary.email.trim() === '')) {
          primary.email = dup.email;
        } else if (primary.email && dup.email && primary.email.toLowerCase() !== dup.email.toLowerCase()) {
          // Both have emails - keep the primary but note the duplicate
          primary._alternateEmail = dup.email;
        }
        
        // Merge phone (keep both if different, prefer non-empty)
        const dupPhone = dup.phone || dup.mobile || dup.phone_number || '';
        const primaryPhone = primary.phone || primary.mobile || primary.phone_number || '';
        if (dupPhone && (!primaryPhone || primaryPhone.trim() === '')) {
          primary.phone = dupPhone;
          if (!primary.mobile) primary.mobile = dupPhone;
        } else if (primaryPhone && dupPhone && primaryPhone.replace(/\D/g, '') !== dupPhone.replace(/\D/g, '')) {
          // Both have phones - keep the primary but note the duplicate
          primary._alternatePhone = dupPhone;
        }
        
        // Merge name fields
        if (!primary.name && dup.name) primary.name = dup.name;
        if (!primary.first_name && dup.first_name) primary.first_name = dup.first_name;
        if (!primary.last_name && dup.last_name) primary.last_name = dup.last_name;
      }
      
      // If we have alternate email/phone, combine them
      if (primary._alternateEmail && primary.email) {
        // Combine emails (comma-separated if different)
        if (primary.email.toLowerCase() !== primary._alternateEmail.toLowerCase()) {
          primary.email = `${primary.email}, ${primary._alternateEmail}`;
        }
      }
      if (primary._alternatePhone && (primary.phone || primary.mobile)) {
        // Combine phones (comma-separated if different)
        const currentPhone = primary.phone || primary.mobile || '';
        const altPhone = primary._alternatePhone.replace(/\D/g, '');
        const currentPhoneClean = currentPhone.replace(/\D/g, '');
        if (altPhone !== currentPhoneClean) {
          primary.phone = `${currentPhone}, ${primary._alternatePhone}`;
          if (primary.mobile) primary.mobile = primary.phone;
        }
      }
      
      // Mark duplicates
      primary._duplicateIds = duplicates.map((d: any) => d.id);
      primary._isDeduplicated = true;
      
      // Mark duplicates as seen
      duplicates.forEach((d: any) => seenIds.add(d.id));
    }
  }
  
  // Add all customers (excluding duplicates)
  for (const customer of customers) {
    if (!seenIds.has(customer.id)) {
      deduplicated.push(customer);
    }
  }
  
  const duplicateCount = customers.length - deduplicated.length;
  console.log(`   Found ${duplicateGroups.size} duplicate groups`);
  console.log(`   Merged ${duplicateCount} duplicate records`);
  console.log(`   Final customer count: ${deduplicated.length} (was ${customers.length})\n`);
  
  return deduplicated;
}

/**
 * Get all sales for a specific customer using the correct endpoint
 * Also identifies eCom orders (they have source field starting with "ecw:")
 * If customer has duplicate IDs, fetches sales from ALL of them
 */
async function getCustomerSales(customer: any): Promise<any[]> {
  const customerId = customer.id;
  const duplicateIds = customer._duplicateIds || [];
  const allCustomerIds = [customerId, ...duplicateIds];
  
  // Try to load from cache first (only for primary customer ID, not duplicates)
  const cachedSales = loadCachedSales(customerId);
  if (cachedSales && duplicateIds.length === 0) {
    return cachedSales;
  }
  
  const allSales: any[] = [];
  const pageSize = 200;
  
  const onlineRegisterId = await getOnlineRegisterId();
  
  // Fetch sales from ALL customer IDs (primary + duplicates)
  for (const id of allCustomerIds) {
    let offset = 0;
    let hasMore = true;
    let consecutiveEmpty = 0;
    
    while (hasMore && consecutiveEmpty < 3) {
      try {
        // Use /search endpoint with customer_id - THIS IS THE CORRECT ENDPOINT!
        const result = await apiRequest(`/search?type=sales&customer_id=${id}&page_size=${pageSize}&offset=${offset}`);
        const sales = Array.isArray(result.data) ? result.data : [];
        
        if (sales.length === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) break;
          offset += pageSize;
          continue;
        }
        
        consecutiveEmpty = 0;
        
        // Include all sales (not just closed) to match dashboard count
        // Dashboard shows all orders regardless of status
        const allValidSales = sales.filter((sale: any) => {
          // Include closed, dispatched, picked up, and pending orders
          // Exclude only cancelled/voided
          const status = sale.status || '';
          const state = sale.state || '';
          return !status.includes('CANCELLED') && !status.includes('VOID') && 
                 !state.includes('cancelled') && !state.includes('void');
        });
        
        // Mark eCom orders
        const salesWithSource = allValidSales.map((sale: any) => {
          const isEcom = 
            (sale.source && String(sale.source).startsWith('ecw:')) ||
            (onlineRegisterId && sale.register_id === onlineRegisterId) ||
            (sale.note && (sale.note.toLowerCase().includes('order id') || sale.note.toLowerCase().includes('ecom')));
          
          return {
            ...sale,
            _isEcomOrder: isEcom,
          };
        });
        
        allSales.push(...salesWithSource);
        
        if (sales.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
      } catch (error: any) {
        console.error(`\n   ❌ Error fetching sales for customer ${id}: ${error.message}`);
        break;
      }
    }
  }
  
  // Remove duplicates (same sale ID) - in case same sale appears for multiple customer IDs
  const uniqueSales = new Map<string, any>();
  for (const sale of allSales) {
    if (sale.id && !uniqueSales.has(sale.id)) {
      uniqueSales.set(sale.id, sale);
    }
  }

  // Cache the sales for the primary customer ID (skip duplicates to avoid overwriting)
  if (duplicateIds.length === 0) {
    saveCachedSales(customerId, Array.from(uniqueSales.values()));
  }
  
  return Array.from(uniqueSales.values());
}

function calculateCustomerMetrics(
  customer: any,
  sales: any[]
): CustomerMetrics {
  // Separate eCom and retail orders
  const ecomOrders = sales.filter((s: any) => s._isEcomOrder);
  const retailOrders = sales.filter((s: any) => !s._isEcomOrder);
  
  // Calculate metrics from ALL orders (eCom + Retail)
  let lifetimeValue = 0;
  let firstOrderDate: Date | null = null;
  let lastOrderDate: Date | null = null;
  
  for (const sale of sales) {
    const amount = typeof sale.total_price_incl === 'number' 
      ? sale.total_price_incl 
      : (typeof sale.total_price === 'number' ? sale.total_price : 0);
    lifetimeValue += amount;
    
    if (sale.created_at) {
      const saleDate = new Date(sale.created_at);
      if (!firstOrderDate || saleDate < firstOrderDate) {
        firstOrderDate = saleDate;
      }
      if (!lastOrderDate || saleDate > lastOrderDate) {
        lastOrderDate = saleDate;
      }
    }
  }
  
  const orderCount = sales.length;
  const averageOrderValue = orderCount > 0 ? lifetimeValue / orderCount : 0;
  
  // Calculate days since last order
  const now = new Date();
  const daysSinceLastOrder = lastOrderDate 
    ? Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  // Determine segments
  const isVIP = lifetimeValue >= VIP_THRESHOLD;
  const isHighValue = lifetimeValue >= HIGH_VALUE_THRESHOLD && !isVIP;
  
  let inactiveSegment = 'active';
  if (daysSinceLastOrder !== null) {
    if (daysSinceLastOrder >= INACTIVE_90_DAYS) {
      inactiveSegment = '90d';
    } else if (daysSinceLastOrder >= INACTIVE_60_DAYS) {
      inactiveSegment = '60d';
    } else if (daysSinceLastOrder >= INACTIVE_30_DAYS) {
      inactiveSegment = '30d';
    }
  }
  
  // Tier (for now, based on spend - will be referral-based later)
  let tier = 'None';
  if (lifetimeValue >= 1500) tier = 'Evergreen';
  else if (lifetimeValue >= 750) tier = 'Bloom';
  else if (lifetimeValue >= 250) tier = 'Sprout';
  else if (orderCount > 0) tier = 'Seed';
  
  const name = customer.name || 
    (customer.first_name && customer.last_name 
      ? `${customer.first_name} ${customer.last_name}` 
      : customer.first_name || customer.last_name || 'Unknown');

  // Handle combined email/phone (from merged duplicates)
  let email = customer.email || '';
  let phone = customer.phone || customer.mobile || customer.phone_number || '';
  
  // If email/phone contains comma, it's already combined from duplicates - keep as is
  // Otherwise, ensure we have both if available from alternate fields
  if (!email && customer._alternateEmail) email = customer._alternateEmail;
  if (!phone && customer._alternatePhone) phone = customer._alternatePhone;
  
  return {
    customerId: customer.id || '',
    customerCode: customer.customer_code || customer.id || '',
    name,
    email: email,
    phone: phone,
    lifetimeValue,
    orderCount,
    averageOrderValue,
    firstOrderDate: firstOrderDate ? firstOrderDate.toISOString().split('T')[0] : null,
    lastOrderDate: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : null,
    daysSinceLastOrder,
    isVIP,
    isHighValue,
    inactiveSegment,
    tier,
    referredSales: 0,
    duplicateIds: customer._duplicateIds,
    isDuplicate: customer._isDeduplicated || false,
    ecomOrderCount: ecomOrders.length,
    retailOrderCount: retailOrders.length,
  };
}

async function main() {
  console.log('📊 CUSTOMER ANALYTICS & SEGMENTATION (UPDATED)');
  console.log('═'.repeat(60));
  console.log(`🌐 Store: ${DOMAIN_PREFIX}.retail.lightspeed.app`);
  if (REUSE_CUSTOMERS) {
    console.log(`♻️  Reusing existing customer data\n`);
  } else {
    console.log(`🆕 Fetching fresh customer data\n`);
  }

  if (!TOKEN) {
    console.error('❌ ERROR: No token set in .env!');
    process.exit(1);
  }

  try {
    // Step 1: Get all customers (or load from CSV)
    const customers = await getAllCustomers();
    
    // Step 2: Deduplicate customers
    const deduplicatedCustomers = deduplicateCustomers(customers);
    
    // Step 3: Fetch sales for each customer (using correct endpoint)
    console.log('📥 Fetching sales for each customer (this may take a while)...\n');
    const customerMetrics: CustomerMetrics[] = [];
    
    let cachedCount = 0;
    let fetchedCount = 0;
    
    for (let i = 0; i < deduplicatedCustomers.length; i++) {
      const customer = deduplicatedCustomers[i];
      
      // Check if we have cached sales
      const cachedSales = loadCachedSales(customer.id);
      let sales: any[];
      
      if (cachedSales && (!customer._duplicateIds || customer._duplicateIds.length === 0)) {
        sales = cachedSales;
        cachedCount++;
      } else {
        sales = await getCustomerSales(customer);
        fetchedCount++;
      }
      
      const metrics = calculateCustomerMetrics(customer, sales);
      customerMetrics.push(metrics);
      
      if ((i + 1) % 50 === 0 || i === deduplicatedCustomers.length - 1) {
        const progress = ((i + 1) / deduplicatedCustomers.length * 100).toFixed(1);
        process.stdout.write(`\r   Processed: ${i + 1}/${deduplicatedCustomers.length} (${progress}%) | Cached: ${cachedCount} | Fetched: ${fetchedCount}`);
      }
      
      // Small delay to avoid rate limiting (only for API calls)
      if (!cachedSales && i < deduplicatedCustomers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`\n   ✅ Used cache: ${cachedCount} customers | Fetched from API: ${fetchedCount} customers`);
    
    console.log(`\r   Processed: ${customerMetrics.length} customers                    \n`);
    
    // Step 3.5: Validate data integrity - remove any placeholder emails that slipped through
    console.log('🔍 Validating data integrity...\n');

    // Build email frequency map to detect placeholder emails
    const emailFrequency = new Map<string, number>();
    for (const metric of customerMetrics) {
      const email = (metric.email || '').toLowerCase().trim();
      if (email && email.includes('@')) {
        emailFrequency.set(email, (emailFrequency.get(email) || 0) + 1);
      }
    }

    // Remove any email that appears on multiple customers (these are placeholders)
    let placeholderEmailsRemoved = 0;
    for (const metric of customerMetrics) {
      const email = (metric.email || '').toLowerCase().trim();
      if (email && emailFrequency.get(email)! > 1) {
        metric.email = '';
        placeholderEmailsRemoved++;
      }
    }

    if (placeholderEmailsRemoved > 0) {
      console.log(`   ⚠️  Removed ${placeholderEmailsRemoved} placeholder emails\n`);
    } else {
      console.log(`   ✅ No placeholder emails detected\n`);
    }
    
    // Step 4: Generate summary statistics
    console.log('📊 ANALYTICS SUMMARY');
    console.log('═'.repeat(60));
    
    const customersWithOrders = customerMetrics.filter(m => m.orderCount > 0);
    const totalLTV = customerMetrics.reduce((sum, m) => sum + m.lifetimeValue, 0);
    const avgLTV = customersWithOrders.length > 0 
      ? totalLTV / customersWithOrders.length 
      : 0;
    const avgAOV = customersWithOrders.length > 0
      ? customerMetrics.reduce((sum, m) => sum + m.averageOrderValue, 0) / customersWithOrders.length
      : 0;
    
    const vipCount = customerMetrics.filter(m => m.isVIP).length;
    const highValueCount = customerMetrics.filter(m => m.isHighValue).length;
    const inactive30 = customerMetrics.filter(m => m.inactiveSegment === '30d').length;
    const inactive60 = customerMetrics.filter(m => m.inactiveSegment === '60d').length;
    const inactive90 = customerMetrics.filter(m => m.inactiveSegment === '90d').length;
    
    console.log(`Total Customers: ${customerMetrics.length}`);
    console.log(`Customers with Orders: ${customersWithOrders.length}`);
    console.log(`Total Lifetime Value: $${totalLTV.toFixed(2)}`);
    console.log(`Average LTV: $${avgLTV.toFixed(2)}`);
    console.log(`Average AOV: $${avgAOV.toFixed(2)}`);
    console.log(`\nSegments:`);
    console.log(`  VIP ($${VIP_THRESHOLD}+): ${vipCount}`);
    console.log(`  High Value ($${HIGH_VALUE_THRESHOLD}+): ${highValueCount}`);
    console.log(`  Inactive 30d: ${inactive30}`);
    console.log(`  Inactive 60d: ${inactive60}`);
    console.log(`  Inactive 90d+: ${inactive90}`);
    console.log(`\nTiers:`);
    const tierCounts = customerMetrics.reduce((acc, m) => {
      acc[m.tier] = (acc[m.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count}`);
    });
    
    // Step 5: Export to CSV (write directly to master; optional dated backup with --save-dated)
    const date = new Date().toISOString().split('T')[0];
    const masterFilename = 'customer_analytics_master.csv';
    const datedFilename = `customer_analytics_${date}.csv`;
    const saveDated = process.argv.includes('--save-dated');
    
    console.log(`\n💾 Exporting to ${masterFilename}${saveDated ? ` (and ${datedFilename})` : ''}...\n`);
    
    const headers = [
      'Customer ID',
      'Customer Code',
      'Name',
      'Email',
      'Phone',
      'Lifetime Value',
      'Order Count',
      'Average Order Value',
      'First Order Date',
      'Last Order Date',
      'Days Since Last Order',
      'Is VIP',
      'Is High Value',
      'Inactive Segment',
      'Tier',
      'Referred Sales',
      'eCom Order Count',
      'Retail Order Count',
      'Duplicate IDs',
      'Note',
    ];
    
    const rows = customerMetrics.map(m => {
      // Add note if customer has duplicates
      let note = '';
      if (m.duplicateIds && m.duplicateIds.length > 0) {
        note = `Merged ${m.duplicateIds.length} duplicate records`;
      }
      if (m.email && m.orderCount === 0) {
        note += (note ? '; ' : '') + 'No orders found - may have eCom orders not yet synced';
      }
      
      const emailClean = m.email && !isPlaceholderEmail(m.email) ? m.email : '';
      
      const row = [
        m.customerId,
        m.customerCode,
        m.name,
        emailClean,
        m.phone,
        m.lifetimeValue.toFixed(2),
        m.orderCount,
        m.averageOrderValue.toFixed(2),
        m.firstOrderDate || '',
        m.lastOrderDate || '',
        m.daysSinceLastOrder ?? '',
        m.isVIP ? 'Yes' : 'No',
        m.isHighValue ? 'Yes' : 'No',
        m.inactiveSegment,
        m.tier,
        m.referredSales,
        m.ecomOrderCount || 0,
        m.retailOrderCount || 0,
        m.duplicateIds?.join(';') || '',
        note,
      ];
      
      return row;
    });
    
    // Final guard: strip any email that appears on more than one customer
    const emailCounts = new Map<string, number>();
    for (const row of rows) {
      const email = (row[3] || '').toLowerCase().trim();
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    }
    for (const row of rows) {
      const email = (row[3] || '').toLowerCase().trim();
      if (email && (emailCounts.get(email) || 0) > 1) {
        row[3] = '';
      }
    }
    
    // Properly escape CSV fields (quote fields containing commas, quotes, or newlines)
    const escapeCSVField = (field: string): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      // If field contains comma, quote, or newline, quote it and escape internal quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const csv = [
      headers.map(escapeCSVField).join(','),
      ...rows.map(r => r.map(escapeCSVField).join(','))
    ].join('\n');
    
    // Always write to master
    fs.writeFileSync(masterFilename, csv);
    // Optionally also write dated backup if requested
    if (saveDated) {
      fs.writeFileSync(datedFilename, csv);
    }
    
    console.log(`✅ Exported ${customerMetrics.length} customers to ${masterFilename}${saveDated ? ` (and ${datedFilename})` : ''}\n`);
    
    // Note about eCom orders
    console.log('📝 NOTE ABOUT ECOM ORDERS:');
    console.log('═'.repeat(60));
    console.log('   Some eCom (website) orders may not appear in Retail API immediately.');
    console.log('   Lightspeed eCom orders sync to Retail X-Series, but there can be delays.');
    console.log('   If you see missing orders in the dashboard but not in the CSV,');
    console.log('   they may need time to sync or may require eCom API access.\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(60));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
