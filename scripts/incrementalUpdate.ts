#!/usr/bin/env node
/**
 * Incremental Customer Analytics Update
 * 
 * Updates the master customer analytics CSV by:
 * 1. Fetching only customers/sales that have changed since last run
 * 2. Updating existing customer records
 * 3. Adding new customers
 * 4. Recalculating metrics for changed customers only
 * 
 * Designed to run daily (via cron or scheduled task)
 * 
 * Usage: npx tsx scripts/incrementalUpdate.ts [--days N] [--full]
 *   --days N: Only process sales from last N days (default: 7)
 *   --full: Force full update (ignore incremental mode)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

// Get flags
const DAYS_BACK = parseInt(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] || '7');
const FULL_UPDATE = process.argv.includes('--full');

const MASTER_CSV = 'customer_analytics_master.csv';
const LAST_UPDATE_FILE = '.last_update_timestamp';
const CACHE_DIR = path.join(process.cwd(), '.analytics-cache');

interface CustomerRecord {
  customerId: string;
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  lifetimeValue: number;
  orderCount: number;
  avgOrderValue: number;
  firstOrder: string;
  lastOrder: string;
  daysSinceLastOrder: number | null;
  isVIP: boolean;
  isHighValue: boolean;
  inactiveSegment: string;
  tier: string;
  referredSales: number;
  ecomOrderCount?: number;
  retailOrderCount?: number;
  duplicateIds?: string;
  note?: string;
  isFirstTimeBuyer?: string;
  firstTimeBuyerDate?: string;
  daysSinceFirstPurchase?: number | null;
  lastUpdated?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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

function loadMasterCSV(): Map<string, CustomerRecord> {
  const customers = new Map<string, CustomerRecord>();
  
  if (!fs.existsSync(MASTER_CSV)) {
    console.log('   ⚠️  Master CSV not found - will create new one');
    console.log('   💡 Run analyzeCustomerMetrics.ts first to create initial master CSV');
    return customers;
  }
  
  const content = fs.readFileSync(MASTER_CSV, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return customers;
  
  const headers = parseCSVLine(lines[0]);
  const customerIdIdx = headers.indexOf('Customer ID');
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    
    const customerId = values[customerIdIdx] || '';
    if (!customerId) continue;
    
    const record: any = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    
    customers.set(customerId, {
      customerId: record['Customer ID'] || '',
      customerCode: record['Customer Code'] || '',
      name: record['Name'] || '',
      email: record['Email'] || '',
      phone: record['Phone'] || '',
      lifetimeValue: parseFloat(record['Lifetime Value'] || '0') || 0,
      orderCount: parseInt(record['Order Count'] || '0') || 0,
      avgOrderValue: parseFloat(record['Avg Order Value'] || '0') || 0,
      firstOrder: record['First Order'] || '',
      lastOrder: record['Last Order'] || '',
      daysSinceLastOrder: record['Days Since Last Order'] ? parseInt(record['Days Since Last Order']) : null,
      isVIP: record['Is VIP'] === 'Yes',
      isHighValue: record['Is High Value'] === 'Yes',
      inactiveSegment: record['Inactive Segment'] || '',
      tier: record['Tier'] || '',
      referredSales: parseInt(record['Referred Sales'] || '0') || 0,
      ecomOrderCount: parseInt(record['eCom Order Count'] || '0') || 0,
      retailOrderCount: parseInt(record['Retail Order Count'] || '0') || 0,
      duplicateIds: record['Duplicate IDs'] || '',
      note: record['Note'] || '',
      isFirstTimeBuyer: record['Is First Time Buyer'] || undefined,
      firstTimeBuyerDate: record['First Time Buyer Date'] || undefined,
      daysSinceFirstPurchase: record['Days Since First Purchase'] ? parseInt(record['Days Since First Purchase']) : null,
      lastUpdated: record['Last Updated'] || undefined,
    });
  }
  
  return customers;
}

function getLastUpdateTime(): Date {
  if (fs.existsSync(LAST_UPDATE_FILE)) {
    const timestamp = fs.readFileSync(LAST_UPDATE_FILE, 'utf-8').trim();
    return new Date(timestamp);
  }
  // Default to N days ago
  const date = new Date();
  date.setDate(date.getDate() - DAYS_BACK);
  return date;
}

function saveLastUpdateTime() {
  fs.writeFileSync(LAST_UPDATE_FILE, new Date().toISOString());
}

async function getRecentSales(sinceDate: Date): Promise<Map<string, any[]>> {
  // Get sales from the last N days
  const salesByCustomer = new Map<string, any[]>();
  
  console.log(`   📥 Fetching sales since ${sinceDate.toISOString().split('T')[0]}...`);
  
  const pageSize = 200;
  let offset = 0;
  let hasMore = true;
  let totalFetched = 0;
  
  while (hasMore) {
    try {
      const result = await apiRequest(`/search?type=sales&page_size=${pageSize}&offset=${offset}`);
      const sales = Array.isArray(result.data) ? result.data : [];
      
      if (sales.length === 0) {
        hasMore = false;
        break;
      }
      
      // Filter sales by date and status
      const recentSales = sales.filter((sale: any) => {
        if (!sale.created_at || !sale.customer_id) return false;
        
        const saleDate = new Date(sale.created_at);
        if (saleDate < sinceDate) return false;
        
        // Only valid sales (not cancelled/voided)
        const status = (sale.status || '').toLowerCase();
        const state = (sale.state || '').toLowerCase();
        return !status.includes('cancelled') && !status.includes('void') &&
               !state.includes('cancelled') && !state.includes('void');
      });
      
      for (const sale of recentSales) {
        const customerId = sale.customer_id;
        if (!salesByCustomer.has(customerId)) {
          salesByCustomer.set(customerId, []);
        }
        salesByCustomer.get(customerId)!.push(sale);
      }
      
      totalFetched += sales.length;
      
      // If we got fewer results than page size, we're done
      if (sales.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
      
      // If oldest sale is before our date, we can stop
      const oldestSale = sales[sales.length - 1];
      if (oldestSale?.created_at) {
        const oldestDate = new Date(oldestSale.created_at);
        if (oldestDate < sinceDate) {
          hasMore = false;
        }
      }
      
      await new Promise(r => setTimeout(r, 50));
    } catch (error: any) {
      console.error(`   ⚠️  Error fetching sales: ${error.message}`);
      hasMore = false;
    }
  }
  
  console.log(`   ✅ Found ${salesByCustomer.size} customers with recent sales (${totalFetched} total sales fetched)`);
  
  return salesByCustomer;
}

async function getCustomerSales(customerId: string): Promise<any[]> {
  // Check cache first
  const cacheFile = path.join(CACHE_DIR, `sales_${customerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
  if (fs.existsSync(cacheFile)) {
    const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const cacheAge = Date.now() - cacheData.timestamp;
    // Use cache if less than 24 hours old
    if (cacheAge < 24 * 60 * 60 * 1000) {
      return cacheData.sales;
    }
  }
  
  // Fetch from API
  const allSales: any[] = [];
  const pageSize = 200;
  let offset = 0;
  let consecutiveEmpty = 0;
  
  while (consecutiveEmpty < 3) {
    try {
      const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`);
      const sales = Array.isArray(result.data) ? result.data : [];
      
      if (sales.length === 0) {
        consecutiveEmpty++;
        offset += pageSize;
        continue;
      }
      
      consecutiveEmpty = 0;
      
      const validSales = sales.filter((s: any) => {
        const status = (s.status || '').toLowerCase();
        const state = (s.state || '').toLowerCase();
        return !status.includes('cancelled') && !status.includes('void') &&
               !state.includes('cancelled') && !state.includes('void');
      });
      
      allSales.push(...validSales);
      
      if (sales.length < pageSize) break;
      offset += pageSize;
      await new Promise(r => setTimeout(r, 50));
    } catch (error) {
      break;
    }
  }
  
  // Save to cache
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(cacheFile, JSON.stringify({
    timestamp: Date.now(),
    sales: allSales,
  }));
  
  return allSales;
}

function calculateMetrics(sales: any[]): {
  lifetimeValue: number;
  orderCount: number;
  avgOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  isVIP: boolean;
  isHighValue: boolean;
  inactiveSegment: string;
  tier: string;
} {
  if (sales.length === 0) {
    return {
      lifetimeValue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      firstOrderDate: null,
      lastOrderDate: null,
      daysSinceLastOrder: null,
      isVIP: false,
      isHighValue: false,
      inactiveSegment: 'active',
      tier: 'None',
    };
  }
  
  let lifetimeValue = 0;
  let firstOrderDate: Date | null = null;
  let lastOrderDate: Date | null = null;
  
  for (const sale of sales) {
    const amount = sale.total_price_incl || sale.total_price || 0;
    lifetimeValue += amount;
    
    const saleDate = sale.created_at ? new Date(sale.created_at) : null;
    if (saleDate) {
      if (!firstOrderDate || saleDate < firstOrderDate) {
        firstOrderDate = saleDate;
      }
      if (!lastOrderDate || saleDate > lastOrderDate) {
        lastOrderDate = saleDate;
      }
    }
  }
  
  const orderCount = sales.length;
  const avgOrderValue = orderCount > 0 ? lifetimeValue / orderCount : 0;
  
  const daysSinceLastOrder = lastOrderDate
    ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  const isVIP = lifetimeValue >= 1000;
  const isHighValue = lifetimeValue >= 500 && lifetimeValue < 1000;
  
  let inactiveSegment = 'active';
  if (daysSinceLastOrder !== null) {
    if (daysSinceLastOrder >= 90) inactiveSegment = '90d';
    else if (daysSinceLastOrder >= 60) inactiveSegment = '60d';
    else if (daysSinceLastOrder >= 30) inactiveSegment = '30d';
  }
  
  let tier = 'None';
  if (lifetimeValue >= 1500) tier = 'Evergreen';
  else if (lifetimeValue >= 750) tier = 'Bloom';
  else if (lifetimeValue >= 250) tier = 'Sprout';
  else if (orderCount > 0) tier = 'Seed';
  
  return {
    lifetimeValue,
    orderCount,
    avgOrderValue,
    firstOrderDate: firstOrderDate ? firstOrderDate.toISOString().split('T')[0] : null,
    lastOrderDate: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : null,
    daysSinceLastOrder,
    isVIP,
    isHighValue,
    inactiveSegment,
    tier,
  };
}

async function main() {
  console.log('🔄 INCREMENTAL CUSTOMER ANALYTICS UPDATE');
  console.log('════════════════════════════════════════════════════════════\n');
  
  if (!TOKEN) {
    console.error('❌ Missing EXPO_PUBLIC_LIGHTSPEED_TOKEN');
    process.exit(1);
  }
  
  // Load existing master CSV
  console.log('📂 Loading master CSV...');
  const masterCustomers = loadMasterCSV();
  console.log(`   ✅ Loaded ${masterCustomers.size} existing customers\n`);
  
  // Determine update window
  const sinceDate = FULL_UPDATE 
    ? new Date(0) // Full update - get everything
    : getLastUpdateTime();
  
  console.log(`📅 Update window: ${FULL_UPDATE ? 'FULL UPDATE' : `Last ${DAYS_BACK} days (since ${sinceDate.toISOString().split('T')[0]})`}\n`);
  
  // Get recent sales
  const recentSalesByCustomer = await getRecentSales(sinceDate);
  
  if (recentSalesByCustomer.size === 0) {
    console.log('✅ No recent sales found - database is up to date!\n');
    saveLastUpdateTime();
    return;
  }
  
  // Get customer details for affected customers
  console.log('\n📥 Fetching customer details...');
  const customerIds = Array.from(recentSalesByCustomer.keys());
  const customersToUpdate = new Map<string, any>();
  
  for (let i = 0; i < customerIds.length; i++) {
    const customerId = customerIds[i];
    try {
      const customer = await apiRequest(`/customers/${customerId}`);
      customersToUpdate.set(customerId, customer.data);
      
      if ((i + 1) % 50 === 0) {
        console.log(`   Processed ${i + 1}/${customerIds.length} customers...`);
      }
      await new Promise(r => setTimeout(r, 50));
    } catch (error) {
      console.error(`   ⚠️  Error fetching customer ${customerId}`);
    }
  }
  
  console.log(`   ✅ Fetched ${customersToUpdate.size} customer records\n`);
  
  // Update or add customers
  console.log('🔄 Updating customer records...');
  let updated = 0;
  let added = 0;
  
  for (const [customerId, customerData] of customersToUpdate.entries()) {
    // Get ALL sales for this customer (to recalculate metrics accurately)
    const allSales = await getCustomerSales(customerId);
    const metrics = calculateMetrics(allSales);
    
    const existing = masterCustomers.get(customerId);
    
    if (existing) {
      // Update existing
      Object.assign(existing, {
        name: customerData.name || existing.name,
        email: customerData.email || existing.email,
        phone: customerData.phone || existing.phone,
        ...metrics,
        lastUpdated: new Date().toISOString(),
      });
      updated++;
    } else {
      // Add new
      masterCustomers.set(customerId, {
        customerId: customerId,
        customerCode: customerData.code || '',
        name: customerData.name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        ...metrics,
        referredSales: 0,
        lastUpdated: new Date().toISOString(),
      });
      added++;
    }
  }
  
  console.log(`   ✅ Updated: ${updated} | Added: ${added}\n`);

  // Validate data integrity - remove any placeholder emails
  console.log('🔍 Validating data integrity...');
  const emailFrequency = new Map<string, number>();
  for (const customer of masterCustomers.values()) {
    const email = (customer.email || '').toLowerCase().trim();
    if (email && email.includes('@')) {
      emailFrequency.set(email, (emailFrequency.get(email) || 0) + 1);
    }
  }

  let placeholderEmailsRemoved = 0;
  for (const customer of masterCustomers.values()) {
    const email = (customer.email || '').toLowerCase().trim();
    if (email && emailFrequency.get(email)! > 1) {
      customer.email = '';
      placeholderEmailsRemoved++;
    }
  }

  if (placeholderEmailsRemoved > 0) {
    console.log(`   ⚠️  Removed ${placeholderEmailsRemoved} placeholder emails\n`);
  } else {
    console.log(`   ✅ All data is clean\n`);
  }

  // Save updated master CSV
  console.log('💾 Saving master CSV...');
  const headers = [
    'Customer ID',
    'Customer Code',
    'Name',
    'Email',
    'Phone',
    'Lifetime Value',
    'Order Count',
    'Avg Order Value',
    'First Order',
    'Last Order',
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
    'Last Updated',
  ];
  
  const rows: string[] = [headers.join(',')];
  
  for (const customer of masterCustomers.values()) {
    rows.push([
      escapeCsvField(customer.customerId),
      escapeCsvField(customer.customerCode),
      escapeCsvField(customer.name),
      escapeCsvField(customer.email),
      escapeCsvField(customer.phone),
      customer.lifetimeValue.toFixed(2),
      customer.orderCount.toString(),
      customer.avgOrderValue.toFixed(2),
      escapeCsvField(customer.firstOrder || ''),
      escapeCsvField(customer.lastOrder || ''),
      customer.daysSinceLastOrder !== null ? customer.daysSinceLastOrder.toString() : '',
      customer.isVIP ? 'Yes' : 'No',
      customer.isHighValue ? 'Yes' : 'No',
      escapeCsvField(customer.inactiveSegment),
      escapeCsvField(customer.tier),
      customer.referredSales.toString(),
      (customer.ecomOrderCount || 0).toString(),
      (customer.retailOrderCount || 0).toString(),
      escapeCsvField(customer.duplicateIds || ''),
      escapeCsvField(customer.note || ''),
      escapeCsvField(customer.lastUpdated || ''),
    ].join(','));
  }
  
  fs.writeFileSync(MASTER_CSV, rows.join('\n'));
  saveLastUpdateTime();
  
  console.log(`✅ Saved ${masterCustomers.size} customers to ${MASTER_CSV}\n`);
  
  console.log('📊 SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Total customers: ${masterCustomers.size}`);
  console.log(`Updated: ${updated}`);
  console.log(`Added: ${added}`);
  console.log(`Next update: Run this script daily to keep data fresh\n`);
}

main().catch((error) => {
  console.error(`❌ Error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
