#!/usr/bin/env node
/**
 * Verify customer order count via API
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
  const email = 'kdcxmusic@gmail.com';
  const phone = '6053760333';
  
  console.log('🔍 VERIFYING CUSTOMER ORDERS VIA API');
  console.log('═'.repeat(70));
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
  console.log('');
  
  // Find customer by email
  console.log('📧 Searching by email...');
  let emailCustomer = null;
  try {
    const emailSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(email)}&page_size=10`);
    const emailCustomers = Array.isArray(emailSearch.data) ? emailSearch.data : [];
    emailCustomer = emailCustomers.find((c: any) => 
      (c.email || '').toLowerCase() === email.toLowerCase()
    );
    
    if (emailCustomer) {
      console.log(`   ✅ Found customer: ${emailCustomer.id}`);
      console.log(`   Name: ${emailCustomer.name || 'N/A'}`);
      console.log(`   Email: ${emailCustomer.email || 'N/A'}`);
      console.log(`   Phone: ${emailCustomer.phone || emailCustomer.mobile || 'N/A'}`);
      console.log('');
    } else {
      console.log(`   ❌ No customer found with this email\n`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
  
  // Find customer by phone
  console.log('📱 Searching by phone...');
  let phoneCustomer = null;
  try {
    const phoneSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(phone)}&page_size=10`);
    const phoneCustomers = Array.isArray(phoneSearch.data) ? phoneSearch.data : [];
    phoneCustomer = phoneCustomers.find((c: any) => {
      const cPhone = (c.phone || c.mobile || c.phone_number || '').replace(/\D/g, '');
      return cPhone === phone.replace(/\D/g, '');
    });
    
    if (phoneCustomer) {
      console.log(`   ✅ Found customer: ${phoneCustomer.id}`);
      console.log(`   Name: ${phoneCustomer.name || 'N/A'}`);
      console.log(`   Email: ${phoneCustomer.email || 'N/A'}`);
      console.log(`   Phone: ${phoneCustomer.phone || phoneCustomer.mobile || 'N/A'}`);
      console.log('');
    } else {
      console.log(`   ❌ No customer found with this phone\n`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
  
  // Get orders for email customer
  if (emailCustomer) {
    console.log(`📦 Fetching orders for email customer (${emailCustomer.id})...`);
    const emailOrders = await getAllSales(emailCustomer.id);
    console.log(`   ✅ Found ${emailOrders.length} orders`);
    if (emailOrders.length > 0) {
      const total = emailOrders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
      console.log(`   Total Value: $${total.toFixed(2)}`);
      console.log(`   Recent orders:`);
      emailOrders.slice(0, 5).forEach((sale, i) => {
        const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
        console.log(`     ${i + 1}. ${date} - $${(sale.total_price_incl || sale.total_price || 0).toFixed(2)} - Receipt: ${sale.receipt_number || sale.id}`);
      });
    }
    console.log('');
  }
  
  // Get orders for phone customer
  if (phoneCustomer && phoneCustomer.id !== emailCustomer?.id) {
    console.log(`📦 Fetching orders for phone customer (${phoneCustomer.id})...`);
    const phoneOrders = await getAllSales(phoneCustomer.id);
    console.log(`   ✅ Found ${phoneOrders.length} CLOSED orders`);
    if (phoneOrders.length > 0) {
      const total = phoneOrders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
      console.log(`   Total Value: $${total.toFixed(2)}`);
      console.log(`   Recent orders:`);
      phoneOrders.slice(0, 5).forEach((sale, i) => {
        const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
        console.log(`     ${i + 1}. ${date} - $${(sale.total_price_incl || sale.total_price || 0).toFixed(2)} - Receipt: ${sale.receipt_number || sale.id}`);
      });
    }
    
    // Also check ALL sales (any status)
    console.log(`   Checking ALL sales (any status)...`);
    const allPhoneSales = await getAllSales(phoneCustomer.id, true);
    console.log(`   ✅ Found ${allPhoneSales.length} total sales (all statuses)`);
    if (allPhoneSales.length > phoneOrders.length) {
      const statusCounts = new Map<string, number>();
      allPhoneSales.forEach(s => {
        const status = `${s.status || 'UNKNOWN'}/${s.state || 'UNKNOWN'}`;
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      });
      console.log(`   Status breakdown:`);
      statusCounts.forEach((count, status) => {
        console.log(`     ${status}: ${count}`);
      });
    }
    console.log('');
  }
  
  // Check eCom orders
  console.log('🛒 Checking eCom orders for your email...');
  try {
    const fs = require('fs');
    const ecomFile = 'ecom_orders_export.csv';
    if (fs.existsSync(ecomFile)) {
      const content = fs.readFileSync(ecomFile, 'utf-8');
      const lines = content.split('\n');
      const ecomOrders = lines.filter((line: string) => 
        line.toLowerCase().includes(email.toLowerCase())
      );
      console.log(`   ✅ Found ${ecomOrders.length} eCom order lines (may include line items)`);
      
      // Count unique orders
      const orderNumbers = new Set<string>();
      ecomOrders.forEach((line: string) => {
        const parts = line.split(';');
        if (parts[0] && parts[0].trim()) {
          orderNumbers.add(parts[0].trim());
        }
      });
      console.log(`   Unique eCom orders: ${orderNumbers.size}`);
      if (orderNumbers.size > 0) {
        console.log(`   Order numbers: ${Array.from(orderNumbers).slice(0, 10).join(', ')}${orderNumbers.size > 10 ? '...' : ''}`);
      }
    } else {
      console.log(`   ⚠️  eCom export file not found`);
    }
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }
  console.log('');
  
  // Combined total
  if (emailCustomer && phoneCustomer && emailCustomer.id !== phoneCustomer.id) {
    const emailOrders = await getAllSales(emailCustomer.id);
    const phoneOrders = await getAllSales(phoneCustomer.id);
    const allOrderIds = new Set([...emailOrders.map(s => s.id), ...phoneOrders.map(s => s.id)]);
    
    console.log('📊 COMBINED TOTALS (both customer IDs):');
    console.log('═'.repeat(70));
    console.log(`   Total Unique Orders: ${allOrderIds.size}`);
    const emailTotal = emailOrders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
    const phoneTotal = phoneOrders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
    console.log(`   Email Customer Orders: ${emailOrders.length} = $${emailTotal.toFixed(2)}`);
    console.log(`   Phone Customer Orders: ${phoneOrders.length} = $${phoneTotal.toFixed(2)}`);
    console.log(`   Combined Total Value: $${(emailTotal + phoneTotal).toFixed(2)}`);
    console.log('');
  } else if (emailCustomer || phoneCustomer) {
    const customer = emailCustomer || phoneCustomer;
    const orders = await getAllSales(customer!.id);
    console.log('📊 TOTAL ORDERS:');
    console.log('═'.repeat(70));
    console.log(`   Orders: ${orders.length}`);
    const total = orders.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
    console.log(`   Total Value: $${total.toFixed(2)}`);
    console.log(`   Average Order Value: $${orders.length > 0 ? (total / orders.length).toFixed(2) : '0.00'}`);
  }
}

async function getAllSales(customerId: string, includeAllStatuses: boolean = false): Promise<any[]> {
  const allSales: any[] = [];
  const pageSize = 200;
  let offset = 0;
  
  while (true) {
    const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`);
    const sales = Array.isArray(result.data) ? result.data : [];
    
    if (includeAllStatuses) {
      allSales.push(...sales);
    } else {
      const closedSales = sales.filter((s: any) => 
        (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && 
        s.state === 'closed'
      );
      allSales.push(...closedSales);
    }
    
    if (sales.length < pageSize) break;
    offset += pageSize;
    await new Promise(r => setTimeout(r, 50));
  }
  
  return allSales;
}

main().catch(console.error);
