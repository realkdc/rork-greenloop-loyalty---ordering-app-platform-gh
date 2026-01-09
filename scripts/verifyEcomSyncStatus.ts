#!/usr/bin/env node
/**
 * Verify if "not synced" eCom orders are actually in the API
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

async function apiRequest(endpoint: string): Promise<any> {
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

async function main() {
  // Test chriswdavis6 - has 46 "not synced" orders
  const customerId = '0ac98a3b-571f-11ee-e863-1dd731a5a265';
  const notSyncedOrders = ['2406', '2383', '2366', '2351', '2323']; // Sample of 5
  
  console.log('🔍 Checking if "not synced" orders are actually in API...');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Testing customer: chriswdavis6@gmail.com`);
  console.log(`Sample "not synced" orders: ${notSyncedOrders.join(', ')}`);
  console.log('');
  
  // Get all sales from API
  console.log('Fetching all sales from API...');
  const allSales: any[] = [];
  let offset = 0;
  
  while (true) {
    const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=200&offset=${offset}`);
    const sales = Array.isArray(result.data) ? result.data : [];
    
    const closedSales = sales.filter((s: any) => 
      (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && 
      s.state === 'closed'
    );
    
    allSales.push(...closedSales);
    
    if (sales.length < 200) break;
    offset += 200;
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`Found ${allSales.length} orders in API\n`);
  
  // Check if any "not synced" order numbers appear
  console.log('Checking receipt numbers...');
  const receiptNumbers = allSales.map(s => s.receipt_number || s.invoice_number || '').filter(r => r);
  
  let found = 0;
  for (const orderNum of notSyncedOrders) {
    if (receiptNumbers.includes(orderNum)) {
      console.log(`  ✅ Order ${orderNum} IS in API (was marked as "not synced" but actually synced!)`);
      found++;
    } else {
      console.log(`  ❌ Order ${orderNum} NOT in API (truly not synced)`);
    }
  }
  
  console.log('');
  console.log(`Found ${found}/${notSyncedOrders.length} "not synced" orders actually in API`);
  console.log('');
  
  if (found > 0) {
    console.log('⚠️  ISSUE FOUND: Some orders marked as "not synced" are actually in the API!');
    console.log('   This means the X-series Order ID check in the eCom CSV might be unreliable.');
    console.log('   We may be double-counting some orders.');
  } else {
    console.log('✅ All tested orders are truly not synced.');
  }
}

main().catch(console.error);
