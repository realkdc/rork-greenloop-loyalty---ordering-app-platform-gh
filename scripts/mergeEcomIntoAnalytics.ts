#!/usr/bin/env node
/**
 * Merge eCom Order Data into Customer Analytics
 * 
 * Takes the existing customer_analytics CSV and the customer_analytics_with_ecom CSV
 * and merges them to create an updated analytics file with:
 * - eCom orders included in totals
 * - Recalculated LTV, AOV, order counts
 * - Updated segmentation (VIP, High Value, Inactive)
 * 
 * Usage: npx tsx scripts/mergeEcomIntoAnalytics.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Segment thresholds (same as analyzeCustomerMetrics.ts)
const VIP_THRESHOLD = 1000; // $1000+ lifetime spend = VIP
const HIGH_VALUE_THRESHOLD = 500; // $500+ = High Value
const INACTIVE_30_DAYS = 30;
const INACTIVE_60_DAYS = 60;
const INACTIVE_90_DAYS = 90;

interface CustomerAnalyticsRow {
  customerId: string;
  customerCode: string;
  name: string;
  email: string;
  phone: string;
  lifetimeValue: number;
  orderCount: number;
  avgOrderValue: number;
  firstOrder: string;
  lastOrder: string;
  daysSinceLastOrder: number | null;
  isVIP: boolean;
  isHighValue: boolean;
  inactiveSegment: string;
  tier: string;
  referredSales: number;
  isFirstTimeBuyer?: string;
  firstTimeBuyerDate?: string;
  daysSinceFirstPurchase?: number | null;
}

interface EcomDataRow {
  email: string;
  retailCustomerId: string | null;
  ecomOrderCount: number;
  retailOrderCount: number;
  totalEcomValue: number;
  orderNumbers: string;
  syncedOrders: string;
  notSyncedOrders: string;
  status: string;
  syncedOrderCount: number;
  notSyncedOrderCount: number;
}

// Helper to parse CSV with proper quoting
function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        if (inQuotes && lines[i][j + 1] === '"') {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Last value
    
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').replace(/^"|"$/g, '');
    });
    rows.push(row);
  }
  
  return rows;
}

// Helper to escape CSV fields
function escapeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function calculateSegmentation(ltv: number, daysSinceLastOrder: number | null): {
  isVIP: boolean;
  isHighValue: boolean;
  inactiveSegment: string;
  tier: string;
} {
  const isVIP = ltv >= VIP_THRESHOLD;
  const isHighValue = ltv >= HIGH_VALUE_THRESHOLD && ltv < VIP_THRESHOLD;
  
  let inactiveSegment = 'active';
  if (daysSinceLastOrder !== null) {
    if (daysSinceLastOrder >= INACTIVE_90_DAYS) {
      inactiveSegment = '90d';
    } else if (daysSinceLastOrder >= INACTIVE_60_DAYS) {
      inactiveSegment = '60d';
    } else if (daysSinceLastOrder >= INACTIVE_30_DAYS) {
      inactiveSegment = '30d';
    }
  }
  
  // Tier based on spend (will be referral-based later)
  let tier = 'None';
  if (ltv >= 1500) tier = 'Evergreen';
  else if (ltv >= 750) tier = 'Bloom';
  else if (ltv >= 250) tier = 'Sprout';
  else if (ltv > 0) tier = 'Seed';
  
  return { isVIP, isHighValue, inactiveSegment, tier };
}

async function main() {
  console.log('🔄 MERGING ECOM DATA INTO CUSTOMER ANALYTICS');
  console.log('═'.repeat(70));
  console.log('');

  // Find the most recent analytics files
  // Prefer base analytics file (customer_analytics_YYYY-MM-DD.csv) over updated version
  const allAnalyticsFiles = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('customer_analytics_') && !f.includes('_with_ecom') && f.endsWith('.csv'))
    .map(f => ({ name: f, stat: fs.statSync(f) }))
    .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
  
  // Prefer base file (not _updated_) if it exists and is recent
  const baseFiles = allAnalyticsFiles.filter(f => !f.name.includes('_updated_'));
  const updatedFiles = allAnalyticsFiles.filter(f => f.name.includes('_updated_'));
  
  // Use newest base file if available, otherwise use newest updated file
  const analyticsFiles = (baseFiles.length > 0 ? baseFiles : updatedFiles).map(f => f.name);
  
  const ecomFiles = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('customer_analytics_with_ecom_') && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (analyticsFiles.length === 0) {
    console.error('❌ No customer_analytics CSV found!');
    console.error('   Run: npx tsx scripts/analyzeCustomerMetrics.ts first');
    process.exit(1);
  }

  if (ecomFiles.length === 0) {
    console.error('❌ No customer_analytics_with_ecom CSV found!');
    console.error('   Run: npx tsx scripts/importEcomCSV.ts first');
    process.exit(1);
  }

  const analyticsFile = analyticsFiles[0];
  const ecomFile = ecomFiles[0];

  console.log(`📂 Loading analytics from: ${analyticsFile}`);
  console.log(`📂 Loading eCom data from: ${ecomFile}\n`);

  // Parse both CSVs
  const analyticsContent = fs.readFileSync(analyticsFile, 'utf-8');
  const ecomContent = fs.readFileSync(ecomFile, 'utf-8');

  const analyticsRows = parseCSV(analyticsContent);
  const ecomRows = parseCSV(ecomContent);

  console.log(`   Found ${analyticsRows.length} customers in analytics`);
  console.log(`   Found ${ecomRows.length} customers in eCom data\n`);

  // Create map of eCom data by email (lowercase)
  const ecomMap = new Map<string, EcomDataRow>();
  for (const row of ecomRows) {
    const email = (row.Email || row.email || '').toLowerCase().trim();
    if (email && email.includes('@')) {
      // Count synced vs not synced orders
      const syncedOrdersStr = row['Synced Orders'] || row.syncedOrders || '';
      const notSyncedOrdersStr = row['Not Synced Orders'] || row.notSyncedOrders || '';
      const syncedCount = syncedOrdersStr ? syncedOrdersStr.split(';').filter(s => s.trim()).length : 0;
      const notSyncedCount = notSyncedOrdersStr ? notSyncedOrdersStr.split(';').filter(s => s.trim()).length : 0;
      
      ecomMap.set(email, {
        email,
        retailCustomerId: row['Retail Customer ID'] || row.retailCustomerId || null,
        ecomOrderCount: parseInt(row['ECom Order Count'] || row.ecomOrderCount || '0') || 0,
        retailOrderCount: parseInt(row['Retail Order Count'] || row.retailOrderCount || '0') || 0,
        totalEcomValue: parseFloat(row['Total ECom Value'] || row.totalEcomValue || '0') || 0,
        orderNumbers: row['ECom Orders (Order Numbers)'] || row.orderNumbers || '',
        syncedOrders: syncedOrdersStr,
        notSyncedOrders: notSyncedOrdersStr,
        status: row.Status || row.status || '',
        syncedOrderCount: syncedCount,
        notSyncedOrderCount: notSyncedCount,
      });
    }
  }

  console.log(`   Mapped ${ecomMap.size} eCom customers\n`);

  // Merge data
  const mergedRows: CustomerAnalyticsRow[] = [];
  let updated = 0;
  let newCustomers = 0;

  for (const analyticsRow of analyticsRows) {
    const email = (analyticsRow.Email || analyticsRow.email || '').toLowerCase().trim();
    const ecomData = ecomMap.get(email);

    // Parse existing analytics (handle both possible column name formats)
    const existingLTV = parseFloat(analyticsRow['Lifetime Value'] || analyticsRow['LifetimeValue'] || analyticsRow.lifetimeValue || '0') || 0;
    const existingOrderCount = parseInt(analyticsRow['Order Count'] || analyticsRow['OrderCount'] || analyticsRow.orderCount || '0') || 0;
    const existingAOV = parseFloat(analyticsRow['Avg Order Value'] || analyticsRow['AvgOrderValue'] || analyticsRow.avgOrderValue || '0') || 0;
    const lastOrderStr = analyticsRow['Last Order'] || analyticsRow['LastOrder'] || analyticsRow.lastOrder || '';
    const daysSinceLastOrder = analyticsRow['Days Since Last Order'] || analyticsRow['DaysSinceLastOrder']
      ? parseInt(analyticsRow['Days Since Last Order'] || analyticsRow['DaysSinceLastOrder'] || '0') || null
      : null;

    // Add eCom data if available
    // IMPORTANT: Only add eCom orders that HAVEN'T synced yet
    // Synced orders are already in the Retail API data (existingLTV)
    const notSyncedEcomOrders = ecomData ? ecomData.notSyncedOrderCount : 0;
    
    // Try to load exact unsynced value from calculated file
    let notSyncedEcomValue = 0;
    try {
      const unsyncedFile = 'ecom_unsynced_values.csv';
      if (fs.existsSync(unsyncedFile)) {
        const unsyncedContent = fs.readFileSync(unsyncedFile, 'utf-8');
        const unsyncedRows = parseCSV(unsyncedContent);
        const unsyncedRow = unsyncedRows.find((r: any) => 
          (r.Email || r.email || '').toLowerCase().trim() === email
        );
        if (unsyncedRow) {
          notSyncedEcomValue = parseFloat(unsyncedRow['Not Synced ECom Value'] || '0') || 0;
        }
      }
    } catch (e) {
      // Fallback to estimation
      if (ecomData && ecomData.ecomOrderCount > 0) {
        notSyncedEcomValue = ecomData.totalEcomValue * (notSyncedEcomOrders / ecomData.ecomOrderCount);
      }
    }
    
    // Recalculate totals (only add NOT SYNCED eCom orders)
    const newLTV = existingLTV + notSyncedEcomValue;
    const newOrderCount = existingOrderCount + notSyncedEcomOrders;
    const newAOV = newOrderCount > 0 ? newLTV / newOrderCount : 0;

    // Recalculate segmentation
    const { isVIP, isHighValue, inactiveSegment, tier } = calculateSegmentation(newLTV, daysSinceLastOrder);

    // Preserve first-time buyer data if present
    const isFirstTimeBuyer = analyticsRow['Is First Time Buyer'] || analyticsRow.isFirstTimeBuyer || '';
    const firstTimeBuyerDate = analyticsRow['First Time Buyer Date'] || analyticsRow.firstTimeBuyerDate || '';
    const daysSinceFirstPurchase = analyticsRow['Days Since First Purchase'] || analyticsRow.daysSinceFirstPurchase
      ? parseInt(analyticsRow['Days Since First Purchase'] || analyticsRow.daysSinceFirstPurchase || '0') || null
      : null;

    mergedRows.push({
      customerId: analyticsRow['Customer ID'] || analyticsRow.customerId || '',
      customerCode: analyticsRow['Customer Code'] || analyticsRow.customerCode || '',
      name: analyticsRow.Name || analyticsRow.name || '',
      email: analyticsRow.Email || analyticsRow.email || '',
      phone: analyticsRow.Phone || analyticsRow.phone || '',
      lifetimeValue: newLTV,
      orderCount: newOrderCount,
      avgOrderValue: newAOV,
      firstOrder: analyticsRow['First Order'] || analyticsRow.firstOrder || '',
      lastOrder: lastOrderStr,
      daysSinceLastOrder,
      isVIP,
      isHighValue,
      inactiveSegment,
      tier,
      referredSales: parseInt(analyticsRow['Referred Sales'] || analyticsRow.referredSales || '0') || 0,
      isFirstTimeBuyer: isFirstTimeBuyer || undefined,
      firstTimeBuyerDate: firstTimeBuyerDate || undefined,
      daysSinceFirstPurchase: daysSinceFirstPurchase !== null ? daysSinceFirstPurchase : undefined,
    });

    if (ecomData) {
      updated++;
      ecomMap.delete(email); // Remove so we can track new customers
    }
  }

  // Add any eCom customers not in analytics (new customers)
  for (const [email, ecomData] of ecomMap.entries()) {
    if (ecomData.ecomOrderCount > 0) {
      const newLTV = ecomData.totalEcomValue;
      const newOrderCount = ecomData.ecomOrderCount;
      const newAOV = newOrderCount > 0 ? newLTV / newOrderCount : 0;
      const { isVIP, isHighValue, inactiveSegment, tier } = calculateSegmentation(newLTV, null);

      mergedRows.push({
        customerId: ecomData.retailCustomerId || '',
        customerCode: '',
        name: '',
        email: email,
        phone: '',
        lifetimeValue: newLTV,
        orderCount: newOrderCount,
        avgOrderValue: newAOV,
        firstOrder: '',
        lastOrder: '',
        daysSinceLastOrder: null,
        isVIP,
        isHighValue,
        inactiveSegment,
        tier,
        referredSales: 0,
      });
      newCustomers++;
    }
  }

  console.log(`✅ Merged ${updated} existing customers with eCom data`);
  console.log(`✅ Added ${newCustomers} new customers from eCom data`);
  console.log(`   Total customers: ${mergedRows.length}\n`);

  // Generate summary
  const customersWithOrders = mergedRows.filter(r => r.orderCount > 0);
  const totalLTV = mergedRows.reduce((sum, r) => sum + r.lifetimeValue, 0);
  const avgLTV = customersWithOrders.length > 0 ? totalLTV / customersWithOrders.length : 0;
  const avgAOV = customersWithOrders.length > 0
    ? mergedRows.reduce((sum, r) => sum + r.avgOrderValue, 0) / customersWithOrders.length
    : 0;
  const vipCount = mergedRows.filter(r => r.isVIP).length;
  const highValueCount = mergedRows.filter(r => r.isHighValue).length;

  console.log('📊 UPDATED ANALYTICS SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Total Customers: ${mergedRows.length}`);
  console.log(`Customers with Orders: ${customersWithOrders.length}`);
  console.log(`Total Lifetime Value: $${totalLTV.toFixed(2)}`);
  console.log(`Average LTV: $${avgLTV.toFixed(2)}`);
  console.log(`Average AOV: $${avgAOV.toFixed(2)}`);
  console.log(`VIP Customers: ${vipCount}`);
  console.log(`High Value Customers: ${highValueCount}\n`);

  // Export merged CSV
  const dateStr = new Date().toISOString().split('T')[0];
  const outputFile = `customer_analytics_updated_${dateStr}.csv`;

  // Include first-time buyer columns if any records have them
  const hasFirstTimeBuyerData = mergedRows.some(r => r.isFirstTimeBuyer !== undefined);
  
  const csvRows: string[] = [];
  const headers = [
    'Customer ID',
    'Customer Code',
    'Name',
    'Email',
    'Phone',
    'Lifetime Value',
    'Order Count',
    'Avg Order Value',
    'First Order',
    'Last Order',
    'Days Since Last Order',
    'Is VIP',
    'Is High Value',
    'Inactive Segment',
    'Tier',
    'Referred Sales',
  ];
  
  if (hasFirstTimeBuyerData) {
    headers.push('Is First Time Buyer', 'First Time Buyer Date', 'Days Since First Purchase');
  }
  
  csvRows.push(headers.join(','));

  for (const row of mergedRows) {
    const baseRow = [
      escapeCsvField(row.customerId),
      escapeCsvField(row.customerCode),
      escapeCsvField(row.name),
      escapeCsvField(row.email),
      escapeCsvField(row.phone),
      row.lifetimeValue.toFixed(2),
      row.orderCount.toString(),
      row.avgOrderValue.toFixed(2),
      escapeCsvField(row.firstOrder),
      escapeCsvField(row.lastOrder),
      row.daysSinceLastOrder !== null ? row.daysSinceLastOrder.toString() : '',
      row.isVIP ? 'Yes' : 'No',
      row.isHighValue ? 'Yes' : 'No',
      escapeCsvField(row.inactiveSegment),
      escapeCsvField(row.tier),
      row.referredSales.toString(),
    ];
    
    if (hasFirstTimeBuyerData) {
      baseRow.push(
        escapeCsvField(row.isFirstTimeBuyer || ''),
        escapeCsvField(row.firstTimeBuyerDate || ''),
        row.daysSinceFirstPurchase !== null && row.daysSinceFirstPurchase !== undefined 
          ? row.daysSinceFirstPurchase.toString() 
          : ''
      );
    }
    
    csvRows.push(baseRow.join(','));
  }

  fs.writeFileSync(outputFile, csvRows.join('\n'));
  console.log(`✅ Exported updated analytics to: ${outputFile}\n`);
}

main().catch((error) => {
  console.error('\n❌ ERROR');
  console.error('═'.repeat(70));
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
});
