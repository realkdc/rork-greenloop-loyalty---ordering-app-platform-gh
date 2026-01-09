#!/usr/bin/env node
/**
 * Test script to find Nikki Hanson's order
 * Customer ID: 02269032-111f-11f0-fa97-ae13eaec05b9
 * Email: nikkijo74@msn.com
 * Expected order: Nov 16, 2025, $20.00
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const CUSTOMER_ID = '02269032-111f-11f0-fa97-ae13eaec05b9';
const CUSTOMER_EMAIL = 'nikkijo74@msn.com';

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
  console.log('🔍 TESTING NIKKI HANSON ORDER LOOKUP');
  console.log('═'.repeat(60));
  console.log(`Customer ID: ${CUSTOMER_ID}`);
  console.log(`Email: ${CUSTOMER_EMAIL}\n`);

  try {
    // Step 1: Get customer details
    console.log('📥 Step 1: Getting customer details...');
    const customer = await apiRequest(`/customers/${CUSTOMER_ID}`);
    console.log('✅ Customer found:');
    console.log(`   Name: ${customer.data?.name || customer.name || 'N/A'}`);
    console.log(`   Email: ${customer.data?.email || customer.email || 'N/A'}`);
    console.log(`   Customer Code: ${customer.data?.customer_code || customer.customer_code || 'N/A'}`);
    console.log(`   Year to Date: $${customer.data?.year_to_date || customer.year_to_date || 0}\n`);

    // Step 2: Try to find sales by customer_id
    console.log('📥 Step 2: Searching for sales by customer_id...');
    
    // Try different approaches
    console.log('\n   Approach A: Search all sales and filter by customer_id');
    const salesSearch = await apiRequest(`/search?type=sales&page_size=500`);
    const allSales = Array.isArray(salesSearch.data) ? salesSearch.data : [];
    const customerSales = allSales.filter((sale: any) => 
      sale.customer_id === CUSTOMER_ID
    );
    console.log(`   Found ${customerSales.length} sales with customer_id ${CUSTOMER_ID}`);
    
    if (customerSales.length > 0) {
      customerSales.forEach((sale: any, i: number) => {
        console.log(`\n   Sale ${i + 1}:`);
        console.log(`     ID: ${sale.id}`);
        console.log(`     Receipt: ${sale.receipt_number || sale.invoice_number || 'N/A'}`);
        console.log(`     Date: ${sale.created_at || sale.sale_date || 'N/A'}`);
        console.log(`     Total: $${sale.total_price || sale.total_price_incl || 0}`);
        console.log(`     Status: ${sale.status || 'N/A'}`);
        console.log(`     State: ${sale.state || 'N/A'}`);
      });
    }

    // Step 3: Try searching by date range (Nov 2025)
    console.log('\n   Approach B: Searching sales from Nov 2025...');
    const novSales = await apiRequest(`/search?type=sales&created_at_min=2025-11-01&created_at_max=2025-11-30&page_size=200`);
    const novSalesList = Array.isArray(novSales.data) ? novSales.data : [];
    const novCustomerSales = novSalesList.filter((sale: any) => 
      sale.customer_id === CUSTOMER_ID
    );
    console.log(`   Found ${novCustomerSales.length} sales in Nov 2025 for this customer`);
    
    if (novCustomerSales.length > 0) {
      novCustomerSales.forEach((sale: any) => {
        console.log(`     Receipt: ${sale.receipt_number || sale.id}, Date: ${sale.created_at}, Total: $${sale.total_price || 0}`);
      });
    }

    // Step 4: Get full sale details for any found sales
    if (customerSales.length > 0) {
      console.log('\n📥 Step 3: Getting full sale details...');
      for (const sale of customerSales.slice(0, 3)) {
        try {
          const saleDetail = await apiRequest(`/sales/${sale.id}`);
          const fullSale = saleDetail.data || saleDetail;
          console.log(`\n   Sale ${sale.id}:`);
          console.log(`     Receipt: ${fullSale.receipt_number || fullSale.invoice_number || 'N/A'}`);
          console.log(`     Date: ${fullSale.created_at || fullSale.sale_date || 'N/A'}`);
          console.log(`     Total: $${fullSale.total_price_incl || fullSale.total_price || 0}`);
          console.log(`     Status: ${fullSale.status || 'N/A'}`);
          console.log(`     State: ${fullSale.state || 'N/A'}`);
          console.log(`     Customer Email in Sale: ${fullSale.customer?.email || 'N/A'}`);
          console.log(`     Customer ID in Sale: ${fullSale.customer_id || 'N/A'}`);
          console.log(`     Note: ${fullSale.note || 'N/A'}`);
        } catch (e) {
          console.log(`     Error fetching sale ${sale.id}: ${e}`);
        }
      }
    }

    // Step 5: Check if we can query by customer_id directly
    console.log('\n📥 Step 4: Testing direct customer_id query...');
    try {
      // Try /sales endpoint with customer_id (this works!)
      const directQuery = await apiRequest(`/sales?customer_id=${CUSTOMER_ID}&page_size=50`);
      const directSales = Array.isArray(directQuery.data) ? directQuery.data : [];
      console.log(`   ✅ Query /sales with customer_id param: ${directSales.length} results`);
      
      if (directSales.length > 0) {
        console.log(`\n   Found ${directSales.length} sales! Checking all for Nov 2025 order...`);
        
        // Look for Nov 16, 2025 order
        const nov16Order = directSales.find((sale: any) => {
          const date = sale.created_at || sale.sale_date;
          return date && date.includes('2025-11-16');
        });
        
        if (nov16Order) {
          console.log(`\n   🎯 FOUND NOV 16 ORDER!`);
          console.log(`     ID: ${nov16Order.id}`);
          console.log(`     Receipt: ${nov16Order.receipt_number || nov16Order.invoice_number || 'N/A'}`);
          console.log(`     Date: ${nov16Order.created_at || nov16Order.sale_date || 'N/A'}`);
          console.log(`     Total: $${nov16Order.total_price_incl || nov16Order.total_price || 0}`);
          console.log(`     Status: ${nov16Order.status || 'N/A'}`);
          console.log(`     State: ${nov16Order.state || 'N/A'}`);
        } else {
          console.log(`\n   ⚠️  Nov 16 order NOT found in first ${directSales.length} results`);
          console.log(`   Showing date range of sales:`);
          const dates = directSales.map((s: any) => s.created_at || s.sale_date).filter(Boolean);
          if (dates.length > 0) {
            dates.sort();
            console.log(`     Earliest: ${dates[0]}`);
            console.log(`     Latest: ${dates[dates.length - 1]}`);
          }
          
          // Show all sales with their dates
          console.log(`\n   All ${directSales.length} sales (showing first 10):`);
          directSales.slice(0, 10).forEach((sale: any, i: number) => {
            const date = sale.created_at || sale.sale_date || 'N/A';
            const total = sale.total_price_incl || sale.total_price || 0;
            console.log(`     ${i + 1}. ${date} - $${total} - Status: ${sale.status}/${sale.state}`);
          });
        }
      }
    } catch (e) {
      console.log(`   ❌ Direct query error: ${e}`);
    }

    // Step 6: Search for receipt 2030 (from screenshot)
    console.log('\n📥 Step 5: Searching for receipt 2030 (from screenshot)...');
    try {
      // Try searching all sales for receipt 2030
      const receiptSearch = await apiRequest(`/search?type=sales&q=2030&page_size=100`);
      const receiptSales = Array.isArray(receiptSearch.data) ? receiptSearch.data : [];
      console.log(`   Found ${receiptSales.length} sales with "2030" in search`);
      
      if (receiptSales.length > 0) {
        receiptSales.forEach((sale: any) => {
          if (sale.receipt_number === '2030' || sale.invoice_number === '2030' || sale.id?.includes('2030')) {
            console.log(`\n   🎯 FOUND RECEIPT 2030!`);
            console.log(`     ID: ${sale.id}`);
            console.log(`     Customer ID: ${sale.customer_id || 'N/A'}`);
            console.log(`     Date: ${sale.created_at || sale.sale_date || 'N/A'}`);
            console.log(`     Total: $${sale.total_price_incl || sale.total_price || 0}`);
            console.log(`     Status: ${sale.status || 'N/A'}`);
            console.log(`     State: ${sale.state || 'N/A'}`);
            
            // Check if customer_id matches
            if (sale.customer_id === CUSTOMER_ID) {
              console.log(`     ✅ Customer ID matches!`);
            } else {
              console.log(`     ⚠️  Customer ID mismatch! Expected: ${CUSTOMER_ID}, Got: ${sale.customer_id}`);
            }
          }
        });
      }
      
      // Also try searching by date Nov 16, 2025
      console.log('\n   Searching for Nov 16, 2025 sales...');
      const nov16Search = await apiRequest(`/search?type=sales&created_at_min=2025-11-16&created_at_max=2025-11-16&page_size=200`);
      const nov16Sales = Array.isArray(nov16Search.data) ? nov16Search.data : [];
      console.log(`   Found ${nov16Sales.length} sales on Nov 16, 2025`);
      
      if (nov16Sales.length > 0) {
        // Look for $20 orders (check both price fields and allow small variance)
        const twentyDollarOrders = nov16Sales.filter((s: any) => {
          const totalIncl = s.total_price_incl || 0;
          const totalExcl = s.total_price || 0;
          return Math.abs(totalIncl - 20) < 0.5 || Math.abs(totalExcl - 20) < 0.5;
        });
        console.log(`   Found ${twentyDollarOrders.length} orders around $20 total`);
        
        // Also check for receipt 2030 specifically
        const receipt2030 = nov16Sales.find((s: any) => {
          const receipt = String(s.receipt_number || s.invoice_number || '');
          return receipt === '2030' || receipt.endsWith('2030');
        });
        
        if (receipt2030) {
          console.log(`\n   🎯🎯🎯 RECEIPT 2030 FOUND IN NOV 16 SALES! 🎯🎯🎯`);
          console.log(`     ID: ${receipt2030.id}`);
          console.log(`     Receipt Number: ${receipt2030.receipt_number || receipt2030.invoice_number || 'N/A'}`);
          console.log(`     Customer ID: ${receipt2030.customer_id || 'N/A'}`);
          console.log(`     Total (incl): $${receipt2030.total_price_incl || 0}`);
          console.log(`     Total (excl): $${receipt2030.total_price || 0}`);
          console.log(`     Status: ${receipt2030.status || 'N/A'}`);
          console.log(`     State: ${receipt2030.state || 'N/A'}`);
          
          if (receipt2030.customer_id === CUSTOMER_ID) {
            console.log(`     ✅ Customer ID MATCHES!`);
          } else {
            console.log(`     ⚠️  Customer ID MISMATCH!`);
            console.log(`        Expected: ${CUSTOMER_ID}`);
            console.log(`        Got: ${receipt2030.customer_id}`);
            console.log(`        This confirms duplicate customer issue!`);
            console.log(`        The order is linked to a DIFFERENT customer record.`);
          }
        } else {
          console.log(`\n   ⚠️  Receipt 2030 NOT found in Nov 16 sales results`);
          console.log(`   Checking receipt numbers in results...`);
          const receiptNumbers = nov16Sales.map((s: any) => s.receipt_number || s.invoice_number || 'N/A').slice(0, 10);
          console.log(`   Sample receipt numbers: ${receiptNumbers.join(', ')}`);
        }
        
        if (twentyDollarOrders.length > 0) {
          twentyDollarOrders.forEach((sale: any) => {
            console.log(`\n   🎯 $20 ORDER FOUND:`);
            console.log(`     ID: ${sale.id}`);
            console.log(`     Receipt: ${sale.receipt_number || sale.invoice_number || 'N/A'}`);
            console.log(`     Customer ID: ${sale.customer_id || 'N/A'}`);
            console.log(`     Total: $${sale.total_price_incl || sale.total_price || 0}`);
            console.log(`     Status: ${sale.status || 'N/A'}`);
            console.log(`     State: ${sale.state || 'N/A'}`);
            
            if (sale.customer_id === CUSTOMER_ID) {
              console.log(`     ✅ Customer ID MATCHES!`);
            } else {
              console.log(`     ⚠️  Customer ID MISMATCH!`);
              console.log(`        Expected: ${CUSTOMER_ID}`);
              console.log(`        Got: ${sale.customer_id}`);
              console.log(`        This might be a duplicate customer issue!`);
            }
          });
        }
        
      }
    } catch (e) {
      console.log(`   Error searching for receipt: ${e}`);
    }

    console.log('\n✅ Test complete!\n');

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(60));
    console.error(error.message);
    process.exit(1);
  }
}

main();
