#!/usr/bin/env node
/**
 * Test searching for Nikki's orders using email search (like the dashboard does)
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const EMAIL = 'nikkijo74@msn.com';
const EMAIL_PART = 'nikkijo';

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
  console.log('🔍 TESTING EMAIL SEARCH FOR NIKKI\'S ORDERS');
  console.log('═'.repeat(70));
  console.log(`Email: ${EMAIL}`);
  console.log(`Email part: ${EMAIL_PART}\n`);

  try {
    // Test 1: Search sales by email directly
    console.log('📥 Test 1: Search sales with email in query...');
    const emailSearch = await apiRequest(`/search?type=sales&q=${encodeURIComponent(EMAIL)}&page_size=200`);
    const emailSales = Array.isArray(emailSearch.data) ? emailSearch.data : [];
    console.log(`   Found ${emailSales.length} sales with email search\n`);
    
    if (emailSales.length > 0) {
      emailSales.forEach((sale: any, i: number) => {
        const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
        const date = sale.created_at || sale.sale_date || 'N/A';
        const total = sale.total_price_incl || sale.total_price || 0;
        const customerId = sale.customer_id || 'N/A';
        console.log(`   ${i + 1}. Receipt: ${receipt}, Date: ${date}, Total: $${total}, Customer ID: ${customerId}`);
      });
    }
    
    // Test 2: Search sales by email part
    console.log('\n📥 Test 2: Search sales with email part...');
    const partSearch = await apiRequest(`/search?type=sales&q=${encodeURIComponent(EMAIL_PART)}&page_size=200`);
    const partSales = Array.isArray(partSearch.data) ? partSearch.data : [];
    console.log(`   Found ${partSales.length} sales with email part search\n`);
    
    if (partSales.length > 0) {
      // Filter to Nikki's customer ID
      const customer = await apiRequest(`/search?type=customers&q=${encodeURIComponent(EMAIL)}&page_size=10`);
      const customers = Array.isArray(customer.data) ? customer.data : [];
      const nikki = customers.find((c: any) => (c.email || '').toLowerCase() === EMAIL.toLowerCase());
      
      if (nikki) {
        const nikkiSales = partSales.filter((s: any) => s.customer_id === nikki.id);
        console.log(`   Found ${nikkiSales.length} sales for Nikki's customer ID\n`);
        
        nikkiSales.forEach((sale: any, i: number) => {
          const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
          const date = sale.created_at || sale.sale_date || 'N/A';
          const total = sale.total_price_incl || sale.total_price || 0;
          console.log(`   ${i + 1}. Receipt: ${receipt}, Date: ${date}, Total: $${total}`);
        });
      }
    }
    
    // Test 3: Get customer first, then search with larger page size
    console.log('\n📥 Test 3: Get customer, then search with larger page size...');
    const customer = await apiRequest(`/search?type=customers&q=${encodeURIComponent(EMAIL)}&page_size=10`);
    const customers = Array.isArray(customer.data) ? customer.data : [];
    const nikki = customers.find((c: any) => (c.email || '').toLowerCase() === EMAIL.toLowerCase());
    
    if (nikki) {
      console.log(`   Customer ID: ${nikki.id}\n`);
      
      // Try with much larger page size
      const largeSearch = await apiRequest(`/search?type=sales&customer_id=${nikki.id}&page_size=500`);
      const largeSales = Array.isArray(largeSearch.data) ? largeSearch.data : [];
      console.log(`   Found ${largeSales.length} sales with page_size=500\n`);
      
      if (largeSales.length > 0) {
        largeSales.forEach((sale: any, i: number) => {
          const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
          const date = sale.created_at || sale.sale_date || 'N/A';
          const total = sale.total_price_incl || sale.total_price || 0;
          const status = sale.status || 'N/A';
          console.log(`   ${i + 1}. Receipt: ${receipt}, Date: ${date}, Total: $${total}, Status: ${status}`);
        });
      }
      
      // Also try pagination
      console.log('\n📥 Test 4: Try pagination...');
      let allSales: any[] = [];
      let offset = 0;
      const pageSize = 200;
      
      while (offset < 1000) {
        const pageResult = await apiRequest(`/search?type=sales&customer_id=${nikki.id}&page_size=${pageSize}&offset=${offset}`);
        const pageSales = Array.isArray(pageResult.data) ? pageResult.data : [];
        
        if (pageSales.length === 0) break;
        
        allSales.push(...pageSales);
        console.log(`   Offset ${offset}: ${pageSales.length} sales (Total: ${allSales.length})`);
        
        if (pageSales.length < pageSize) break;
        offset += pageSize;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`\n   Total sales found with pagination: ${allSales.length}\n`);
      
      if (allSales.length > 0) {
        allSales.forEach((sale: any, i: number) => {
          const receipt = sale.receipt_number || sale.invoice_number || 'N/A';
          const date = sale.created_at || sale.sale_date || 'N/A';
          const total = sale.total_price_incl || sale.total_price || 0;
          const status = sale.status || 'N/A';
          console.log(`   ${i + 1}. Receipt: ${receipt}, Date: ${date}, Total: $${total}, Status: ${status}`);
        });
      }
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
