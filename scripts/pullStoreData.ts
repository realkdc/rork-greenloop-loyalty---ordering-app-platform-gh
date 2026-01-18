/**
 * Pull Real Store Data from Lightspeed Retail API
 * 
 * This script pulls actual data from your store to confirm the API is working.
 * 
 * Usage: npx tsx scripts/pullStoreData.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

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
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('📊 TODAY\'S SALES FROM LIGHTSPEED RETAIL');
  console.log('═'.repeat(60));
  console.log(`🌐 Store: ${DOMAIN_PREFIX}.retail.lightspeed.app\n`);

  try {
    if (!TOKEN) {
      throw new Error('Missing EXPO_PUBLIC_LIGHTSPEED_TOKEN in .env');
    }

    // 1) Get retailer info to determine store timezone
    const retailer = await apiRequest('/retailer');
    const storeTimezone = retailer.time_zone || 'America/Chicago';
    console.log(`📍 Store Timezone: ${storeTimezone}\n`);

    // 2) Compute “today” in store timezone (YYYY-MM-DD)
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: storeTimezone }); // YYYY-MM-DD
    console.log(`📅 Today (store): ${todayStr}\n`);

    // 3) Use the Search API for "most recent sales" (this is what surfaces 2026+ sales).
    // Note: the /search endpoint is cursor-based, but for "today so far" it's extremely
    // unlikely you’ll exceed 200 sales; we warn if you do.
    const pageSize = 200;
    console.log('🔍 Fetching most recent sales via `/search?type=sales`...\n');

    const search = await apiRequest(`/search?type=sales&page_size=${pageSize}`);
    const sales = Array.isArray(search.data) ? search.data : [];

    let saleCount = 0;
    let totalRevenue = 0;
    let lastSaleUtc: Date | null = null;

    for (const sale of sales) {
      if (!sale?.created_at) continue;

      // Match the dashboard’s "Today" by store timezone date + only CLOSED sales.
      const isClosed = sale.status === 'CLOSED' && sale.state === 'closed';
      if (!isClosed) continue;

      const createdAt = new Date(sale.created_at);
      const saleDayInStore = createdAt.toLocaleDateString('en-CA', { timeZone: storeTimezone });
      if (saleDayInStore !== todayStr) continue;

      // Sum "ex-tax" totals; dashboard may update as new sales come in.
      const amount =
        typeof sale.total_price === 'number'
          ? sale.total_price
          : typeof sale.total_price_incl === 'number' && typeof sale.total_tax === 'number'
            ? sale.total_price_incl - sale.total_tax
            : 0;

      saleCount += 1;
      totalRevenue += amount;
      if (!lastSaleUtc || createdAt > lastSaleUtc) lastSaleUtc = createdAt;
    }

    // If the 200th-most-recent sale is still "today", you likely have >200 sales today
    // and we’d need to implement cursor pagination to get the full total.
    if (sales.length === pageSize) {
      const oldestInBatch = sales[sales.length - 1];
      if (oldestInBatch?.created_at) {
        const oldestDayInStore = new Date(oldestInBatch.created_at).toLocaleDateString('en-CA', {
          timeZone: storeTimezone,
        });
        if (oldestDayInStore === todayStr) {
          console.log('   ⚠️  You likely have >200 sales today (need cursor pagination to total all of them).');
          console.log('   Ping me and I’ll wire in cursor paging for `/search`.\n');
        }
      }
    }

    // Display results
    console.log('💰 TODAY\'S SALES');
    console.log('═'.repeat(60));
    console.log(`   Number of Sales: ${saleCount}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    
    if (saleCount > 0) {
      console.log(`   Average Sale: $${(totalRevenue / saleCount).toFixed(2)}`);
    }
    if (lastSaleUtc) {
      console.log(`   Last sale (store time): ${lastSaleUtc.toLocaleString('en-US', { timeZone: storeTimezone })}`);
    }
    console.log('');

    // 4) Get last 5 sales with customer details for CSV export
    console.log('📋 Fetching last 5 sales with customer details...\n');
    
    // Get outlets for location names
    const outletsData = await apiRequest('/outlets');
    const outlets = Array.isArray(outletsData.data) ? outletsData.data : [];
    const outletMap = new Map<string, any>();
    outlets.forEach((outlet: any) => {
      if (outlet.id) outletMap.set(outlet.id, outlet);
    });

    // Get last 5 most recent sales (all statuses, not just today)
    const recentSales = sales.slice(0, 5);
    const salesWithDetails: any[] = [];

    for (const sale of recentSales) {
      let customerName = 'Walk-in';
      let customerId = '';
      let customerPhone = '';
      let employeeName = '';
      let locationName = '';

      // Get customer details if customer_id exists
      if (sale.customer_id) {
        try {
          const customerResponse = await apiRequest(`/customers/${sale.customer_id}`);
          const customerData = customerResponse.data || customerResponse; // Handle wrapped response
          customerName = customerData.name || 
            (customerData.first_name && customerData.last_name 
              ? `${customerData.first_name} ${customerData.last_name}` 
              : customerData.first_name || customerData.last_name || 'Walk-in');
          customerId = customerData.customer_code || customerData.id || sale.customer_id;
          customerPhone = customerData.phone || customerData.mobile || customerData.phone_number || '';
        } catch (e: any) {
          // Customer might not exist or endpoint failed
        }
      }

      // Get employee/user name if user_id exists
      if (sale.user_id) {
        try {
          const userResponse = await apiRequest(`/users/${sale.user_id}`);
          const userData = userResponse.data || userResponse; // Handle wrapped response
          employeeName = userData.display_name || userData.username || userData.name || 
            (userData.first_name && userData.last_name 
              ? `${userData.first_name} ${userData.last_name}` 
              : userData.first_name || '');
        } catch (e: any) {
          // User might not exist or endpoint failed
        }
      }

      // Get location name from outlet
      if (sale.outlet_id) {
        const outlet = outletMap.get(sale.outlet_id);
        if (outlet) {
          locationName = outlet.name || '';
        }
      }

      const saleDate = sale.created_at ? new Date(sale.created_at) : new Date();
      const saleDateLocal = saleDate.toLocaleString('en-US', { 
        timeZone: storeTimezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Use total_price_incl to match dashboard (dashboard shows prices with tax)
      const saleTotal = typeof sale.total_price_incl === 'number'
        ? sale.total_price_incl
        : typeof sale.total_price === 'number'
          ? sale.total_price
          : 0;

      salesWithDetails.push({
        receipt: sale.receipt_number || sale.invoice_number || sale.id?.substring(0, 8) || 'N/A',
        dateTime: saleDateLocal,
        customer: customerName,
        customerId: customerId,
        phone: customerPhone,
        employee: employeeName,
        location: locationName,
        saleTotal: saleTotal.toFixed(2),
        status: sale.status || sale.state || 'N/A',
        note: sale.note || ''
      });
    }

    // Generate CSV
    const csvRows: string[] = [];
    csvRows.push('Receipt,Date/Time,Customer,Customer ID,Phone,Sold By,Location,Sale Total,Status,Note');
    
    for (const sale of salesWithDetails) {
      const row = [
        sale.receipt,
        `"${sale.dateTime}"`,
        `"${sale.customer}"`,
        sale.customerId,
        sale.phone,
        `"${sale.employee}"`,
        `"${sale.location}"`,
        `$${sale.saleTotal}`,
        sale.status,
        `"${sale.note.replace(/"/g, '""')}"` // Escape quotes in CSV
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const csvPath = path.join(process.cwd(), 'last_5_sales.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    console.log('📄 CSV EXPORT');
    console.log('═'.repeat(60));
    console.log(`   Saved to: ${csvPath}\n`);
    console.log('   Last 5 Sales:');
    console.log('   ' + '─'.repeat(58));
    for (const sale of salesWithDetails) {
      console.log(`   Receipt: ${sale.receipt} | ${sale.dateTime}`);
      console.log(`   Customer: ${sale.customer} (${sale.customerId}) | Phone: ${sale.phone || 'N/A'}`);
      console.log(`   Sold by: ${sale.employee || 'N/A'} @ ${sale.location || 'N/A'}`);
      console.log(`   Total: $${sale.saleTotal} | Status: ${sale.status}`);
      if (sale.note) console.log(`   Note: ${sale.note}`);
      console.log('');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR PULLING TODAY\'S SALES');
    console.error('═'.repeat(60));
    console.error(error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('\n💡 Tip: Check that your token has permissions to read sales data.');
    }
    process.exit(1);
  }
}

main();
