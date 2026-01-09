#!/usr/bin/env node
/**
 * Import eCom orders from CSV export
 * 
 * Since eCom orders sync slowly, we can manually export from eCom dashboard
 * and import here to get complete customer data NOW
 * 
 * Usage: 
 * 1. Export orders from eCom dashboard (My Sales → Orders → Export)
 * 2. Save as: ecom_orders_export.csv
 * 3. Run: npx tsx scripts/importEcomCSV.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

const RETAIL_TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const RETAIL_DOMAIN = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const RETAIL_API = `https://${RETAIL_DOMAIN}.retail.lightspeed.app/api/2.0`;

// Simple CSV parser (handles semicolon delimiter and quoted fields)
function parseCSV(content: string, delimiter: string = ';'): any[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse rows
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields that may contain delimiters
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, '')); // Last value
    
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

async function apiRequest(endpoint: string) {
  const url = `${RETAIL_API}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${RETAIL_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`API Error (${response.status})`);
  return response.json();
}

interface EcomOrder {
  orderNumber: string;
  date: string;
  customerEmail: string;
  customerName: string;
  total: number;
  status: string;
  items: string;
}

async function main() {
  console.log('📥 IMPORT ECOM ORDERS FROM CSV');
  console.log('═'.repeat(70));
  console.log('This script imports eCom orders from CSV export\n');
  console.log('Steps:');
  console.log('1. Go to eCom Admin → My Sales → Orders');
  console.log('2. Export orders (look for Export/Download button)');
  console.log('3. Save as: ecom_orders_export.csv in project root');
  console.log('4. Run this script\n');

  // Look for CSV file
  const csvFiles = fs.readdirSync(process.cwd())
    .filter(f => f.includes('ecom') && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (csvFiles.length === 0) {
    console.error('❌ No eCom CSV file found!');
    console.error('   Expected file name containing "ecom" and ending in .csv');
    console.error('   Example: ecom_orders_export.csv\n');
    process.exit(1);
  }

  const csvFile = csvFiles[0];
  console.log(`📂 Found CSV: ${csvFile}\n`);

  try {
    // Read and parse CSV (eCom exports use semicolon delimiter)
    const content = fs.readFileSync(csvFile, 'utf-8');
    const records = parseCSV(content, ';');

    console.log(`✅ Parsed ${records.length} orders from CSV\n`);

    // Map CSV columns to our structure
    // eCom CSV has: order_number, email, order_total, timestamp, payment_status, fulfillment_status, etc.
    // Note: CSV has one row per LINE ITEM, so we need to group by order_number
    const ordersByNumber = new Map<string, any>();
    
    for (const row of records) {
      const orderNumber = row['order_number'] || row['Order Number'] || '';
      if (!orderNumber) continue;
      
      // If we haven't seen this order, create it
      if (!ordersByNumber.has(orderNumber)) {
        const email = row['email'] || '';
        const name = row['shipto_person_name'] || row['bill_person_name'] || '';
        const timestamp = row['timestamp'] || '';
        const orderTotal = parseFloat(row['order_total'] || row['Order Total'] || '0');
        const paymentStatus = row['payment_status'] || '';
        const fulfillmentStatus = row['fulfillment_status'] || '';
        const xSeriesOrderId = row['X-series Order ID'] || row['X-series Order ID'] || '';
        
        ordersByNumber.set(orderNumber, {
          orderNumber,
          date: timestamp,
          customerEmail: email,
          customerName: name,
          total: orderTotal,
          paymentStatus,
          fulfillmentStatus,
          xSeriesOrderId,
          lineItems: [],
        });
      }
      
      // Add line item to order
      const order = ordersByNumber.get(orderNumber)!;
      order.lineItems.push({
        sku: row['sku'] || '',
        name: row['name'] || '',
        price: parseFloat(row['price'] || '0'),
        quantity: parseInt(row['quantity'] || '1'),
        total: parseFloat(row['total'] || '0'),
      });
    }
    
    // Convert to array (one order per entry, not per line item)
    const orders: EcomOrder[] = Array.from(ordersByNumber.values()).map(order => ({
      orderNumber: order.orderNumber,
      date: order.date,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      total: order.total,
      status: `${order.paymentStatus} / ${order.fulfillmentStatus}`,
      items: order.lineItems.map((li: any) => `${li.name} x${li.quantity}`).join(', '),
      xSeriesOrderId: order.xSeriesOrderId,
    }));

    console.log('📊 Sample orders (first 5):');
    orders.slice(0, 5).forEach((order, i) => {
      console.log(`   ${i + 1}. Order ${order.orderNumber}: ${order.customerEmail} - $${order.total} - ${order.date}`);
    });
    console.log('');

    // Group by customer email
    console.log('📊 Grouping by customer...');
    const ordersByEmail = new Map<string, EcomOrder[]>();
    for (const order of orders) {
      if (order.customerEmail) {
        const email = order.customerEmail.toLowerCase().trim();
        if (!ordersByEmail.has(email)) {
          ordersByEmail.set(email, []);
        }
        ordersByEmail.get(email)!.push(order);
      }
    }

    console.log(`✅ Found ${ordersByEmail.size} unique customers\n`);

    // Match with Retail API customers (optimized - batch lookups)
    console.log('🔗 Matching with Retail API customers...');
    console.log(`   Processing ${ordersByEmail.size} unique customers...\n`);
    
    const matchedCustomers: Array<{
      email: string;
      retailCustomerId: string | null;
      ecomOrders: EcomOrder[];
      retailOrders: number;
      syncedOrderCount: number;
      notSyncedOrderCount: number;
    }> = [];

    let processed = 0;
    for (const [email, ecomOrders] of ordersByEmail.entries()) {
      try {
        // Search for customer in Retail API
        const customerSearch = await apiRequest(`/search?type=customers&q=${encodeURIComponent(email)}&page_size=10`);
        const customers = Array.isArray(customerSearch.data) ? customerSearch.data : [];
        const customer = customers.find((c: any) => 
          (c.email || '').toLowerCase() === email
        );

        // Get retail orders count (only if customer found)
        // Count ALL orders (all statuses) to match dashboard
        let retailOrders = 0;
        if (customer) {
          try {
            const sales = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
            const salesList = Array.isArray(sales.data) ? sales.data : [];
            retailOrders = salesList.filter((s: any) => {
              const status = s.status || '';
              const state = s.state || '';
              return !status.includes('CANCELLED') && !status.includes('VOID') && 
                     !state.includes('cancelled') && !state.includes('void');
            }).length;
          } catch (e) {
            // Ignore - customer might not have orders yet
          }
        }

        // Check which eCom orders have synced
        // IMPORTANT: Verify against API, not just X-series Order ID field (which is unreliable)
        const syncedOrders: EcomOrder[] = [];
        const notSyncedOrders: EcomOrder[] = [];
        
        if (customer) {
          try {
            // Get all sales from API to verify sync status (ALL statuses, not just closed)
            // This matches what the dashboard shows
            const sales = await apiRequest(`/search?type=sales&customer_id=${customer.id}&page_size=200`);
            const salesList = Array.isArray(sales.data) ? sales.data : [];
            // Include all sales except cancelled/voided (matches dashboard count)
            const allValidSales = salesList.filter((s: any) => {
              const status = s.status || '';
              const state = s.state || '';
              return !status.includes('CANCELLED') && !status.includes('VOID') && 
                     !state.includes('cancelled') && !state.includes('void');
            });
            
            // Get all receipt numbers from API (all statuses)
            const apiReceipts = allValidSales.map((s: any) => 
              String(s.receipt_number || s.invoice_number || '').trim()
            ).filter(r => r);
            
            // Check each eCom order against API receipts AND notes
            // eCom orders sync with different receipt numbers, but the eCom order ID is in the note field
            for (const ecomOrder of ecomOrders) {
              const orderNum = String(ecomOrder.orderNumber).trim();
              
              // Check if this order number appears in:
              // 1. Receipt numbers (direct match)
              // 2. Note field (e.g., "Order ID:2425")
              const isSynced = allValidSales.some(sale => {
                const receipt = String(sale.receipt_number || sale.invoice_number || '').trim();
                const note = String(sale.note || '').toLowerCase();
                const orderIdPattern = new RegExp(`order\\s*id\\s*:?\\s*${orderNum}`, 'i');
                
                return receipt === orderNum || 
                       receipt.includes(orderNum) || 
                       orderNum.includes(receipt) ||
                       orderIdPattern.test(note) ||
                       note.includes(`order id:${orderNum}`) ||
                       note.includes(`order ${orderNum}`);
              });
              
              if (isSynced) {
                syncedOrders.push(ecomOrder);
              } else {
                notSyncedOrders.push(ecomOrder);
              }
            }
          } catch (e) {
            // Fallback to X-series Order ID if API check fails
            console.log(`   ⚠️  API check failed for ${email}, using X-series Order ID fallback`);
            syncedOrders.push(...ecomOrders.filter(o => o.xSeriesOrderId && o.xSeriesOrderId.trim() !== ''));
            notSyncedOrders.push(...ecomOrders.filter(o => !o.xSeriesOrderId || o.xSeriesOrderId.trim() === ''));
          }
        } else {
          // No customer in Retail API, so all orders are not synced
          notSyncedOrders.push(...ecomOrders);
        }

        matchedCustomers.push({
          email,
          retailCustomerId: customer?.id || null,
          ecomOrders,
          retailOrders,
          syncedOrderCount: syncedOrders.length,
          notSyncedOrderCount: notSyncedOrders.length,
        });

        processed++;
        if (processed % 20 === 0 || processed === ordersByEmail.size) {
          const progress = ((processed / ordersByEmail.size) * 100).toFixed(1);
          process.stdout.write(`\r   Processed: ${processed}/${ordersByEmail.size} customers (${progress}%)...`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (e: any) {
        console.error(`\n   ⚠️  Error processing ${email}: ${e.message}`);
        // Still add customer with no retail match
        matchedCustomers.push({
          email,
          retailCustomerId: null,
          ecomOrders,
          retailOrders: 0,
          syncedOrderCount: 0,
          notSyncedOrderCount: ecomOrders.length,
        });
        processed++;
      }
    }

    console.log(`\r   Processed: ${matchedCustomers.length} customers                    \n`);

    // Generate report
    console.log('📊 IMPORT SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total eCom Orders: ${orders.length}`);
    console.log(`Unique Customers: ${ordersByEmail.size}`);
    console.log(`Matched with Retail: ${matchedCustomers.filter(c => c.retailCustomerId).length}`);
    console.log(`Not in Retail API: ${matchedCustomers.filter(c => !c.retailCustomerId).length}\n`);

    // Show sync status breakdown
    const fullySynced = matchedCustomers.filter(c => c.syncedOrderCount === c.ecomOrders.length && c.ecomOrders.length > 0);
    const partiallySynced = matchedCustomers.filter(c => c.syncedOrderCount > 0 && c.syncedOrderCount < c.ecomOrders.length);
    const notSynced = matchedCustomers.filter(c => c.syncedOrderCount === 0 && c.ecomOrders.length > 0);
    const notInRetail = matchedCustomers.filter(c => !c.retailCustomerId && c.ecomOrders.length > 0);
    
    console.log(`\n📊 SYNC STATUS BREAKDOWN:`);
    console.log(`   Fully Synced: ${fullySynced.length} customers`);
    console.log(`   Partially Synced: ${partiallySynced.length} customers`);
    console.log(`   Not Synced Yet: ${notSynced.length} customers`);
    console.log(`   Not in Retail API: ${notInRetail.length} customers\n`);
    
    // Show examples of not synced orders
    if (notSynced.length > 0) {
      console.log(`⚠️  ${notSynced.length} customers have eCom orders that haven't synced yet:`);
      notSynced.slice(0, 5).forEach(c => {
        const orderNums = c.ecomOrders.map(o => o.orderNumber).join(', ');
        console.log(`   - ${c.email}: ${c.ecomOrders.length} orders (${orderNums})`);
      });
      if (notSynced.length > 5) {
        console.log(`   ... and ${notSynced.length - 5} more`);
      }
      console.log('');
    }

    // Export merged data
    const date = new Date().toISOString().split('T')[0];
    const outputFile = `customer_analytics_with_ecom_${date}.csv`;
    
    console.log(`💾 Exporting merged data to ${outputFile}...\n`);
    
    // Helper function to properly escape CSV fields
    function escapeCsvField(field: string): string {
      if (!field) return '';
      // If field contains comma, quote, newline, or semicolon, wrap in quotes and escape quotes
      if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes(';')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    }

    // This would merge with existing customer analytics
    // For now, just export the eCom data summary
    const csvRows: string[] = [];
    csvRows.push('Email,Retail Customer ID,ECom Order Count,Retail Order Count,Total ECom Value,ECom Orders (Order Numbers),Synced Orders,Not Synced Orders,Status');
    
    for (const customer of matchedCustomers) {
      const totalEcomValue = customer.ecomOrders.reduce((sum, o) => sum + o.total, 0);
      const orderNumbers = customer.ecomOrders.map(o => o.orderNumber).join(';');
      
      // Check which orders have synced (have X-series Order ID)
      const syncedOrders = customer.ecomOrders.filter(o => o.xSeriesOrderId).map(o => o.orderNumber);
      const notSyncedOrders = customer.ecomOrders.filter(o => !o.xSeriesOrderId).map(o => o.orderNumber);
      
      const status = customer.retailCustomerId 
        ? (customer.retailOrders > 0 ? 'Partially Synced' : 'Not Synced')
        : 'Not in Retail';
      
      // Properly escape all fields (especially those with semicolons)
      csvRows.push([
        escapeCsvField(customer.email),
        escapeCsvField(customer.retailCustomerId || ''),
        customer.ecomOrders.length.toString(),
        customer.retailOrders.toString(),
        totalEcomValue.toFixed(2),
        escapeCsvField(orderNumbers),
        escapeCsvField(syncedOrders.join(';')),
        escapeCsvField(notSyncedOrders.join(';')),
        escapeCsvField(status),
      ].join(','));
    }
    
    fs.writeFileSync(outputFile, csvRows.join('\n'));
    console.log(`✅ Exported to ${outputFile}\n`);
    console.log('📝 Next Steps:');
    console.log('1. Review the export to see which orders haven\'t synced');
    console.log('2. Manually update customer analytics with eCom data');
    console.log('3. Set up webhooks for future real-time updates\n');

  } catch (error: any) {
    console.error('\n❌ ERROR');
    console.error('═'.repeat(70));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
