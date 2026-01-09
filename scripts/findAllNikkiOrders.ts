#!/usr/bin/env node
/**
 * Find ALL orders for Nikki - checking for duplicates and different statuses
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const CUSTOMER_EMAIL = 'nikkijo74@msn.com';
const RECEIPT_NUMBERS = ['2030', '2231', '1971'];

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
  console.log('🔍 FINDING ALL NIKKI\'S ORDERS');
  console.log('═'.repeat(70));
  console.log(`Email: ${CUSTOMER_EMAIL}`);
  console.log(`Expected Receipts: ${RECEIPT_NUMBERS.join(', ')}\n`);

  try {
    // Step 1: Find ALL customers with this email (checking for duplicates)
    console.log('📥 Step 1: Finding ALL customers with this email...');
    const customerSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(CUSTOMER_EMAIL)}&page_size=200`);
    const allCustomers = Array.isArray(customerSearch.data) ? customerSearch.data : [];
    const matchingCustomers = allCustomers.filter((c: any) => 
      (c.email || '').toLowerCase() === CUSTOMER_EMAIL.toLowerCase()
    );
    
    console.log(`✅ Found ${matchingCustomers.length} customer record(s) with this email\n`);
    
    if (matchingCustomers.length === 0) {
      console.log('❌ No customers found!');
      return;
    }
    
    // Show all customer records
    matchingCustomers.forEach((customer, i) => {
      console.log(`Customer ${i + 1}:`);
      console.log(`   ID: ${customer.id}`);
      console.log(`   Name: ${customer.name || 'N/A'}`);
      console.log(`   Code: ${customer.customer_code || 'N/A'}`);
      console.log(`   Phone: ${customer.phone || customer.mobile || 'N/A'}`);
      console.log(`   Created: ${customer.created_at || 'N/A'}`);
      console.log('');
    });
    
    // Step 2: Search for sales for EACH customer ID (in case of duplicates)
    console.log('📥 Step 2: Searching for sales for each customer ID...');
    console.log('-'.repeat(70));
    
    const allSales: any[] = [];
    
    for (const customer of matchingCustomers) {
      console.log(`\n   Checking Customer ID: ${customer.id}`);
      
      try {
        // Search with NO status filter (get all statuses)
        const salesSearch = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
        const sales = Array.isArray(salesSearch.data) ? salesSearch.data : [];
        
        console.log(`   Found ${sales.length} sales (all statuses)`);
        
        if (sales.length > 0) {
          sales.forEach((sale: any) => {
            const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
            const date = sale.created_at || sale.sale_date || 'N/A';
            const total = sale.total_price_incl || sale.total_price || 0;
            const status = sale.status || 'N/A';
            const state = sale.state || 'N/A';
            
            const isExpected = RECEIPT_NUMBERS.includes(String(receipt));
            const marker = isExpected ? '🎯' : '  ';
            
            console.log(`   ${marker} Receipt: ${receipt}, Date: ${date}, Total: $${total}, Status: ${status}/${state}`);
            
            if (isExpected) {
              console.log(`      ✅ EXPECTED ORDER FOUND!`);
            }
            
            allSales.push({ ...sale, customerId: customer.id });
          });
        }
      } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
      }
    }
    
    // Step 3: Search for receipts by number across ALL sales (not filtered by customer)
    console.log('\n\n📥 Step 3: Searching for receipt numbers in ALL sales...');
    console.log('-'.repeat(70));
    
    for (const receiptNum of RECEIPT_NUMBERS) {
      console.log(`\n   Searching for Receipt ${receiptNum}...`);
      
      // Try different search methods
      const searchMethods = [
        { name: 'Search by receipt number', endpoint: `/search?type=sales&q=${receiptNum}&page_size=200` },
        { name: 'Search by date range (Nov 2025)', endpoint: `/search?type=sales&created_at_min=2025-11-01&created_at_max=2025-11-30&page_size=200` },
        { name: 'Search by date range (Dec 2025)', endpoint: `/search?type=sales&created_at_min=2025-12-01&created_at_max=2025-12-31&page_size=200` },
      ];
      
      for (const method of searchMethods) {
        try {
          const result = await apiRequest(method.endpoint);
          const sales = Array.isArray(result.data) ? result.data : [];
          
          const matchingSale = sales.find((s: any) => 
            String(s.receipt_number) === receiptNum || 
            String(s.invoice_number) === receiptNum
          );
          
          if (matchingSale) {
            console.log(`   ✅ Found via ${method.name}:`);
            console.log(`      ID: ${matchingSale.id}`);
            console.log(`      Customer ID: ${matchingSale.customer_id || 'N/A'}`);
            console.log(`      Date: ${matchingSale.created_at || matchingSale.sale_date}`);
            console.log(`      Total: $${matchingSale.total_price_incl || matchingSale.total_price || 0}`);
            console.log(`      Status: ${matchingSale.status}/${matchingSale.state}`);
            
            // Check if customer ID matches
            const customerMatch = matchingCustomers.find(c => c.id === matchingSale.customer_id);
            if (customerMatch) {
              console.log(`      ✅ Customer ID matches one of Nikki's records`);
            } else {
              console.log(`      ⚠️  Customer ID does NOT match any of Nikki's records!`);
              console.log(`      This order might be linked to a different customer record`);
            }
            break; // Found it, no need to try other methods
          }
        } catch (e: any) {
          // Continue to next method
        }
      }
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Found ${matchingCustomers.length} customer record(s)`);
    console.log(`Found ${allSales.length} total sales across all customer records`);
    
    const foundReceipts = allSales
      .map(s => s.receipt_number || s.invoice_number)
      .filter(r => RECEIPT_NUMBERS.includes(String(r)));
    
    console.log(`Found ${foundReceipts.length} of ${RECEIPT_NUMBERS.length} expected receipts: ${foundReceipts.join(', ')}`);
    
    const missingReceipts = RECEIPT_NUMBERS.filter(r => !foundReceipts.includes(r));
    if (missingReceipts.length > 0) {
      console.log(`\n⚠️  Missing Receipts: ${missingReceipts.join(', ')}`);
      console.log(`   These orders might:`);
      console.log(`   - Not be synced from eCom to Retail API yet`);
      console.log(`   - Be linked to a different customer ID (duplicate issue)`);
      console.log(`   - Have a different status that's not being returned`);
    }
    
    console.log('\n✅ Analysis complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
