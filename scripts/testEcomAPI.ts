#!/usr/bin/env node
/**
 * Test script for Lightspeed eCom (E-Series) API
 * 
 * This tests if we can access eCom orders directly
 * 
 * Usage: npx tsx scripts/testEcomAPI.ts
 */

import 'dotenv/config';

// eCom API credentials (to be set in .env)
const ECOM_TOKEN = process.env.EXPO_PUBLIC_ECOM_TOKEN || '';
const ECOM_STORE_ID = process.env.EXPO_PUBLIC_ECOM_STORE_ID || '';
const ECOM_API_BASE = process.env.EXPO_PUBLIC_ECOM_API_BASE || 'https://api.lightspeedhq.com/ecom/e-series';

// Test email
const TEST_EMAIL = 'nikkijo74@msn.com';

async function apiRequest(endpoint: string, token: string) {
  const url = `${ECOM_API_BASE}${endpoint}`;
  console.log(`\n🔍 Testing: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error.substring(0, 300)}`);
  }

  return response.json();
}

async function main() {
  console.log('🧪 TESTING LIGHTSPEED ECOM (E-SERIES) API');
  console.log('═'.repeat(70));
  console.log(`API Base: ${ECOM_API_BASE}`);
  console.log(`Store ID: ${ECOM_STORE_ID || 'Not set'}`);
  console.log(`Token: ${ECOM_TOKEN ? 'Set ✅' : 'Not set ❌'}\n`);

  if (!ECOM_TOKEN) {
    console.error('❌ ERROR: No eCom token set in .env!');
    console.error('\nTo get a token:');
    console.error('1. Log into Lightspeed Retail POS');
    console.error('2. Navigate to eCom (E-Series) Admin Panel');
    console.error('3. Go to Apps > My Apps');
    console.error('4. Create a new app');
    console.error('5. Get Secret Token from app details');
    console.error('6. Add to .env: EXPO_PUBLIC_ECOM_TOKEN=your_token_here\n');
    process.exit(1);
  }

  try {
    // Test 1: Try to get account/store info
    console.log('📥 Test 1: Getting account/store information...');
    try {
      const accountInfo = await apiRequest('/account', ECOM_TOKEN);
      console.log('✅ Account info retrieved:');
      console.log(JSON.stringify(accountInfo, null, 2));
    } catch (e: any) {
      console.log(`⚠️  Account endpoint failed: ${e.message}`);
      console.log('   Trying alternative endpoints...\n');
    }

    // Test 2: Try to get orders
    console.log('📥 Test 2: Getting orders...');
    try {
      const ordersEndpoint = ECOM_STORE_ID 
        ? `/stores/${ECOM_STORE_ID}/orders`
        : '/orders';
      const orders = await apiRequest(ordersEndpoint, ECOM_TOKEN);
      console.log('✅ Orders retrieved:');
      console.log(`   Found ${Array.isArray(orders) ? orders.length : 'unknown'} orders`);
      if (Array.isArray(orders) && orders.length > 0) {
        console.log('\n   First order:');
        console.log(JSON.stringify(orders[0], null, 2));
      } else if (orders.data) {
        console.log('\n   Orders data:');
        console.log(JSON.stringify(orders.data?.slice(0, 1), null, 2));
      }
    } catch (e: any) {
      console.log(`⚠️  Orders endpoint failed: ${e.message}`);
    }

    // Test 3: Search for orders by email
    console.log('\n📥 Test 3: Searching for orders by email...');
    try {
      const searchEndpoint = ECOM_STORE_ID
        ? `/stores/${ECOM_STORE_ID}/orders?email=${encodeURIComponent(TEST_EMAIL)}`
        : `/orders?email=${encodeURIComponent(TEST_EMAIL)}`;
      const emailOrders = await apiRequest(searchEndpoint, ECOM_TOKEN);
      console.log('✅ Email search results:');
      const ordersList = Array.isArray(emailOrders) ? emailOrders : (emailOrders.data || []);
      console.log(`   Found ${ordersList.length} orders for ${TEST_EMAIL}`);
      
      if (ordersList.length > 0) {
        ordersList.forEach((order: any, i: number) => {
          console.log(`\n   Order ${i + 1}:`);
          console.log(`     ID: ${order.id || order.orderId || 'N/A'}`);
          console.log(`     Number: ${order.number || order.orderNumber || 'N/A'}`);
          console.log(`     Date: ${order.createdAt || order.date || 'N/A'}`);
          console.log(`     Total: $${order.total || order.totalPrice || 'N/A'}`);
          console.log(`     Status: ${order.status || 'N/A'}`);
        });
      }
    } catch (e: any) {
      console.log(`⚠️  Email search failed: ${e.message}`);
    }

    // Test 4: Try different API base URLs (in case the default is wrong)
    console.log('\n📥 Test 4: Testing alternative API base URLs...');
    const alternativeBases = [
      'https://api.lightspeedhq.com/ecom/e-series',
      'https://api.shoplightspeed.com',
      'https://api.webshopapp.com',
      'https://my.business.shop/api',
    ];

    for (const base of alternativeBases) {
      try {
        console.log(`\n   Testing: ${base}`);
        const testUrl = `${base}/account`;
        const response = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${ECOM_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✅ ${base} works!`);
          console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}...`);
        } else {
          console.log(`   ❌ ${base} failed (${response.status})`);
        }
      } catch (e: any) {
        console.log(`   ❌ ${base} error: ${e.message.substring(0, 100)}`);
      }
    }

    console.log('\n✅ Test complete!\n');
    console.log('📝 Next Steps:');
    console.log('1. If any endpoint worked, note the correct API base URL');
    console.log('2. Update EXPO_PUBLIC_ECOM_API_BASE in .env');
    console.log('3. We can then integrate eCom orders into customer analytics\n');

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    console.error('\n💡 Tips:');
    console.error('- Check that the token is correct');
    console.error('- Verify the API base URL');
    console.error('- Check API documentation: https://developers.lightspeedhq.com/ecom/e-series/');
    process.exit(1);
  }
}

main();
