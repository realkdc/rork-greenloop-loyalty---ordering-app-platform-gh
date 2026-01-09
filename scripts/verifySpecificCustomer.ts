#!/usr/bin/env node
/**
 * Verify a specific customer against API
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
  const customerId = '0282e8ff-bc1f-11ef-f633-ba666e991f71'; // jmbarry1988@gmail.com
  
  console.log('🔍 Verifying jmbarry1988@gmail.com');
  console.log('═'.repeat(70));
  console.log('');
  
  // Get customer
  const customer = await apiRequest(`/customers/${customerId}`);
  console.log(`Customer: ${customer.data?.name || customer.name || 'N/A'}`);
  console.log(`Email: ${customer.data?.email || customer.email || 'N/A'}`);
  console.log('');
  
  // Get all sales
  console.log('Fetching all sales from API...');
  const allSales: any[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=200&offset=${offset}`);
    const sales = Array.isArray(result.data) ? result.data : [];
    
    const closedSales = sales.filter((s: any) => 
      (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && 
      s.state === 'closed'
    );
    
    allSales.push(...closedSales);
    
    if (sales.length < 200) {
      hasMore = false;
    } else {
      offset += 200;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const total = allSales.reduce((sum, sale) => {
    const amount = typeof sale.total_price_incl === 'number' 
      ? sale.total_price_incl 
      : (typeof sale.total_price === 'number' ? sale.total_price : 0);
    return sum + amount;
  }, 0);
  
  console.log(`✅ API Results:`);
  console.log(`   Orders: ${allSales.length}`);
  console.log(`   LTV: $${total.toFixed(2)}`);
  console.log(`   AOV: $${(total / allSales.length).toFixed(2)}`);
  console.log('');
  console.log(`📊 CSV shows: 42 orders, $2,482.37 LTV`);
  console.log('');
  
  if (Math.abs(allSales.length - 42) <= 1 && Math.abs(total - 2482.37) < 5) {
    console.log('✅ MATCH! Data is accurate.');
  } else {
    console.log(`⚠️  Difference: ${Math.abs(allSales.length - 42)} orders, $${Math.abs(total - 2482.37).toFixed(2)} LTV`);
  }
}

main().catch(console.error);
