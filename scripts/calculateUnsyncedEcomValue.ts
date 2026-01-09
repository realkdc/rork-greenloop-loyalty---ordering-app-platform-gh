#!/usr/bin/env node
/**
 * Calculate exact value of unsynced eCom orders
 * 
 * Reads the original eCom export and calculates the value of orders
 * that don't have X-series Order ID (haven't synced)
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

function parseCSV(content: string, delimiter: string = ';'): any[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
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
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

async function main() {
  // Find eCom export (exclude our output files)
  const ecomFiles = fs.readdirSync(process.cwd())
    .filter(f => (f.includes('ecom') || f.includes('e-com')) && f.endsWith('.csv') && !f.includes('_with_ecom') && !f.includes('unsynced'))
    .sort()
    .reverse();

  if (ecomFiles.length === 0) {
    console.error('❌ No eCom export CSV found!');
    process.exit(1);
  }

  const ecomFile = ecomFiles[0];
  console.log(`📂 Loading: ${ecomFile}\n`);

  const content = fs.readFileSync(ecomFile, 'utf-8');
  const records = parseCSV(content, ';');

  // Group by order number (same logic as importEcomCSV)
  const ordersByNumber = new Map<string, any>();
  
  for (const row of records) {
    const orderNumber = row['order_number'] || row['Order Number'] || '';
    if (!orderNumber) continue;
    
    // If we haven't seen this order, create it
    if (!ordersByNumber.has(orderNumber)) {
      const orderTotal = parseFloat(row['order_total'] || row['Order Total'] || '0');
      const xSeriesOrderId = (row['X-series Order ID'] || '').trim();
      const email = (row['email'] || '').toLowerCase().trim();
      
      ordersByNumber.set(orderNumber, {
        orderNumber,
        total: orderTotal,
        xSeriesOrderId,
        customerEmail: email,
      });
    }
  }

  // Calculate by customer
  const customerData = new Map<string, { total: number; synced: number; notSynced: number; syncedValue: number; notSyncedValue: number }>();
  
  for (const order of ordersByNumber.values()) {
    if (!order.customerEmail) continue;
    
    if (!customerData.has(order.customerEmail)) {
      customerData.set(order.customerEmail, {
        total: 0,
        synced: 0,
        notSynced: 0,
        syncedValue: 0,
        notSyncedValue: 0,
      });
    }
    
    const data = customerData.get(order.customerEmail)!;
    data.total += order.total;
    
    if (order.xSeriesOrderId && order.xSeriesOrderId !== '') {
      data.synced++;
      data.syncedValue += order.total;
    } else {
      data.notSynced++;
      data.notSyncedValue += order.total;
    }
  }

  // Export to CSV for merge script to use
  const outputFile = 'ecom_unsynced_values.csv';
  const csvRows: string[] = [];
  csvRows.push('Email,Total ECom Value,Synced ECom Value,Not Synced ECom Value,Synced Orders,Not Synced Orders');
  
  for (const [email, data] of customerData.entries()) {
    csvRows.push([
      email,
      data.total.toFixed(2),
      data.syncedValue.toFixed(2),
      data.notSyncedValue.toFixed(2),
      data.synced.toString(),
      data.notSynced.toString(),
    ].join(','));
  }
  
  fs.writeFileSync(outputFile, csvRows.join('\n'));
  
  console.log(`✅ Calculated unsynced values for ${customerData.size} customers`);
  console.log(`✅ Exported to: ${outputFile}\n`);
  
  // Show summary
  let totalSynced = 0;
  let totalNotSynced = 0;
  let totalSyncedValue = 0;
  let totalNotSyncedValue = 0;
  
  for (const data of customerData.values()) {
    totalSynced += data.synced;
    totalNotSynced += data.notSynced;
    totalSyncedValue += data.syncedValue;
    totalNotSyncedValue += data.notSyncedValue;
  }
  
  console.log('📊 SUMMARY:');
  console.log(`   Total eCom orders: ${totalSynced + totalNotSynced}`);
  console.log(`   Synced: ${totalSynced} orders = $${totalSyncedValue.toFixed(2)}`);
  console.log(`   Not Synced: ${totalNotSynced} orders = $${totalNotSyncedValue.toFixed(2)}`);
  console.log(`   Sync rate: ${((totalSynced / (totalSynced + totalNotSynced)) * 100).toFixed(1)}%`);
}

main().catch(console.error);
