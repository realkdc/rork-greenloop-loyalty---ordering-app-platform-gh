#!/usr/bin/env node
/**
 * Test alternative methods to access eCom data
 * Since we can't create custom apps, trying other approaches
 */

import 'dotenv/config';

const RETAIL_TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const RETAIL_DOMAIN = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const RETAIL_API = `https://${RETAIL_DOMAIN}.retail.lightspeed.app/api/2.0`;

const TEST_EMAIL = 'nikkijo74@msn.com';
const STORE_ID = '86917525'; // From docs

async function retailApiRequest(endpoint: string) {
  const url = `${RETAIL_API}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${RETAIL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`API Error (${response.status})`);
  return response.json();
}

async function main() {
  console.log('🔍 TESTING ALTERNATIVE METHODS TO ACCESS ECOM DATA');
  console.log('═'.repeat(70));
  console.log(`Since we can't create custom apps, trying other approaches...\n`);

  try {
    // Test 1: Check if Retail API has eCom-specific fields
    console.log('📥 Test 1: Checking Retail API for eCom order indicators...');
    const customer = await retailApiRequest(`/search?type=customers&q=${encodeURIComponent(TEST_EMAIL)}&page_size=10`);
    const customers = Array.isArray(customer.data) ? customer.data : [];
    const nikki = customers.find((c: any) => (c.email || '').toLowerCase() === TEST_EMAIL.toLowerCase());
    
    if (nikki) {
      console.log(`✅ Found customer: ${nikki.id}\n`);
      
      // Get all sales with different status filters
      console.log('   Testing different status filters...');
      const statuses = ['CLOSED', 'DISPATCHED_CLOSED', 'AWAITING_PICKUP', 'SAVED'];
      
      for (const status of statuses) {
        try {
          const sales = await retailApiRequest(`/search?type=sales&customer_id=${nikki.id}&page_size=200`);
          const salesList = Array.isArray(sales.data) ? sales.data : [];
          const filtered = salesList.filter((s: any) => 
            s.status === status || s.state === status.toLowerCase()
          );
          
          if (filtered.length > 0) {
            console.log(`   ✅ Status "${status}": ${filtered.length} sales`);
            filtered.slice(0, 3).forEach((s: any) => {
              console.log(`      - Receipt: ${s.receipt_number || s.invoice_number}, Date: ${s.created_at}, Total: $${s.total_price_incl || s.total_price || 0}`);
            });
          }
        } catch (e: any) {
          console.log(`   ❌ Status "${status}": ${e.message}`);
        }
      }
      
      // Check for eCom indicators in sale data
      console.log('\n   Checking for eCom order indicators...');
      const allSales = await retailApiRequest(`/search?type=sales&customer_id=${nikki.id}&page_size=200`);
      const salesList = Array.isArray(allSales.data) ? allSales.data : [];
      
      if (salesList.length > 0) {
        // Get full details of first sale to check for eCom fields
        const firstSale = salesList[0];
        try {
          const fullSale = await retailApiRequest(`/sales/${firstSale.id}`);
          const saleData = fullSale.data || fullSale;
          
          console.log('   Sale fields that might indicate eCom source:');
          console.log(`     user_id: ${saleData.user_id || 'N/A'}`);
          console.log(`     register_id: ${saleData.register_id || 'N/A'}`);
          console.log(`     outlet_id: ${saleData.outlet_id || 'N/A'}`);
          console.log(`     note: ${saleData.note || 'N/A'}`);
          console.log(`     source: ${saleData.source || 'N/A'}`);
          console.log(`     channel: ${saleData.channel || 'N/A'}`);
          
          // Check if note contains "eCom" or "online"
          if (saleData.note && (saleData.note.toLowerCase().includes('ecom') || saleData.note.toLowerCase().includes('online'))) {
            console.log('   ✅ Found eCom indicator in note!');
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    // Test 2: Try to find "Online Register" or eCom register
    console.log('\n\n📥 Test 2: Checking for Online/eCom registers...');
    try {
      const registers = await retailApiRequest('/registers');
      const registerList = Array.isArray(registers.data) ? registers.data : [];
      
      console.log(`   Found ${registerList.length} registers:`);
      registerList.forEach((reg: any) => {
        const name = (reg.name || '').toLowerCase();
        if (name.includes('online') || name.includes('ecom') || name.includes('web')) {
          console.log(`   🎯 Found potential eCom register: ${reg.name} (ID: ${reg.id})`);
        } else {
          console.log(`      - ${reg.name} (ID: ${reg.id})`);
        }
      });
      
      // If we find an online register, filter sales by it
      const onlineRegister = registerList.find((r: any) => 
        (r.name || '').toLowerCase().includes('online') || 
        (r.name || '').toLowerCase().includes('ecom')
      );
      
      if (onlineRegister && nikki) {
        console.log(`\n   Testing sales filtered by online register...`);
        const onlineSales = await retailApiRequest(`/search?type=sales&customer_id=${nikki.id}&page_size=200`);
        const onlineSalesList = Array.isArray(onlineSales.data) ? onlineSales.data : [];
        const filteredByRegister = onlineSalesList.filter((s: any) => s.register_id === onlineRegister.id);
        console.log(`   Found ${filteredByRegister.length} sales from online register`);
      }
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}`);
    }

    // Test 3: Try Ecwid API (since website might use Ecwid)
    console.log('\n\n📥 Test 3: Testing Ecwid API access...');
    console.log(`   Store ID: ${STORE_ID}`);
    console.log(`   Note: Need Ecwid token - checking if we can find it...`);
    
    // Try common Ecwid endpoints
    const ecwidBases = [
      'https://app.ecwid.com/api/v3',
      'https://api.ecwid.com/api/v3',
    ];
    
    for (const base of ecwidBases) {
      try {
        // Try without auth first to see what error we get
        const testUrl = `${base}/${STORE_ID}/profile`;
        const response = await fetch(testUrl);
        console.log(`   ${base}: ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
          console.log(`      ⚠️  Needs authentication - would work with token`);
        } else if (response.status === 404) {
          console.log(`      ❌ Store not found or wrong base URL`);
        }
      } catch (e: any) {
        console.log(`   ${base}: Error - ${e.message.substring(0, 50)}`);
      }
    }

    // Test 4: Check if we can access webhook setup
    console.log('\n\n📥 Test 4: Checking webhook setup access...');
    const webhookUrl = `https://${RETAIL_DOMAIN}.retail.lightspeed.app/setup/api`;
    console.log(`   Webhook setup URL: ${webhookUrl}`);
    console.log(`   ⚠️  This requires browser access - can't test via API`);
    console.log(`   💡 Try accessing this URL in browser to set up webhooks`);

    console.log('\n\n✅ Alternative methods test complete!\n');
    console.log('📝 Recommendations:');
    console.log('1. Check if Retail API sales have eCom indicators (register_id, note, etc.)');
    console.log('2. Filter by "Online Register" if it exists');
    console.log('3. Try accessing hidden apps page: https://my.business.shop/store/86917525/manage_your_apps');
    console.log('4. Set up webhooks for real-time order notifications');
    console.log('5. Check eCom Settings for Ecwid API credentials\n');

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    process.exit(1);
  }
}

main();
