#!/usr/bin/env node
/**
 * Verify a specific customer record against the API
 */

import 'dotenv/config';
import * as fs from 'fs';

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
  const searchName = process.argv[2] || 'KeShaun Camon';
  
  console.log(`🔍 VERIFYING CUSTOMER: ${searchName}`);
  console.log('═'.repeat(70));
  console.log('');
  
  // Search in CSV
  const csvFile = 'customer_analytics_updated_2026-01-06.csv';
  const content = fs.readFileSync(csvFile, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(',');
  
  const matches: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const name = row[2] || '';
    if (name.toLowerCase().includes(searchName.toLowerCase())) {
      const record: any = {};
      header.forEach((h, idx) => {
        record[h] = row[idx] || '';
      });
      matches.push(record);
    }
  }
  
  if (matches.length === 0) {
    console.log('❌ No matches found in CSV');
    process.exit(1);
  }
  
  console.log(`📊 Found ${matches.length} record(s) in CSV:\n`);
  matches.forEach((match, i) => {
    console.log(`Record ${i + 1}:`);
    console.log(`  Customer ID: ${match['Customer ID'] || 'N/A'}`);
    console.log(`  Name: ${match.Name || 'N/A'}`);
    console.log(`  Email: ${match.Email || 'N/A'}`);
    console.log(`  Phone: ${match.Phone || 'N/A'}`);
    console.log(`  Lifetime Value: $${match['Lifetime Value'] || '0'}`);
    console.log(`  Order Count: ${match['Order Count'] || '0'}`);
    console.log(`  Avg Order Value: $${match['Avg Order Value'] || '0'}`);
    console.log('');
  });
  
  // Verify against API
  for (const match of matches) {
    const customerId = match['Customer ID'];
    if (!customerId) {
      console.log(`⚠️  No Customer ID for this record - cannot verify`);
      continue;
    }
    
    console.log(`🔍 Verifying Customer ID: ${customerId}`);
    console.log('─'.repeat(70));
    
    try {
      // Get customer from API
      const customer = await apiRequest(`/customers/${customerId}`);
      const customerData = customer.data || customer;
      
      console.log(`API Customer Data:`);
      console.log(`  Name: ${customerData.name || customerData.first_name + ' ' + customerData.last_name || 'N/A'}`);
      console.log(`  Email: ${customerData.email || 'N/A'}`);
      console.log(`  Phone: ${customerData.phone || customerData.mobile || 'N/A'}`);
      console.log(`  Customer Code: ${customerData.customer_code || 'N/A'}`);
      console.log('');
      
      // Get all sales
      console.log('Fetching sales from API...');
      const allSales: any[] = [];
      let offset = 0;
      
      while (true) {
        const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=200&offset=${offset}`);
        const sales = Array.isArray(result.data) ? result.data : [];
        
        const closedSales = sales.filter((s: any) => 
          (s.status === 'CLOSED' || s.status === 'DISPATCHED_CLOSED') && 
          s.state === 'closed'
        );
        
        allSales.push(...closedSales);
        
        if (sales.length < 200) break;
        offset += 200;
        await new Promise(r => setTimeout(r, 50));
      }
      
      const total = allSales.reduce((sum, sale) => {
        const amount = typeof sale.total_price_incl === 'number' 
          ? sale.total_price_incl 
          : (typeof sale.total_price === 'number' ? sale.total_price : 0);
        return sum + amount;
      }, 0);
      
      console.log(`✅ API Results:`);
      console.log(`   Orders: ${allSales.length}`);
      console.log(`   LTV: $${total.toFixed(2)}`);
      console.log(`   AOV: $${allSales.length > 0 ? (total / allSales.length).toFixed(2) : '0.00'}`);
      console.log('');
      
      if (allSales.length === 0) {
        console.log('⚠️  NO ORDERS FOUND IN API!');
        console.log('   This customer has no orders, but CSV shows orders.');
        console.log('   This could be:');
        console.log('   1. Duplicate customer record');
        console.log('   2. Data merge error');
        console.log('   3. Orders attributed to wrong customer ID');
      } else {
        console.log('📋 Recent orders:');
        allSales.slice(0, 5).forEach((sale, i) => {
          const date = sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A';
          const amount = sale.total_price_incl || sale.total_price || 0;
          console.log(`   ${i + 1}. ${date} - $${amount.toFixed(2)} - Receipt: ${sale.receipt_number || sale.id}`);
        });
      }
      
      console.log('');
      
    } catch (error: any) {
      console.log(`❌ Error fetching from API: ${error.message}`);
      console.log('');
    }
  }
  
  // Check for duplicates
  if (matches.length > 1) {
    console.log('⚠️  MULTIPLE RECORDS FOUND!');
    console.log('   This could indicate duplicate customer records.');
    console.log('');
  }
}

main().catch(console.error);
