#!/usr/bin/env node
/**
 * Directly query Lightspeed API to verify customer data
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
  
  console.log('🔍 VERIFYING CUSTOMER IN LIGHTSPEED API');
  console.log('═'.repeat(70));
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
  console.log('');
  
  // Search by email
  console.log('📧 Searching by email...');
  try {
    const emailSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(email)}&page_size=50`);
    const emailCustomers = Array.isArray(emailSearch.data) ? emailSearch.data : [];
    
    console.log(`   Found ${emailCustomers.length} customer(s) with this email\n`);
    
    if (emailCustomers.length > 0) {
      for (const customer of emailCustomers) {
        console.log(`   Customer ID: ${customer.id}`);
        console.log(`   Name: ${customer.name || customer.first_name + ' ' + customer.last_name || 'N/A'}`);
        console.log(`   Email: ${customer.email || 'N/A'}`);
        console.log(`   Phone: ${customer.phone || customer.mobile || 'N/A'}`);
        console.log(`   Customer Code: ${customer.customer_code || 'N/A'}`);
        console.log('');
        
        // Get sales for this customer
        const salesResult = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
        const sales = Array.isArray(salesResult.data) ? salesResult.data : [];
        const closedSales = sales.filter((s: any) => 
          (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && s.state === 'closed'
        );
        
        console.log(`   Orders: ${closedSales.length}`);
        if (closedSales.length > 0) {
          const total = closedSales.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
          console.log(`   LTV: $${total.toFixed(2)}`);
          console.log(`   Recent orders:`);
          closedSales.slice(0, 3).forEach((sale, i) => {
            const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
            console.log(`     ${i + 1}. ${date} - $${(sale.total_price_incl || sale.total_price || 0).toFixed(2)}`);
          });
        } else {
          console.log(`   ✅ NO ORDERS - This matches what you said!`);
        }
        console.log('');
      }
    } else {
      console.log('   ❌ No customer found with this email\n');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
  
  // Search by phone
  console.log('📱 Searching by phone...');
  try {
    const phoneSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(phone)}&page_size=50`);
    const phoneCustomers = Array.isArray(phoneSearch.data) ? phoneSearch.data : [];
    
    console.log(`   Found ${phoneCustomers.length} customer(s) with this phone\n`);
    
    if (phoneCustomers.length > 0) {
      for (const customer of phoneCustomers) {
        console.log(`   Customer ID: ${customer.id}`);
        console.log(`   Name: ${customer.name || customer.first_name + ' ' + customer.last_name || 'N/A'}`);
        console.log(`   Email: ${customer.email || '(no email)'}`);
        console.log(`   Phone: ${customer.phone || customer.mobile || 'N/A'}`);
        console.log(`   Customer Code: ${customer.customer_code || 'N/A'}`);
        console.log('');
        
        // Get sales for this customer
        const salesResult = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
        const sales = Array.isArray(salesResult.data) ? salesResult.data : [];
        const closedSales = sales.filter((s: any) => 
          (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && s.state === 'closed'
        );
        
        console.log(`   Orders: ${closedSales.length}`);
        if (closedSales.length > 0) {
          const total = closedSales.reduce((sum, s) => sum + (s.total_price_incl || s.total_price || 0), 0);
          console.log(`   LTV: $${total.toFixed(2)}`);
          console.log(`   Recent orders:`);
          closedSales.slice(0, 3).forEach((sale, i) => {
            const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
            console.log(`     ${i + 1}. ${date} - $${(sale.total_price_incl || sale.total_price || 0).toFixed(2)}`);
          });
        } else {
          console.log(`   ✅ NO ORDERS`);
        }
        console.log('');
      }
    } else {
      console.log('   ❌ No customer found with this phone\n');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
  
  // Check the specific customer ID from CSV
  console.log('🔍 Checking the "Keshaun Camon" customer ID from CSV...');
  const csvCustomerId = '02269032-111f-11f0-eb9a-7616bf2f236e';
  try {
    const customer = await apiRequest(`/customers/${csvCustomerId}`);
    const customerData = customer.data || customer;
    
    console.log(`   Customer ID: ${customerData.id}`);
    console.log(`   Name: ${customerData.name || 'N/A'}`);
    console.log(`   Email: ${customerData.email || '(no email)'}`);
    console.log(`   Phone: ${customerData.phone || customerData.mobile || 'N/A'}`);
    console.log(`   Customer Code: ${customerData.customer_code || 'N/A'}`);
    console.log('');
    
    if (customerData.email === email || customerData.phone === phone || customerData.mobile === phone) {
      console.log('   ⚠️  THIS CUSTOMER ID MATCHES YOUR EMAIL/PHONE!');
      console.log('   But you say you have no orders...');
      console.log('   This suggests:');
      console.log('     1. Orders were incorrectly attributed to this customer ID');
      console.log('     2. Someone else used your phone number');
      console.log('     3. There\'s a data integrity issue in Lightspeed');
    } else {
      console.log('   ✅ This customer ID does NOT match your email/phone');
      console.log('   This is likely a DIFFERENT person with the same name');
    }
    console.log('');
    
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }
}

main().catch(console.error);
