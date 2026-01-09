#!/usr/bin/env node
/**
 * Deep dive into finding Nikki's order
 * Testing all possible API endpoints and query methods
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const CUSTOMER_ID = '02269032-111f-11f0-fa97-ae13eaec05b9';
const CUSTOMER_EMAIL = 'nikkijo74@msn.com';
const RECEIPT_NUMBER = '2030';
const ORDER_DATE = '2025-11-16';

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

async function main() {
  console.log('🔬 DEEP DIVE: FINDING NIKKI\'S ORDER');
  console.log('═'.repeat(70));
  console.log(`Customer ID: ${CUSTOMER_ID}`);
  console.log(`Email: ${CUSTOMER_EMAIL}`);
  console.log(`Expected Receipt: ${RECEIPT_NUMBER}`);
  console.log(`Expected Date: ${ORDER_DATE}\n`);

  try {
    // Test 1: Get customer and check all their fields
    console.log('📋 TEST 1: Customer Details');
    console.log('-'.repeat(70));
    const customer = await apiRequest(`/customers/${CUSTOMER_ID}`);
    const custData = customer.data || customer;
    console.log('Customer Data:');
    console.log(JSON.stringify(custData, null, 2));
    console.log('\n');

    // Test 2: Try /sales endpoint with different parameters
    console.log('📋 TEST 2: /sales endpoint variations');
    console.log('-'.repeat(70));
    
    const tests = [
      { name: 'customer_id only', endpoint: `/sales?customer_id=${CUSTOMER_ID}` },
      { name: 'customer_id + page_size', endpoint: `/sales?customer_id=${CUSTOMER_ID}&page_size=100` },
      { name: 'customer_id + offset', endpoint: `/sales?customer_id=${CUSTOMER_ID}&offset=0&page_size=100` },
      { name: 'customer_id + created_at_min', endpoint: `/sales?customer_id=${CUSTOMER_ID}&created_at_min=2025-01-01&page_size=100` },
      { name: 'customer_id + receipt_number', endpoint: `/sales?customer_id=${CUSTOMER_ID}&receipt_number=${RECEIPT_NUMBER}` },
    ];

    for (const test of tests) {
      try {
        console.log(`\n   Testing: ${test.name}`);
        console.log(`   Endpoint: ${test.endpoint}`);
        const result = await apiRequest(test.endpoint);
        const sales = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        console.log(`   ✅ Result: ${sales.length} sales`);
        
        if (sales.length > 0) {
          const nov16Sale = sales.find((s: any) => 
            (s.created_at && s.created_at.includes('2025-11-16')) ||
            (s.receipt_number === RECEIPT_NUMBER) ||
            (Math.abs((s.total_price_incl || s.total_price || 0) - 20) < 0.01)
          );
          
          if (nov16Sale) {
            console.log(`   🎯 FOUND NOV 16 ORDER!`);
            console.log(`      ID: ${nov16Sale.id}`);
            console.log(`      Receipt: ${nov16Sale.receipt_number || nov16Sale.invoice_number}`);
            console.log(`      Date: ${nov16Sale.created_at || nov16Sale.sale_date}`);
            console.log(`      Total: $${nov16Sale.total_price_incl || nov16Sale.total_price}`);
            console.log(`      Customer ID: ${nov16Sale.customer_id}`);
          }
          
          // Show date range
          const dates = sales.map((s: any) => s.created_at || s.sale_date).filter(Boolean).sort();
          if (dates.length > 0) {
            console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
          }
        }
      } catch (e: any) {
        console.log(`   ❌ Error: ${e.message.substring(0, 100)}`);
      }
    }

    // Test 3: Search endpoint variations
    console.log('\n\n📋 TEST 3: /search?type=sales variations');
    console.log('-'.repeat(70));
    
    const searchTests = [
      { name: 'customer_id filter', endpoint: `/search?type=sales&customer_id=${CUSTOMER_ID}&page_size=100` },
      { name: 'q parameter with customer_id', endpoint: `/search?type=sales&q=${CUSTOMER_ID}&page_size=100` },
      { name: 'date range Nov 2025', endpoint: `/search?type=sales&created_at_min=2025-11-16&created_at_max=2025-11-16&page_size=200` },
      { name: 'receipt number search', endpoint: `/search?type=sales&q=${RECEIPT_NUMBER}&page_size=100` },
      { name: 'customer_id + date range', endpoint: `/search?type=sales&customer_id=${CUSTOMER_ID}&created_at_min=2025-11-01&created_at_max=2025-11-30&page_size=100` },
    ];

    for (const test of searchTests) {
      try {
        console.log(`\n   Testing: ${test.name}`);
        console.log(`   Endpoint: ${test.endpoint}`);
        const result = await apiRequest(test.endpoint);
        const sales = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        console.log(`   ✅ Result: ${sales.length} sales`);
        
        if (sales.length > 0) {
          // Filter by customer_id if not already filtered
          const customerSales = test.name.includes('customer_id') 
            ? sales 
            : sales.filter((s: any) => s.customer_id === CUSTOMER_ID);
          
          if (customerSales.length > 0) {
            console.log(`   Found ${customerSales.length} sales for this customer`);
            
            const nov16Sale = customerSales.find((s: any) => 
              (s.created_at && s.created_at.includes('2025-11-16')) ||
              (s.receipt_number === RECEIPT_NUMBER) ||
              (Math.abs((s.total_price_incl || s.total_price || 0) - 20) < 0.01)
            );
            
            if (nov16Sale) {
              console.log(`   🎯 FOUND NOV 16 ORDER!`);
              console.log(`      ID: ${nov16Sale.id}`);
              console.log(`      Receipt: ${nov16Sale.receipt_number || nov16Sale.invoice_number}`);
              console.log(`      Date: ${nov16Sale.created_at || nov16Sale.sale_date}`);
              console.log(`      Total: $${nov16Sale.total_price_incl || nov16Sale.total_price}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`   ❌ Error: ${e.message.substring(0, 100)}`);
      }
    }

    // Test 4: Try to get sale by receipt number directly
    console.log('\n\n📋 TEST 4: Direct sale lookup');
    console.log('-'.repeat(70));
    
    // First, find any sale with receipt 2030
    try {
      const receiptSearch = await apiRequest(`/search?type=sales&q=${RECEIPT_NUMBER}&page_size=100`);
      const receiptSales = Array.isArray(receiptSearch.data) ? receiptSearch.data : [];
      console.log(`Found ${receiptSales.length} sales with receipt number containing "${RECEIPT_NUMBER}"`);
      
      if (receiptSales.length > 0) {
        for (let i = 0; i < receiptSales.length; i++) {
          const sale = receiptSales[i];
          console.log(`\n   Sale ${i + 1}:`);
          console.log(`     ID: ${sale.id}`);
          console.log(`     Receipt: ${sale.receipt_number || sale.invoice_number || 'N/A'}`);
          console.log(`     Date: ${sale.created_at || sale.sale_date || 'N/A'}`);
          console.log(`     Customer ID: ${sale.customer_id || 'N/A'}`);
          console.log(`     Total: $${sale.total_price_incl || sale.total_price || 0}`);
          console.log(`     Status: ${sale.status || 'N/A'}`);
          
          if (sale.receipt_number === RECEIPT_NUMBER || sale.invoice_number === RECEIPT_NUMBER) {
            console.log(`     🎯 THIS IS RECEIPT ${RECEIPT_NUMBER}!`);
            
            // Try to get full details
            try {
              const fullSale = await apiRequest(`/sales/${sale.id}`);
              const saleData = fullSale.data || fullSale;
              console.log(`     Full Sale Details:`);
              console.log(JSON.stringify(saleData, null, 2));
            } catch (e: any) {
              console.log(`     Could not fetch full details: ${e.message}`);
            }
          }
        }
      }
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }

    // Test 5: Paginate through ALL sales for this customer
    console.log('\n\n📋 TEST 5: Paginate ALL sales for customer');
    console.log('-'.repeat(70));
    
    let allSales: any[] = [];
    let offset = 0;
    const pageSize = 200;
    let hasMore = true;
    let page = 1;
    
    while (hasMore && page <= 10) {
      try {
        console.log(`   Fetching page ${page} (offset ${offset})...`);
        const result = await apiRequest(`/sales?customer_id=${CUSTOMER_ID}&page_size=${pageSize}&offset=${offset}`);
        const sales = Array.isArray(result.data) ? result.data : [];
        
        if (sales.length === 0) {
          hasMore = false;
          break;
        }
        
        const closedSales = sales.filter((s: any) => 
          s.status === 'CLOSED' && s.state === 'closed'
        );
        
        allSales.push(...closedSales);
        console.log(`   Page ${page}: ${closedSales.length} closed sales (Total: ${allSales.length})`);
        
        // Check for Nov 16 order
        const nov16Sale = closedSales.find((s: any) => 
          (s.created_at && s.created_at.includes('2025-11-16')) ||
          (s.receipt_number === RECEIPT_NUMBER)
        );
        
        if (nov16Sale) {
          console.log(`   🎯🎯🎯 FOUND NOV 16 ORDER ON PAGE ${page}! 🎯🎯🎯`);
          console.log(`      ID: ${nov16Sale.id}`);
          console.log(`      Receipt: ${nov16Sale.receipt_number || nov16Sale.invoice_number}`);
          console.log(`      Date: ${nov16Sale.created_at || nov16Sale.sale_date}`);
          console.log(`      Total: $${nov16Sale.total_price_incl || nov16Sale.total_price}`);
          hasMore = false; // Found it, stop searching
          break;
        }
        
        if (sales.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
          page++;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (e: any) {
        console.log(`   Error on page ${page}: ${e.message}`);
        break;
      }
    }
    
    console.log(`\n   Total sales found: ${allSales.length}`);
    if (allSales.length > 0) {
      const dates = allSales.map((s: any) => s.created_at || s.sale_date).filter(Boolean).sort();
      console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
    }

    console.log('\n\n✅ Deep dive complete!\n');

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
