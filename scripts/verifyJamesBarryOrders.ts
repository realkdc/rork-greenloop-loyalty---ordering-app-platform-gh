#!/usr/bin/env node
/**
 * Verify James Barry's order count via API
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

async function getAllSales(customerId: string): Promise<any[]> {
  const allSales: any[] = [];
  const pageSize = 200;
  let offset = 0;
  
  console.log(`   Fetching sales (this may take a moment)...`);
  
  while (true) {
    const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`);
    const sales = Array.isArray(result.data) ? result.data : [];
    
    const closedSales = sales.filter((s: any) => 
      (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && 
      s.state === 'closed'
    );
    
    allSales.push(...closedSales);
    
    if (sales.length < pageSize) break;
    offset += pageSize;
    process.stdout.write(`\r   Fetched ${allSales.length} orders so far...`);
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`\r   Fetched ${allSales.length} orders total                    \n`);
  return allSales;
}

async function main() {
  const email = 'jmbarry1988@gmail.com';
  const phone = '9313160687';
  const name = 'James Barry';
  
  console.log('🔍 VERIFYING JAMES BARRY ORDERS VIA API');
  console.log('═'.repeat(70));
  console.log(`Name: ${name}`);
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
  console.log('');
  
  // Find customer by email
  console.log('📧 Searching by email...');
  let customer = null;
  try {
    const emailSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(email)}&page_size=10`);
    const emailCustomers = Array.isArray(emailSearch.data) ? emailSearch.data : [];
    customer = emailCustomers.find((c: any) => 
      (c.email || '').toLowerCase() === email.toLowerCase()
    );
    
    if (customer) {
      console.log(`   ✅ Found customer: ${customer.id}`);
      console.log(`   Name: ${customer.name || 'N/A'}`);
      console.log(`   Email: ${customer.email || 'N/A'}`);
      console.log(`   Phone: ${customer.phone || customer.mobile || 'N/A'}`);
      console.log(`   Customer Code: ${customer.customer_code || 'N/A'}`);
      console.log('');
    } else {
      console.log(`   ❌ No customer found with this email\n`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
  
  // Also try phone search
  if (!customer) {
    console.log('📱 Searching by phone...');
    try {
      const phoneSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(phone)}&page_size=10`);
      const phoneCustomers = Array.isArray(phoneSearch.data) ? phoneSearch.data : [];
      customer = phoneCustomers.find((c: any) => {
        const cPhone = (c.phone || c.mobile || c.phone_number || '').replace(/\D/g, '');
        return cPhone === phone.replace(/\D/g, '');
      });
      
      if (customer) {
        console.log(`   ✅ Found customer: ${customer.id}`);
        console.log(`   Name: ${customer.name || 'N/A'}`);
        console.log(`   Email: ${customer.email || 'N/A'}`);
        console.log(`   Phone: ${customer.phone || customer.mobile || 'N/A'}`);
        console.log('');
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  if (!customer) {
    console.log('❌ Customer not found in API');
    process.exit(1);
  }
  
  // Get all orders
  console.log(`📦 Fetching ALL orders for customer ${customer.id}...`);
  const orders = await getAllSales(customer.id);
  
  console.log('📊 ORDER SUMMARY');
  console.log('═'.repeat(70));
  console.log(`   Total Orders: ${orders.length}`);
  
  if (orders.length > 0) {
    const total = orders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
    const avg = total / orders.length;
    
    console.log(`   Total Lifetime Value: $${total.toFixed(2)}`);
    console.log(`   Average Order Value: $${avg.toFixed(2)}`);
    
    // Get date range
    const dates = orders
      .map(s => s.created_at ? new Date(s.created_at) : null)
      .filter(d => d !== null)
      .sort((a, b) => a!.getTime() - b!.getTime());
    
    if (dates.length > 0) {
      console.log(`   First Order: ${dates[0]!.toLocaleDateString()}`);
      console.log(`   Last Order: ${dates[dates.length - 1]!.toLocaleDateString()}`);
    }
    
    console.log('');
    console.log('📋 Recent Orders (last 10):');
    orders.slice(0, 10).forEach((sale, i) => {
      const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
      const amount = (sale.total_price_incl || sale.total_price || 0).toFixed(2);
      const receipt = sale.receipt_number || sale.id;
      console.log(`   ${i + 1}. ${date} - $${amount} - Receipt: ${receipt}`);
    });
    
    if (orders.length > 10) {
      console.log(`   ... and ${orders.length - 10} more orders`);
    }
  } else {
    console.log(`   ⚠️  No orders found`);
  }
  
  console.log('');
  console.log('✅ API Verification Complete');
}

main().catch(console.error);
