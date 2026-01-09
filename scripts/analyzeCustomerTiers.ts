#!/usr/bin/env node
/**
 * Customer Export Script
 * 
 * Pulls all customers from Lightspeed Retail (X-Series).
 * Exports to CSV for tier/ambassador program setup.
 * 
 * Note: Tier assignment will be based on referred sales (not lifetime spend).
 * This script just gets all customer data - tier logic comes later.
 * 
 * Usage: npx tsx scripts/analyzeCustomerTiers.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

interface CustomerTierData {
  customerId: string;
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  lifetimeSpend: number;
  totalSales: number;
  tier: string;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
}

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
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

// Tier assignment will be based on referred sales (from screenshot):
// Seed: Join + make first purchase
// Sprout: 3 referred sales
// Bloom: 10 referred sales  
// Evergreen: 25+ referred sales
// 
// For now, all customers will be "None" until referral tracking is implemented
function getTierFromReferredSales(referredSales: number, hasMadePurchase: boolean): string {
  if (referredSales >= 25) return 'Evergreen';
  if (referredSales >= 10) return 'Bloom';
  if (referredSales >= 3) return 'Sprout';
  if (hasMadePurchase) return 'Seed';
  return 'None';
}

async function getAllCustomers(): Promise<any[]> {
  console.log('📥 Fetching all customers...\n');
  
  // Get total count first
  const firstPage = await apiRequest(`/search?type=customers&page_size=1`);
  const totalCount = firstPage.total_count || 0;
  console.log(`   Total customers in system: ${totalCount}\n`);
  
  // Strategy: Use offset-based pagination (discovered that offset parameter works!)
  const allCustomers: any[] = [];
  const seenIds = new Set<string>();
  const pageSize = 200;
  let offset = 0;
  let hasMore = true;
  let page = 1;

  while (hasMore && offset < totalCount) {
    try {
      const endpoint = `/search?type=customers&page_size=${pageSize}&offset=${offset}`;
      const data = await apiRequest(endpoint);
      const customers = Array.isArray(data.data) ? data.data : [];
      
      if (customers.length === 0) {
        console.log('   No more customers found');
        break;
      }
      
      // Deduplicate by customer ID (just in case)
      let newCustomers = 0;
      for (const customer of customers) {
        if (customer.id && !seenIds.has(customer.id)) {
          seenIds.add(customer.id);
          allCustomers.push(customer);
          newCustomers++;
        }
      }
      
      const progress = ((allCustomers.length / totalCount) * 100).toFixed(1);
      console.log(`   Page ${page}: ${customers.length} returned, ${newCustomers} new (Total: ${allCustomers.length}/${totalCount} - ${progress}%)`);
      
      // Update offset for next batch
      offset += pageSize;
      
      // Continue if we got customers and haven't reached the total
      hasMore = customers.length > 0 && offset < totalCount;
      
      // Safety limit
      if (page >= 100) {
        console.log('   ⚠️  Reached page limit (100 pages)');
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error: any) {
      console.error(`   ❌ Error on page ${page}: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Fetched ${allCustomers.length} unique customers (of ${totalCount} total)\n`);
  if (allCustomers.length < totalCount) {
    const percentage = ((allCustomers.length / totalCount) * 100).toFixed(1);
    console.log(`   ⚠️  WARNING: Got ${allCustomers.length} of ${totalCount} customers (${percentage}%)`);
    if (allCustomers.length < totalCount * 0.9) {
      console.log(`   Some customers may have been missed due to API limitations.\n`);
    }
  }
  return allCustomers;
}

async function getAllSales(): Promise<Map<string, any[]>> {
  console.log('📥 Fetching all sales (this may take a while)...\n');
  
  const salesByCustomer = new Map<string, any[]>();
  let page = 1;
  const pageSize = 200;
  let totalSales = 0;
  let hasMore = true;

  // Use search endpoint to get most recent sales first
  while (hasMore) {
    try {
      const data = await apiRequest(`/search?type=sales&page_size=${pageSize}`);
      const sales = Array.isArray(data.data) ? data.data : [];
      
      if (sales.length === 0) break;
      
      // Group sales by customer_id
      for (const sale of sales) {
        if (sale.customer_id && sale.status === 'CLOSED' && sale.state === 'closed') {
          if (!salesByCustomer.has(sale.customer_id)) {
            salesByCustomer.set(sale.customer_id, []);
          }
          salesByCustomer.get(sale.customer_id)!.push(sale);
          totalSales++;
        }
      }
      
      console.log(`   Page ${page}: ${sales.length} sales (${totalSales} total, ${salesByCustomer.size} customers)`);
      
      // Check pagination
      const pageInfo = data.page_info;
      if (!pageInfo?.has_next_page) {
        hasMore = false;
      } else {
        // For now, we'll fetch a reasonable number of pages
        // Since we're going back in time, we'll stop after a certain point
        // or when we've covered enough sales
        // Limit to reasonable number of pages for now
        // Each page is 200 sales, so 200 pages = 40k sales
        // This should cover most/all customers for tier analysis
        if (page >= 200) {
          console.log('   ⚠️  Reached page limit (200 pages = ~40k sales)');
          console.log('   This should cover most customers. Increase limit if needed.');
          hasMore = false;
        } else {
          // Try to get next page using cursor (if supported)
          // For now, we'll just continue with sequential pages
          hasMore = true;
        }
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`   ❌ Error on page ${page}: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Processed ${totalSales} sales for ${salesByCustomer.size} customers\n`);
  return salesByCustomer;
}

function calculateCustomerLifetimeSpend(sales: any[]): {
  lifetimeSpend: number;
  totalSales: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
} {
  let lifetimeSpend = 0;
  let firstSaleDate: Date | null = null;
  let lastSaleDate: Date | null = null;

  for (const sale of sales) {
    const amount = typeof sale.total_price === 'number' ? sale.total_price : 0;
    lifetimeSpend += amount;

    if (sale.created_at) {
      const saleDate = new Date(sale.created_at);
      if (!firstSaleDate || saleDate < firstSaleDate) {
        firstSaleDate = saleDate;
      }
      if (!lastSaleDate || saleDate > lastSaleDate) {
        lastSaleDate = saleDate;
      }
    }
  }

  return {
    lifetimeSpend,
    totalSales: sales.length,
    firstSaleDate: firstSaleDate ? firstSaleDate.toISOString().split('T')[0] : null,
    lastSaleDate: lastSaleDate ? lastSaleDate.toISOString().split('T')[0] : null,
  };
}

async function main() {
  console.log('🎯 CUSTOMER TIER ANALYSIS');
  console.log('═'.repeat(60));
  console.log(`🌐 Store: ${DOMAIN_PREFIX}.retail.lightspeed.app\n`);

  if (!TOKEN) {
    console.error('❌ ERROR: No token set in .env!');
    process.exit(1);
  }

  try {
    // Step 1: Get all customers
    const customers = await getAllCustomers();
    
    if (customers.length === 0) {
      console.log('❌ No customers found');
      process.exit(1);
    }

    console.log('📋 Processing customer data...\n');

    const customerData: CustomerData[] = [];

    // Process all customers
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      
      const name = customer.name || 
        (customer.first_name && customer.last_name 
          ? `${customer.first_name} ${customer.last_name}` 
          : customer.first_name || customer.last_name || 'Unknown');

      if (i % 100 === 0 || i === customers.length - 1) {
        process.stdout.write(`\r   Processing: ${i + 1}/${customers.length} customers...`);
      }

      // Check if they've made a purchase (for Seed tier eligibility)
      // Seed tier requires: Join + make first purchase
      // We'll check if they have any sales by looking at year_to_date or balance
      // But be conservative - only mark as purchase if there's clear evidence
      const hasMadePurchase = typeof customer.year_to_date === 'number' && customer.year_to_date > 0;

      // For now, referred sales = 0 (will be populated when referral tracking is set up)
      const referredSales = 0;
      const tier = getTierFromReferredSales(referredSales, hasMadePurchase);

      customerData.push({
        customerId: customer.id || '',
        customerCode: customer.customer_code || customer.id || '',
        name,
        email: customer.email || '',
        phone: customer.phone || customer.mobile || customer.phone_number || '',
        referredSales,
        tier,
        hasMadePurchase,
        createdAt: customer.created_at ? new Date(customer.created_at).toISOString().split('T')[0] : null,
      });
    }

    console.log(`\r   Processed: ${customerData.length} customers                    \n`);

    console.log('\n\n✅ Analysis complete!\n');

    // Step 2: Generate summary
    const tierCounts: Record<string, number> = {};
    let customersWithPurchases = 0;

    customerData.forEach(customer => {
      tierCounts[customer.tier] = (tierCounts[customer.tier] || 0) + 1;
      if (customer.hasMadePurchase) customersWithPurchases++;
    });

    console.log('📊 CUSTOMER SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total Customers: ${customerData.length}`);
    console.log(`   Customers with Purchases: ${customersWithPurchases}`);
    console.log(`\n   Tier Distribution (based on referred sales - currently all 0):`);
    console.log(`   Evergreen (25+ referrals): ${tierCounts['Evergreen'] || 0}`);
    console.log(`   Bloom (10+ referrals): ${tierCounts['Bloom'] || 0}`);
    console.log(`   Sprout (3+ referrals): ${tierCounts['Sprout'] || 0}`);
    console.log(`   Seed (first purchase): ${tierCounts['Seed'] || 0}`);
    console.log(`   None: ${tierCounts['None'] || 0}`);
    console.log(`\n   ⚠️  Note: Referred sales tracking not yet implemented.`);
    console.log(`   All customers currently show 0 referred sales.\n`);

    // Step 3: Export to CSV
    const csvRows: string[] = [];
    csvRows.push('Customer ID,Customer Code,Name,Email,Phone,Referred Sales,Tier,Has Made Purchase,Created At');
    
    customerData.forEach(customer => {
      const row = [
        customer.customerId,
        customer.customerCode,
        `"${customer.name.replace(/"/g, '""')}"`,
        customer.email,
        customer.phone,
        customer.referredSales.toString(),
        customer.tier,
        customer.hasMadePurchase ? 'Yes' : 'No',
        customer.createdAt || '',
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const csvPath = path.join(process.cwd(), `all_customers_${new Date().toISOString().split('T')[0]}.csv`);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    console.log('💾 EXPORT');
    console.log('═'.repeat(60));
    console.log(`   CSV saved to: ${csvPath}\n`);
    console.log(`   📝 This is a CSV export only - NOT saved to Firebase.`);
    console.log(`   You can import this into Google Sheets, Excel, or your database later.\n`);

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(60));
    console.error(error.message);
    process.exit(1);
  }
}

main();
