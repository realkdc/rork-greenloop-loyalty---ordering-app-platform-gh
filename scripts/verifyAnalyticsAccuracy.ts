#!/usr/bin/env node
/**
 * Verify Analytics Accuracy
 * 
 * Tests a sample of customers from the analytics CSV against the Lightspeed API
 * to verify the data is accurate and up-to-date
 * 
 * Usage: npx tsx scripts/verifyAnalyticsAccuracy.ts
 */

import 'dotenv/config';
import * as fs from 'fs';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

// Helper to parse CSV
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
          j++;
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
    values.push(current.trim());
    
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').replace(/^"|"$/g, '');
    });
    rows.push(row);
  }
  
  return rows;
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
    throw new Error(`API Error (${response.status}): ${error.substring(0, 200)}`);
  }

  return response.json();
}

async function getCustomerSalesFromAPI(customerId: string): Promise<{ count: number; total: number; orders: any[] }> {
  const allSales: any[] = [];
  const pageSize = 200;
  let offset = 0;
  let hasMore = true;
  let consecutiveEmpty = 0;
  
  while (hasMore && consecutiveEmpty < 3) {
    try {
      const result = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`);
      const sales = Array.isArray(result.data) ? result.data : [];
      
      if (sales.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) break;
        offset += pageSize;
        continue;
      }
      
      consecutiveEmpty = 0;
      
      const closedSales = sales.filter((sale: any) => 
        (sale.status === 'CLOSED' || sale.status === 'DISPATCHED_CLOSED') && 
        sale.state === 'closed'
      );
      
      allSales.push(...closedSales);
      
      if (sales.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error: any) {
      console.error(`   ⚠️  Error: ${error.message}`);
      break;
    }
  }
  
  const total = allSales.reduce((sum, sale) => {
    const amount = typeof sale.total_price_incl === 'number' 
      ? sale.total_price_incl 
      : (typeof sale.total_price === 'number' ? sale.total_price : 0);
    return sum + amount;
  }, 0);
  
  return { count: allSales.length, total, orders: allSales };
}

async function verifyCustomer(csvRow: any): Promise<{
  email: string;
  csvOrderCount: number;
  csvLTV: number;
  apiOrderCount: number;
  apiLTV: number;
  match: boolean;
  difference: string;
}> {
  const customerId = csvRow['Customer ID'] || csvRow.customerId;
  const email = csvRow.Email || csvRow.email || '';
  const csvOrderCount = parseInt(csvRow['Order Count'] || csvRow.orderCount || '0') || 0;
  const csvLTV = parseFloat(csvRow['Lifetime Value'] || csvRow.lifetimeValue || '0') || 0;
  
  if (!customerId) {
    return {
      email,
      csvOrderCount,
      csvLTV,
      apiOrderCount: 0,
      apiLTV: 0,
      match: false,
      difference: 'No customer ID in CSV',
    };
  }
  
  try {
    const { count: apiOrderCount, total: apiLTV } = await getCustomerSalesFromAPI(customerId);
    
    const orderCountMatch = Math.abs(csvOrderCount - apiOrderCount) <= 1; // Allow 1 order difference for timing
    const ltvMatch = Math.abs(csvLTV - apiLTV) < 5; // Allow $5 difference for rounding
    
    const match = orderCountMatch && ltvMatch;
    
    let difference = '';
    if (!orderCountMatch) {
      difference += `Orders: CSV=${csvOrderCount}, API=${apiOrderCount} `;
    }
    if (!ltvMatch) {
      difference += `LTV: CSV=$${csvLTV.toFixed(2)}, API=$${apiLTV.toFixed(2)}`;
    }
    if (match) {
      difference = '✅ MATCH';
    }
    
    return {
      email,
      csvOrderCount,
      csvLTV,
      apiOrderCount,
      apiLTV,
      match,
      difference,
    };
  } catch (error: any) {
    return {
      email,
      csvOrderCount,
      csvLTV,
      apiOrderCount: 0,
      apiLTV: 0,
      match: false,
      difference: `API Error: ${error.message}`,
    };
  }
}

async function main() {
  console.log('🔍 VERIFYING ANALYTICS ACCURACY');
  console.log('═'.repeat(70));
  console.log('');

  // Find the updated analytics file
  const analyticsFiles = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('customer_analytics_updated_') && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (analyticsFiles.length === 0) {
    console.error('❌ No customer_analytics_updated CSV found!');
    process.exit(1);
  }

  const analyticsFile = analyticsFiles[0];
  console.log(`📂 Loading: ${analyticsFile}\n`);

  const content = fs.readFileSync(analyticsFile, 'utf-8');
  const rows = parseCSV(content);

  console.log(`   Found ${rows.length} customers\n`);

  // Select test customers:
  // 1. Customer with many orders
  // 2. Customer with few orders
  // 3. Customer with high LTV
  // 4. Customer with email (to verify eCom merge)
  // 5. Random sample

  const testCustomers: any[] = [];
  
  // Find customer with most orders
  const highOrderCustomer = rows
    .filter(r => parseInt(r['Order Count'] || '0') > 0)
    .sort((a, b) => parseInt(b['Order Count'] || '0') - parseInt(a['Order Count'] || '0'))[0];
  if (highOrderCustomer) testCustomers.push({ ...highOrderCustomer, reason: 'Most orders' });

  // Find customer with high LTV
  const highLTVCustomer = rows
    .filter(r => parseFloat(r['Lifetime Value'] || '0') > 0)
    .sort((a, b) => parseFloat(b['Lifetime Value'] || '0') - parseFloat(a['Lifetime Value'] || '0'))[0];
  if (highLTVCustomer && highLTVCustomer.Email !== highOrderCustomer?.Email) {
    testCustomers.push({ ...highLTVCustomer, reason: 'High LTV' });
  }

  // Find customer with email (likely has eCom orders)
  const emailCustomer = rows.find(r => 
    (r.Email || r.email) && 
    (r.Email || r.email).includes('@') &&
    parseInt(r['Order Count'] || '0') > 5
  );
  if (emailCustomer && !testCustomers.find(t => t.Email === emailCustomer.Email)) {
    testCustomers.push({ ...emailCustomer, reason: 'Has email + orders (eCom check)' });
  }

  // Random sample
  const randomCustomers = rows
    .filter(r => parseInt(r['Order Count'] || '0') > 0)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  randomCustomers.forEach(c => {
    if (!testCustomers.find(t => t.Email === c.Email)) {
      testCustomers.push({ ...c, reason: 'Random sample' });
    }
  });

  console.log(`🧪 Testing ${testCustomers.length} customers against API...\n`);
  console.log('═'.repeat(70));
  console.log('');

  let matches = 0;
  let mismatches = 0;

  for (let i = 0; i < testCustomers.length; i++) {
    const customer = testCustomers[i];
    const email = customer.Email || customer.email || 'No email';
    const name = customer.Name || customer.name || 'Unknown';
    
    console.log(`${i + 1}. ${name} (${email})`);
    console.log(`   Reason: ${customer.reason}`);
    console.log(`   CSV: ${customer['Order Count']} orders, $${parseFloat(customer['Lifetime Value'] || '0').toFixed(2)} LTV`);
    console.log(`   Checking API...`);
    
    const result = await verifyCustomer(customer);
    
    if (result.match) {
      console.log(`   ✅ MATCH: ${result.apiOrderCount} orders, $${result.apiLTV.toFixed(2)} LTV`);
      matches++;
    } else {
      console.log(`   ❌ MISMATCH: ${result.difference}`);
      console.log(`      API: ${result.apiOrderCount} orders, $${result.apiLTV.toFixed(2)} LTV`);
      mismatches++;
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }

  console.log('═'.repeat(70));
  console.log('');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ Matches: ${matches}/${testCustomers.length}`);
  console.log(`❌ Mismatches: ${mismatches}/${testCustomers.length}`);
  console.log(`Accuracy: ${((matches / testCustomers.length) * 100).toFixed(1)}%`);
  console.log('');

  if (mismatches === 0) {
    console.log('✅ ALL TESTS PASSED - Analytics data is accurate!');
  } else if (mismatches <= 1) {
    console.log('⚠️  Minor discrepancies found (may be due to timing or rounding)');
    console.log('   Overall data appears accurate');
  } else {
    console.log('⚠️  Some discrepancies found - may need investigation');
  }
  
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ ERROR');
  console.error('═'.repeat(70));
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
});
