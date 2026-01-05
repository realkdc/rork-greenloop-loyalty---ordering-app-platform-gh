/**
 * Lightspeed Retail (X-Series) API Test Script
 *
 * Usage: npx tsx scripts/testLightspeedAPI.ts
 *
 * Before running:
 * 1. Make sure EXPO_PUBLIC_LIGHTSPEED_TOKEN is set in .env
 * 2. Make sure EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX is set in .env
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

async function apiRequest(endpoint: string): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  console.log(`\n📡 GET ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

async function testRetailer() {
  console.log('\n🏪 TESTING RETAILER INFO...');
  console.log('━'.repeat(50));

  const data = await apiRequest('/retailer');
  console.log('\n✅ Retailer Info:');
  console.log(`   Name: ${data.name || data.retailer_name}`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Currency: ${data.currency}`);
  console.log(`   Timezone: ${data.time_zone}`);
  return data;
}

async function testProducts() {
  console.log('\n📦 TESTING PRODUCTS...');
  console.log('━'.repeat(50));

  const data = await apiRequest('/products?page_size=5');
  const products = data.data || data.products || [];
  console.log(`\n✅ Found ${data.pagination?.total || products.length} products`);

  if (products.length > 0) {
    console.log('\nFirst 5 products:');
    products.slice(0, 5).forEach((p: any, i: number) => {
      console.log(`   ${i + 1}. ${p.name} - $${p.price || p.retail_price || 'N/A'}`);
    });
  }
  return data;
}

async function testCustomers() {
  console.log('\n👥 TESTING CUSTOMERS...');
  console.log('━'.repeat(50));

  const data = await apiRequest('/customers?page_size=3');
  const customers = data.data || data.customers || [];
  console.log(`\n✅ Found ${data.pagination?.total || customers.length} customers`);

  if (customers.length > 0) {
    console.log('\nFirst 3 customers:');
    customers.slice(0, 3).forEach((c: any, i: number) => {
      console.log(`   ${i + 1}. ${c.name || c.first_name + ' ' + c.last_name}`);
    });
  }
  return data;
}

async function testSales() {
  console.log('\n💰 TESTING SALES/ORDERS...');
  console.log('━'.repeat(50));

  const data = await apiRequest('/sales?page_size=3');
  const sales = data.data || data.sales || [];
  console.log(`\n✅ Found ${data.pagination?.total || sales.length} sales`);

  if (sales.length > 0) {
    console.log('\nRecent sales:');
    sales.slice(0, 3).forEach((s: any, i: number) => {
      console.log(`   ${i + 1}. Sale #${s.id} - $${s.total_price || s.total || 'N/A'}`);
    });
  }
  return data;
}

async function main() {
  console.log('🚀 LIGHTSPEED RETAIL (X-SERIES) API TEST');
  console.log('═'.repeat(50));
  
  if (!TOKEN) {
    console.log('\n❌ ERROR: No token set in .env!');
    console.log('   Expected: EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...');
    process.exit(1);
  }

  console.log(`🔑 Token Info: ${TOKEN.substring(0, 8)}...${TOKEN.substring(TOKEN.length - 4)} (Length: ${TOKEN.length})`);
  console.log(`🌐 Domain: ${DOMAIN_PREFIX}`);
  console.log(`📍 API Base: ${API_BASE}`);

  // Test both domain formats
  const bases = [
    `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`,
    `https://${DOMAIN_PREFIX}.vendhq.com/api/2.0`
  ];

  let success = false;
  const headerFormats = [
    (t: string) => ({ 'Authorization': `Bearer ${t}` }),
    (t: string) => ({ 'Authorization': t }),
    (t: string) => ({ 'x-api-key': t }),
  ];

  const endpoints = ['/retailer', '/products'];

  for (const base of bases) {
    for (const format of headerFormats) {
      for (const endpoint of endpoints) {
        try {
          const url = `${base}${endpoint}`;
          const headers = {
            ...format(TOKEN),
            'Content-Type': 'application/json',
          };
          
          console.log(`\n🔍 Trying: GET ${url}`);
          console.log(`   Headers: ${JSON.stringify(Object.keys(headers))}`);
          
          const response = await fetch(url, { headers });

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ SUCCESS!`);
            console.log(`   Working URL: ${url}`);
            console.log(`   Working Headers: ${JSON.stringify(Object.keys(format(TOKEN)))}`);
            success = true;
            break;
          } else {
            const errorText = await response.text();
            console.log(`❌ Failed: ${response.status} ${errorText.substring(0, 100)}`);
          }
        } catch (e: any) {
          console.log(`❌ Error: ${e.message}`);
        }
      }
      if (success) break;
    }
    if (success) break;
  }

  if (!success) {
    console.log('\n\n❌ ALL ENDPOINTS FAILED');
    console.log('═'.repeat(50));
    console.log('💡 PRO TIP: Try regenerating the token in the dashboard.');
    console.log('   Your screenshot shows the token ends in gQA9, which matches.');
    console.log('   If it still fails, the token might be restricted to certain IPs or scopes.');
    process.exit(1);
  }
}

main();
