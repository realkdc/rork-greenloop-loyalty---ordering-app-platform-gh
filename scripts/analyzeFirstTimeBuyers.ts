#!/usr/bin/env node
/**
 * Analyze first-time buyers from Lightspeed first sale date export
 * 
 * Identifies customers who made their first purchase within specific time windows
 * and merges this data into the master customer analytics CSV
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

interface FirstSaleRecord {
  customerName: string;
  firstSaleDate: string;
  revenue: number;
  saleCount: number;
  avgSaleValue: number;
}

interface CustomerAnalytics {
  [key: string]: any;
  'Customer ID': string;
  'Customer Code': string;
  Name: string;
  Email: string;
  Phone: string;
  'Lifetime Value': number;
  'Order Count': number;
  'Avg Order Value': number;
  'First Order': string;
  'Last Order': string;
  'Days Since Last Order': number;
  'Is VIP': string;
  'Is High Value': string;
  'Inactive Segment': string;
  Tier: string;
  'Referred Sales': number;
  'Is First Time Buyer'?: string;
  'First Time Buyer Date'?: string;
  'Days Since First Purchase'?: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseFirstSaleCSV(filePath: string): FirstSaleRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  
  const records: FirstSaleRecord[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;
    
    const record: any = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    
    const firstSaleDate = record['First Sale'] || '';
    if (!firstSaleDate) continue;
    
    records.push({
      customerName: (record['Customer'] || '').trim(),
      firstSaleDate: firstSaleDate.trim(),
      revenue: parseFloat(record['Revenue'] || '0') || 0,
      saleCount: parseInt(record['Sale Count'] || '0') || 0,
      avgSaleValue: parseFloat(record['Avg. Sale Value'] || '0') || 0,
    });
  }
  
  return records;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateDaysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
}

function isFirstTimeBuyer(daysSince: number | null, windowDays: number = 90): boolean {
  if (daysSince === null) return false;
  return daysSince <= windowDays;
}

function findMatchingCustomer(
  customerName: string,
  analyticsRecords: CustomerAnalytics[]
): CustomerAnalytics | null {
  const normalized = normalizeName(customerName);
  
  // Try exact match first
  let match = analyticsRecords.find(r => 
    normalizeName(r.Name) === normalized
  );
  
  if (match) return match;
  
  // Try partial match (customer name contains first sale name or vice versa)
  match = analyticsRecords.find(r => {
    const rName = normalizeName(r.Name);
    return rName.includes(normalized) || normalized.includes(rName);
  });
  
  if (match) return match;
  
  // Try matching by customer code (sometimes names are in codes)
  const codeMatch = customerName.match(/\d{10,}/); // Phone number pattern
  if (codeMatch) {
    const phone = codeMatch[0];
    match = analyticsRecords.find(r => 
      (r.Phone || '').replace(/\D/g, '').includes(phone) ||
      phone.includes((r.Phone || '').replace(/\D/g, ''))
    );
    if (match) return match;
  }
  
  return null;
}

function main() {
  const firstSaleFile = '/Users/drippo/Downloads/GH-first_sale_date-for-customer-by-year (2024-01-01 to 2026-01-06).csv';
  
  if (!fs.existsSync(firstSaleFile)) {
    console.error(`❌ File not found: ${firstSaleFile}`);
    process.exit(1);
  }
  
  console.log('📊 FIRST-TIME BUYER ANALYSIS');
  console.log('════════════════════════════════════════════════════════════\n');
  
  // Load first sale data
  console.log('📥 Loading first sale data...');
  const firstSaleRecords = parseFirstSaleCSV(firstSaleFile);
  console.log(`   ✅ Loaded ${firstSaleRecords.length} customer records\n`);
  
  // Load current customer analytics
  const date = new Date().toISOString().split('T')[0];
  const analyticsFile = `customer_analytics_${date}.csv`;
  
  if (!fs.existsSync(analyticsFile)) {
    console.error(`❌ Analytics file not found: ${analyticsFile}`);
    console.log('   Run analyzeCustomerMetrics.ts first!');
    process.exit(1);
  }
  
  console.log('📥 Loading customer analytics...');
  const analyticsContent = fs.readFileSync(analyticsFile, 'utf-8');
  const analyticsLines = analyticsContent.split('\n').filter(l => l.trim());
  const analyticsHeaders = parseCSVLine(analyticsLines[0]);
  
  const analyticsRecords: CustomerAnalytics[] = [];
  for (let i = 1; i < analyticsLines.length; i++) {
    const values = parseCSVLine(analyticsLines[i]);
    if (values.length < analyticsHeaders.length) continue;
    
    const record: any = {};
    analyticsHeaders.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    analyticsRecords.push(record as CustomerAnalytics);
  }
  
  console.log(`   ✅ Loaded ${analyticsRecords.length} analytics records\n`);
  
  // Match first sale records to analytics
  console.log('🔗 Matching first sale data to customer analytics...');
  let matchedCount = 0;
  let firstTimeBuyers30d = 0;
  let firstTimeBuyers60d = 0;
  let firstTimeBuyers90d = 0;
  
  const firstTimeBuyersList: Array<{
    customer: CustomerAnalytics;
    firstSaleDate: string;
    daysSince: number;
  }> = [];
  
  for (const firstSale of firstSaleRecords) {
    const daysSince = calculateDaysSince(firstSale.firstSaleDate);
    if (daysSince === null) continue;
    
    const match = findMatchingCustomer(firstSale.customerName, analyticsRecords);
    if (match) {
      matchedCount++;
      
      // Update analytics record
      match['First Time Buyer Date'] = firstSale.firstSaleDate;
      match['Days Since First Purchase'] = daysSince;
      
      // Determine if first-time buyer (within 90 days)
      if (isFirstTimeBuyer(daysSince, 30)) {
        match['Is First Time Buyer'] = 'Yes (30d)';
        firstTimeBuyers30d++;
      } else if (isFirstTimeBuyer(daysSince, 60)) {
        match['Is First Time Buyer'] = 'Yes (60d)';
        firstTimeBuyers60d++;
      } else if (isFirstTimeBuyer(daysSince, 90)) {
        match['Is First Time Buyer'] = 'Yes (90d)';
        firstTimeBuyers90d++;
      } else {
        match['Is First Time Buyer'] = 'No';
      }
      
      if (match['Is First Time Buyer']?.startsWith('Yes')) {
        firstTimeBuyersList.push({
          customer: match,
          firstSaleDate: firstSale.firstSaleDate,
          daysSince,
        });
      }
    }
  }
  
  console.log(`   ✅ Matched ${matchedCount} customers`);
  console.log(`   📊 First-time buyers: ${firstTimeBuyers30d} (30d), ${firstTimeBuyers60d} (60d), ${firstTimeBuyers90d} (90d)\n`);
  
  // Export first-time buyers list
  const firstTimeBuyersFile = `first_time_buyers_${date}.csv`;
  const ftbHeaders = [
    'Customer ID',
    'Customer Code',
    'Name',
    'Email',
    'Phone',
    'First Purchase Date',
    'Days Since First Purchase',
    'Lifetime Value',
    'Order Count',
    'Avg Order Value',
    'Last Order',
    'Tier',
  ];
  
  const ftbRows: string[] = [ftbHeaders.join(',')];
  
  firstTimeBuyersList
    .sort((a, b) => (a.daysSince || 0) - (b.daysSince || 0))
    .forEach(({ customer, firstSaleDate, daysSince }) => {
      ftbRows.push([
        customer['Customer ID'] || '',
        customer['Customer Code'] || '',
        `"${(customer.Name || '').replace(/"/g, '""')}"`,
        customer.Email || '',
        customer.Phone || '',
        firstSaleDate,
        daysSince?.toString() || '',
        (customer['Lifetime Value'] || 0).toString(),
        (customer['Order Count'] || 0).toString(),
        (customer['Avg Order Value'] || 0).toString(),
        customer['Last Order'] || '',
        customer.Tier || '',
      ].join(','));
    });
  
  fs.writeFileSync(firstTimeBuyersFile, ftbRows.join('\n'));
  console.log(`✅ Exported ${firstTimeBuyersList.length} first-time buyers to: ${firstTimeBuyersFile}\n`);
  
  // Update analytics CSV with first-time buyer data
  const updatedAnalyticsFile = `customer_analytics_${date}.csv`;
  const updatedHeaders = [
    ...analyticsHeaders,
    'Is First Time Buyer',
    'First Time Buyer Date',
    'Days Since First Purchase',
  ];
  
  const updatedRows: string[] = [updatedHeaders.join(',')];
  
  analyticsRecords.forEach(record => {
    const row = updatedHeaders.map(header => {
      const value = String(record[header] || '');
      // Quote values that contain commas or quotes
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    updatedRows.push(row.join(','));
  });
  
  fs.writeFileSync(updatedAnalyticsFile, updatedRows.join('\n'));
  console.log(`✅ Updated analytics file: ${updatedAnalyticsFile}`);
  console.log(`   Added first-time buyer columns to ${analyticsRecords.length} records\n`);
  
  console.log('📊 SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Total customers analyzed: ${analyticsRecords.length}`);
  console.log(`First sale records matched: ${matchedCount}`);
  console.log(`First-time buyers (30d): ${firstTimeBuyers30d}`);
  console.log(`First-time buyers (60d): ${firstTimeBuyers60d}`);
  console.log(`First-time buyers (90d): ${firstTimeBuyers90d}`);
  console.log(`\n📁 Files created:`);
  console.log(`   - ${firstTimeBuyersFile} (first-time buyers only)`);
  console.log(`   - ${updatedAnalyticsFile} (updated with first-time buyer data)`);
  console.log(`\n💡 Next step: Run mergeEcomIntoAnalytics.ts to create final master CSV`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}
