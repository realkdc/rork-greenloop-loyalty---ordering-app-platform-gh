#!/usr/bin/env node
/**
 * Test script to find eCom orders via Retail API
 * Testing if eCom orders (Series X) are accessible through Retail X-Series API
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const CUSTOMER_EMAIL = 'nikkijo74@msn.com';
const RECEIPT_NUMBERS = ['2030', '2231', '1971']; // From the screenshot

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
  console.log('🔍 TESTING ECOM ORDERS VIA RETAIL API');
  console.log('═'.repeat(70));
  console.log(`Customer: Nikki Hanson (${CUSTOMER_EMAIL})`);
  console.log(`Expected Receipts: ${RECEIPT_NUMBERS.join(', ')}\n`);

  try {
    // Step 1: Find customer
    console.log('📥 Step 1: Finding customer...');
    const customerSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(CUSTOMER_EMAIL)}&page_size=100`);
    const customers = Array.isArray(customerSearch.data) ? customerSearch.data : [];
    const customer = customers.find((c: any) => 
      (c.email || '').toLowerCase() === CUSTOMER_EMAIL.toLowerCase()
    );
    
    if (!customer) {
      console.log('❌ Customer not found!');
      return;
    }
    
    console.log(`✅ Found customer: ${customer.id}`);
    console.log(`   Name: ${customer.name || 'N/A'}`);
    console.log(`   Email: ${customer.email || 'N/A'}`);
    console.log(`   Customer Code: ${customer.customer_code || 'N/A'}\n`);
    
    // Step 2: Search for sales by customer_id
    console.log('📥 Step 2: Searching for all sales by customer_id...');
    const salesSearch = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
    const sales = Array.isArray(salesSearch.data) ? salesSearch.data : [];
    console.log(`✅ Found ${sales.length} sales for this customer\n`);
    
    if (sales.length > 0) {
      console.log('📋 All Sales Found:');
      console.log('-'.repeat(70));
      
      sales.forEach((sale: any, i: number) => {
        const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
        const date = sale.created_at || sale.sale_date || 'N/A';
        const total = sale.total_price_incl || sale.total_price || 0;
        const status = sale.status || 'N/A';
        const state = sale.state || 'N/A';
        
        const isExpected = RECEIPT_NUMBERS.includes(String(receipt));
        const marker = isExpected ? '🎯' : '  ';
        
        console.log(`${marker} ${i + 1}. Receipt: ${receipt}, Date: ${date}, Total: $${total}, Status: ${status}/${state}`);
        
        if (isExpected) {
          console.log(`      ✅ THIS IS ONE OF THE EXPECTED ORDERS!`);
        }
      });
      
      // Check for specific receipt numbers
      console.log('\n📋 Checking for Specific Receipt Numbers:');
      console.log('-'.repeat(70));
      
      for (const receiptNum of RECEIPT_NUMBERS) {
        const matchingSale = sales.find((s: any) => 
          String(s.receipt_number) === receiptNum || 
          String(s.invoice_number) === receiptNum
        );
        
        if (matchingSale) {
          console.log(`✅ Found Receipt ${receiptNum}:`);
          console.log(`   ID: ${matchingSale.id}`);
          console.log(`   Date: ${matchingSale.created_at || matchingSale.sale_date}`);
          console.log(`   Total: $${matchingSale.total_price_incl || matchingSale.total_price || 0}`);
          console.log(`   Status: ${matchingSale.status}/${matchingSale.state}`);
          
          // Try to get full details
          try {
            const fullSale = await apiRequest(`/sales/${matchingSale.id}`);
            const saleData = fullSale.data || fullSale;
            console.log(`   Note: ${saleData.note || 'N/A'}`);
            console.log(`   User: ${saleData.user_id || 'N/A'}`);
            console.log(`   Outlet: ${saleData.outlet_id || 'N/A'}`);
          } catch (e: any) {
            console.log(`   Could not fetch full details: ${e.message}`);
          }
        } else {
          console.log(`❌ Receipt ${receiptNum} NOT FOUND in sales list`);
        }
        console.log('');
      }
      
      // Step 3: Try searching by receipt number directly
      console.log('📥 Step 3: Searching by receipt number...');
      for (const receiptNum of RECEIPT_NUMBERS) {
        try {
          const receiptSearch = await apiRequest(`/search?type=sales&q=${receiptNum}&page_size=100`);
          const receiptSales = Array.isArray(receiptSearch.data) ? receiptSearch.data : [];
          const exactMatch = receiptSales.find((s: any) => 
            String(s.receipt_number) === receiptNum || 
            String(s.invoice_number) === receiptNum
          );
          
          if (exactMatch) {
            console.log(`✅ Found Receipt ${receiptNum} via search:`);
            console.log(`   Customer ID: ${exactMatch.customer_id || 'N/A'}`);
            console.log(`   Matches our customer: ${exactMatch.customer_id === customer.id ? 'YES ✅' : 'NO ❌'}`);
            if (exactMatch.customer_id !== customer.id) {
              console.log(`   ⚠️  This order is linked to a DIFFERENT customer ID!`);
              console.log(`   Expected: ${customer.id}`);
              console.log(`   Got: ${exactMatch.customer_id}`);
            }
          } else {
            console.log(`❌ Receipt ${receiptNum} not found via search`);
          }
        } catch (e: any) {
          console.log(`❌ Error searching for receipt ${receiptNum}: ${e.message}`);
        }
      }
    } else {
      console.log('❌ No sales found for this customer!');
      console.log('   This suggests eCom orders might not be synced to Retail API');
    }
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
