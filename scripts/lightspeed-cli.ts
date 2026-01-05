#!/usr/bin/env node
/**
 * Lightspeed Retail API - Interactive CLI Tool
 * 
 * Easy-to-use script to pull store data from Lightspeed Retail (X-Series)
 * 
 * Usage: npx tsx scripts/lightspeed-cli.ts
 */

import 'dotenv/config';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '═'.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('═'.repeat(60) + '\n');
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

// ============================================================================
// DATA FETCHERS
// ============================================================================

async function getStoreInfo() {
  logSection('🏪 STORE INFORMATION');
  
  const retailer = await apiRequest('/retailer');
  const outlets = await apiRequest('/outlets');
  const outletsList = Array.isArray(outlets.data) ? outlets.data : [];

  log(`Store Name: ${retailer.name || retailer.retailer_name || 'N/A'}`, colors.green);
  log(`Timezone: ${retailer.time_zone || 'N/A'}`);
  log(`Currency: ${retailer.currency || 'N/A'}`);
  if (retailer.email) log(`Email: ${retailer.email}`);
  if (retailer.phone) log(`Phone: ${retailer.phone}`);
  
  console.log(`\n📍 Store Locations (${outletsList.length}):`);
  outletsList.forEach((outlet: any, i: number) => {
    console.log(`   ${i + 1}. ${outlet.name || 'Unnamed'}`);
    if (outlet.address) {
      const addr = outlet.address;
      console.log(`      ${addr.address_1 || ''} ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || ''}`);
    }
  });
  
  return { retailer, outlets: outletsList };
}

async function getTodaySales() {
  logSection('💰 TODAY\'S SALES');
  
  const retailer = await apiRequest('/retailer');
  const storeTimezone = retailer.time_zone || 'America/Chicago';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: storeTimezone });
  
  log(`Date: ${todayStr}`, colors.cyan);
  log(`Timezone: ${storeTimezone}\n`, colors.cyan);

  const search = await apiRequest(`/search?type=sales&page_size=200`);
  const sales = Array.isArray(search.data) ? search.data : [];

  let saleCount = 0;
  let totalRevenue = 0;
  let lastSaleUtc: Date | null = null;

  for (const sale of sales) {
    if (!sale?.created_at) continue;
    const isClosed = sale.status === 'CLOSED' && sale.state === 'closed';
    if (!isClosed) continue;

    const createdAt = new Date(sale.created_at);
    const saleDayInStore = createdAt.toLocaleDateString('en-CA', { timeZone: storeTimezone });
    if (saleDayInStore !== todayStr) continue;

    const amount = typeof sale.total_price === 'number' ? sale.total_price : 0;
    saleCount += 1;
    totalRevenue += amount;
    if (!lastSaleUtc || createdAt > lastSaleUtc) lastSaleUtc = createdAt;
  }

  log(`Number of Sales: ${saleCount}`, colors.green);
  log(`Total Revenue: $${totalRevenue.toFixed(2)}`, colors.green);
  if (saleCount > 0) {
    log(`Average Sale: $${(totalRevenue / saleCount).toFixed(2)}`, colors.green);
  }
  if (lastSaleUtc) {
    log(`Last Sale: ${lastSaleUtc.toLocaleString('en-US', { timeZone: storeTimezone })}`, colors.cyan);
  }

  return { count: saleCount, total: totalRevenue, average: saleCount > 0 ? totalRevenue / saleCount : 0 };
}

async function getRecentSales(limit: number = 10, exportCsv: boolean = false) {
  logSection(`📋 RECENT SALES (Last ${limit})`);
  
  const retailer = await apiRequest('/retailer');
  const storeTimezone = retailer.time_zone || 'America/Chicago';
  const search = await apiRequest(`/search?type=sales&page_size=${limit}`);
  const sales = Array.isArray(search.data) ? search.data.slice(0, limit) : [];

  // Get outlets
  const outletsData = await apiRequest('/outlets');
  const outlets = Array.isArray(outletsData.data) ? outletsData.data : [];
  const outletMap = new Map<string, any>();
  outlets.forEach((outlet: any) => {
    if (outlet.id) outletMap.set(outlet.id, outlet);
  });

  const salesWithDetails: any[] = [];

  for (const sale of sales) {
    let customerName = 'Walk-in';
    let customerId = '';
    let customerPhone = '';
    let employeeName = '';
    let locationName = '';

    if (sale.customer_id) {
      try {
        const customerResponse = await apiRequest(`/customers/${sale.customer_id}`);
        const customerData = customerResponse.data || customerResponse;
        customerName = customerData.name || 
          (customerData.first_name && customerData.last_name 
            ? `${customerData.first_name} ${customerData.last_name}` 
            : customerData.first_name || customerData.last_name || 'Walk-in');
        customerId = customerData.customer_code || customerData.id || sale.customer_id;
        customerPhone = customerData.phone || customerData.mobile || customerData.phone_number || '';
      } catch (e) {}
    }

    if (sale.user_id) {
      try {
        const userResponse = await apiRequest(`/users/${sale.user_id}`);
        const userData = userResponse.data || userResponse;
        employeeName = userData.display_name || userData.username || userData.name || '';
      } catch (e) {}
    }

    if (sale.outlet_id) {
      const outlet = outletMap.get(sale.outlet_id);
      if (outlet) locationName = outlet.name || '';
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

    const saleTotal = typeof sale.total_price_incl === 'number'
      ? sale.total_price_incl
      : typeof sale.total_price === 'number'
        ? sale.total_price
        : 0;

    salesWithDetails.push({
      receipt: sale.receipt_number || sale.invoice_number || sale.id?.substring(0, 8) || 'N/A',
      dateTime: saleDateLocal,
      customer: customerName,
      customerId,
      phone: customerPhone,
      employee: employeeName,
      location: locationName,
      total: saleTotal.toFixed(2),
      status: sale.status || sale.state || 'N/A',
      note: sale.note || '',
    });
  }

  // Display
  salesWithDetails.forEach((sale, i) => {
    console.log(`${i + 1}. Receipt: ${sale.receipt} | ${sale.dateTime}`);
    log(`   Customer: ${sale.customer} (${sale.customerId})`, colors.cyan);
    if (sale.phone) log(`   Phone: ${sale.phone}`, colors.cyan);
    log(`   Sold by: ${sale.employee || 'N/A'} @ ${sale.location || 'N/A'}`, colors.cyan);
    log(`   Total: $${sale.total} | Status: ${sale.status}`, colors.green);
    if (sale.note) log(`   Note: ${sale.note}`, colors.yellow);
    console.log('');
  });

  // Export CSV if requested
  if (exportCsv) {
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
        `$${sale.total}`,
        sale.status,
        `"${sale.note.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const csvPath = path.join(process.cwd(), `recent_sales_${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    log(`\n✅ CSV exported to: ${csvPath}`, colors.green);
  }

  return salesWithDetails;
}

async function getCustomers(limit: number = 20) {
  logSection(`👥 CUSTOMERS (First ${limit})`);
  
  const data = await apiRequest(`/customers?page_size=${limit}`);
  const customers = Array.isArray(data.data) ? data.data : [];

  customers.forEach((customer: any, i: number) => {
    const name = customer.name || 
      (customer.first_name && customer.last_name 
        ? `${customer.first_name} ${customer.last_name}` 
        : customer.first_name || customer.last_name || 'N/A');
    
    console.log(`${i + 1}. ${name}`);
    log(`   ID: ${customer.customer_code || customer.id || 'N/A'}`, colors.cyan);
    if (customer.email) log(`   Email: ${customer.email}`, colors.cyan);
    if (customer.phone) log(`   Phone: ${customer.phone}`, colors.cyan);
    if (customer.loyalty_balance) log(`   Loyalty Balance: $${customer.loyalty_balance}`, colors.green);
    if (customer.year_to_date) log(`   Year to Date: $${customer.year_to_date}`, colors.green);
    console.log('');
  });

  return customers;
}

async function getProducts(limit: number = 20) {
  logSection(`📦 PRODUCTS (First ${limit})`);
  
  const data = await apiRequest(`/products?page_size=${limit}`);
  const products = Array.isArray(data.data) ? data.data : [];
  const total = data.pagination?.total || products.length;

  log(`Total Products: ${total}\n`, colors.cyan);

  products.forEach((product: any, i: number) => {
    console.log(`${i + 1}. ${product.name || 'Unnamed Product'}`);
    log(`   ID: ${product.id}`, colors.cyan);
    log(`   SKU: ${product.sku || 'N/A'}`, colors.cyan);
    if (product.price) log(`   Price: $${product.price}`, colors.green);
    if (product.inventory) {
      log(`   Inventory: ${product.inventory.quantity || 'N/A'} available`, colors.yellow);
    }
    console.log('');
  });

  return { products, total };
}

async function getInventory(outletId?: string) {
  logSection('📊 INVENTORY');
  
  let endpoint = '/inventory?page_size=50';
  if (outletId) endpoint += `&outlet_id=${outletId}`;
  
  const data = await apiRequest(endpoint);
  const inventory = Array.isArray(data.data) ? data.data : [];

  inventory.forEach((item: any, i: number) => {
    console.log(`${i + 1}. ${item.product_name || 'Unknown Product'}`);
    log(`   Product ID: ${item.product_id || 'N/A'}`, colors.cyan);
    log(`   Outlet: ${item.outlet_name || 'N/A'}`, colors.cyan);
    log(`   Quantity: ${item.quantity || 0}`, colors.yellow);
    console.log('');
  });

  return inventory;
}

// ============================================================================
// MENU SYSTEM
// ============================================================================

function showMenu() {
  console.clear();
  logSection('🚀 LIGHTSPEED RETAIL API CLI');
  log(`Store: ${DOMAIN_PREFIX}.retail.lightspeed.app\n`, colors.cyan);
  
  console.log('Select an option:');
  console.log('');
  log('  1. Store Information', colors.bright);
  log('  2. Today\'s Sales Summary', colors.bright);
  log('  3. Recent Sales (with details)', colors.bright);
  log('  4. Recent Sales (export CSV)', colors.bright);
  log('  5. Customers List', colors.bright);
  log('  6. Products List', colors.bright);
  log('  7. Inventory', colors.bright);
  log('  8. Run All (Quick Overview)', colors.bright);
  log('  0. Exit', colors.bright);
  console.log('');
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function handleChoice(choice: string) {
  try {
    switch (choice) {
      case '1':
        await getStoreInfo();
        break;
      case '2':
        await getTodaySales();
        break;
      case '3': {
        const limitStr = await askQuestion('How many sales? (default: 10): ');
        const limit = parseInt(limitStr) || 10;
        await getRecentSales(limit, false);
        break;
      }
      case '4': {
        const limitStr = await askQuestion('How many sales? (default: 10): ');
        const limit = parseInt(limitStr) || 10;
        await getRecentSales(limit, true);
        break;
      }
      case '5': {
        const limitStr = await askQuestion('How many customers? (default: 20): ');
        const limit = parseInt(limitStr) || 20;
        await getCustomers(limit);
        break;
      }
      case '6': {
        const limitStr = await askQuestion('How many products? (default: 20): ');
        const limit = parseInt(limitStr) || 20;
        await getProducts(limit);
        break;
      }
      case '7':
        await getInventory();
        break;
      case '8':
        await getStoreInfo();
        await getTodaySales();
        await getRecentSales(5, false);
        break;
      case '0':
        log('\n👋 Goodbye!', colors.green);
        process.exit(0);
        break;
      default:
        log('\n❌ Invalid choice. Please try again.', colors.red);
    }
  } catch (error: any) {
    log(`\n❌ Error: ${error.message}`, colors.red);
  }
}

async function main() {
  if (!TOKEN) {
    log('\n❌ ERROR: No token set in .env!', colors.red);
    log('   Expected: EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...', colors.yellow);
    process.exit(1);
  }

  while (true) {
    showMenu();
    const choice = await askQuestion('Enter your choice: ');
    await handleChoice(choice);
    
    console.log('\n');
    await askQuestion('Press Enter to continue...');
  }
}

main().catch((error) => {
  log(`\n❌ Fatal Error: ${error.message}`, colors.red);
  process.exit(1);
});
