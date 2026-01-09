#!/usr/bin/env node
/**
 * Calculate Order Value Threshold Metrics
 * 
 * Based on the "Reality Check" methodology:
 * - % of orders above $75
 * - % of orders above $100
 * - Determines if thresholds are "perfect"
 * 
 * Usage: npx tsx scripts/calculateOrderValueThresholds.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// Thresholds from the methodology
const THRESHOLD_75 = 75;
const THRESHOLD_100 = 100;
const PERFECT_THRESHOLD_MIN = 25; // 25-30% of orders above $75
const PERFECT_THRESHOLD_MAX = 30;
const PERFECT_STRETCH_MIN = 10; // 10-15% of orders above $100
const PERFECT_STRETCH_MAX = 15;

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

async function main() {
  console.log('📊 ORDER VALUE THRESHOLD ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');

  // Find the most recent updated analytics file
  const analyticsFiles = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('customer_analytics_updated_') && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (analyticsFiles.length === 0) {
    console.error('❌ No customer_analytics_updated CSV found!');
    console.error('   Run the merge script first: npx tsx scripts/mergeEcomIntoAnalytics.ts');
    process.exit(1);
  }

  const analyticsFile = analyticsFiles[0];
  console.log(`📂 Loading analytics from: ${analyticsFile}\n`);

  // Parse CSV
  const content = fs.readFileSync(analyticsFile, 'utf-8');
  const rows = parseCSV(content);

  console.log(`   Found ${rows.length} customers\n`);

  // Calculate metrics
  let totalOrders = 0;
  let ordersAbove75 = 0;
  let ordersAbove100 = 0;
  let totalOrderValue = 0;
  const orderValues: number[] = [];

  for (const row of rows) {
    const orderCount = parseInt(row['Order Count'] || row.orderCount || '0') || 0;
    const avgOrderValue = parseFloat(row['Avg Order Value'] || row.avgOrderValue || '0') || 0;
    const lifetimeValue = parseFloat(row['Lifetime Value'] || row.lifetimeValue || '0') || 0;

    if (orderCount > 0 && avgOrderValue > 0) {
      totalOrders += orderCount;
      totalOrderValue += lifetimeValue;

      // For each order, check if AOV is above thresholds
      // Since we have AOV, we'll use that as the indicator
      // (AOV represents the average, so if AOV > threshold, all orders are likely above)
      // Actually, we need individual order values. Let's use AOV as proxy for now,
      // but ideally we'd have individual order data
      
      // Better approach: Use AOV to estimate
      // If AOV > $75, then all orders are likely above $75
      // But this isn't perfect - we need actual order-level data
      
      // For now, let's count customers whose AOV is above thresholds
      // and multiply by their order count
      if (avgOrderValue >= THRESHOLD_75) {
        ordersAbove75 += orderCount;
      }
      if (avgOrderValue >= THRESHOLD_100) {
        ordersAbove100 += orderCount;
      }

      // Store order values for more accurate calculation
      for (let i = 0; i < orderCount; i++) {
        orderValues.push(avgOrderValue); // Using AOV as proxy
      }
    }
  }

  // Calculate percentages
  const percentAbove75 = totalOrders > 0 ? (ordersAbove75 / totalOrders) * 100 : 0;
  const percentAbove100 = totalOrders > 0 ? (ordersAbove100 / totalOrders) * 100 : 0;

  // Determine if thresholds are "perfect"
  const isPerfectThreshold = percentAbove75 >= PERFECT_THRESHOLD_MIN && percentAbove75 <= PERFECT_THRESHOLD_MAX;
  const isPerfectStretch = percentAbove100 >= PERFECT_STRETCH_MIN && percentAbove100 <= PERFECT_STRETCH_MAX;

  // Results
  console.log('📊 ORDER VALUE THRESHOLD ANALYSIS');
  console.log('═'.repeat(70));
  console.log('');
  console.log(`Total Orders: ${totalOrders.toLocaleString()}`);
  console.log(`Total Order Value: $${totalOrderValue.toFixed(2)}`);
  console.log(`Average Order Value: $${(totalOrderValue / totalOrders).toFixed(2)}`);
  console.log('');
  console.log('📈 THRESHOLD METRICS:');
  console.log('═'.repeat(70));
  console.log(`1. % of orders above $${THRESHOLD_75}: ${percentAbove75.toFixed(2)}%`);
  console.log(`   Orders above $${THRESHOLD_75}: ${ordersAbove75.toLocaleString()}`);
  console.log('');
  console.log(`2. % of orders above $${THRESHOLD_100}: ${percentAbove100.toFixed(2)}%`);
  console.log(`   Orders above $${THRESHOLD_100}: ${ordersAbove100.toLocaleString()}`);
  console.log('');
  console.log('✅ THRESHOLD EVALUATION:');
  console.log('═'.repeat(70));
  
  if (isPerfectThreshold) {
    console.log(`✅ $${THRESHOLD_75} is a PERFECT threshold!`);
    console.log(`   (${percentAbove75.toFixed(2)}% of orders hit $${THRESHOLD_75} - within 25-30% range)`);
  } else {
    if (percentAbove75 < PERFECT_THRESHOLD_MIN) {
      console.log(`⚠️  $${THRESHOLD_75} threshold is TOO HIGH`);
      console.log(`   (Only ${percentAbove75.toFixed(2)}% of orders hit $${THRESHOLD_75} - need 25-30%)`);
    } else {
      console.log(`⚠️  $${THRESHOLD_75} threshold is TOO LOW`);
      console.log(`   (${percentAbove75.toFixed(2)}% of orders hit $${THRESHOLD_75} - exceeds 30%)`);
    }
  }
  
  console.log('');
  
  if (isPerfectStretch) {
    console.log(`✅ $${THRESHOLD_100} is a PERFECT stretch threshold!`);
    console.log(`   (${percentAbove100.toFixed(2)}% of orders hit $${THRESHOLD_100} - within 10-15% range)`);
  } else {
    if (percentAbove100 < PERFECT_STRETCH_MIN) {
      console.log(`⚠️  $${THRESHOLD_100} stretch threshold is TOO HIGH`);
      console.log(`   (Only ${percentAbove100.toFixed(2)}% of orders hit $${THRESHOLD_100} - need 10-15%)`);
    } else {
      console.log(`⚠️  $${THRESHOLD_100} stretch threshold is TOO LOW`);
      console.log(`   (${percentAbove100.toFixed(2)}% of orders hit $${THRESHOLD_100} - exceeds 15%)`);
    }
  }

  console.log('');
  console.log('💡 RECOMMENDATIONS:');
  console.log('═'.repeat(70));
  
  if (!isPerfectThreshold) {
    if (percentAbove75 < PERFECT_THRESHOLD_MIN) {
      // Need to find what threshold gives us 25-30%
      // Estimate: if X% hit $75, what threshold would give 25-30%?
      const targetPercent = (PERFECT_THRESHOLD_MIN + PERFECT_THRESHOLD_MAX) / 2;
      const estimatedThreshold = THRESHOLD_75 * (percentAbove75 / targetPercent);
      console.log(`   Consider lowering threshold to ~$${estimatedThreshold.toFixed(0)} to hit 25-30%`);
    } else {
      console.log(`   Consider raising threshold above $${THRESHOLD_75} to reduce percentage`);
    }
  }
  
  if (!isPerfectStretch) {
    if (percentAbove100 < PERFECT_STRETCH_MIN) {
      const targetPercent = (PERFECT_STRETCH_MIN + PERFECT_STRETCH_MAX) / 2;
      const estimatedThreshold = THRESHOLD_100 * (percentAbove100 / targetPercent);
      console.log(`   Consider lowering stretch threshold to ~$${estimatedThreshold.toFixed(0)} to hit 10-15%`);
    } else {
      console.log(`   Consider raising stretch threshold above $${THRESHOLD_100} to reduce percentage`);
    }
  }

  if (isPerfectThreshold && isPerfectStretch) {
    console.log('   ✅ Your thresholds are perfect! No changes needed.');
  }

  console.log('');
  console.log('📝 NOTE:');
  console.log('   This analysis uses Average Order Value (AOV) as a proxy.');
  console.log('   For more accurate results, use individual order-level data.');
  console.log('   The "stretch class" are customers with orders above $100.');
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ ERROR');
  console.error('═'.repeat(70));
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
});
