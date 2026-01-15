#!/usr/bin/env node
/**
 * Sync Customer Tiers to Lightspeed Customer Groups
 *
 * Reads customer_analytics_master.csv and assigns customers to their
 * corresponding Lightspeed customer groups based on tier.
 *
 * Tier Mapping (from your screenshot):
 * - "First Time Buyer" → First-time buyers
 * - "Seed" → GreenHaus Crew - Seed (Loyalty + First Purchase)
 * - "Sprout" → GreenHaus Crew - Sprout ($250 CLV or 3 purchases/month)
 * - "Bloom" → GreenHaus Crew - Bloom ($750 CLV)
 * - "Evergreen" → GreenHaus Crew - Evergreen ($1,500 CLV)
 *
 * Usage:
 *   npx tsx scripts/syncCustomerTiersToLightspeed.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run: Show what would be updated without making changes
 *   --limit N: Only process first N customers (for testing)
 *   --force: Re-assign even if customer already in correct group
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

const MASTER_CSV = 'customer_analytics_master.csv';
const SYNC_LOG_FILE = 'tier_sync_log.json';

// Map tiers to Lightspeed Customer Group IDs
const TIER_TO_GROUP_MAP: Record<string, string> = {
  'First Time Buyer': '02269032-111f-11f0-fa97-eb12f658ba5a',
  'Seed': '02269032-111f-11f0-fa97-eb16249d0715',
  'Sprout': '02269032-111f-11f0-fa97-eb1725275e64',
  'Bloom': '02269032-111f-11f0-fa97-eb175d275306',
  'Evergreen': '02269032-111f-11f0-fa97-eb1779efd27b',
  'None': '' // No group assignment
};

interface CustomerRecord {
  customerId: string;
  customerCode: string;
  name: string;
  email: string;
  tier: string;
  isFirstTimeBuyer?: string;
  lastUpdated?: string;
}

interface SyncLog {
  lastRun: string;
  totalCustomers: number;
  updated: number;
  skipped: number;
  errors: number;
  tierBreakdown: Record<string, number>;
  errorDetails: Array<{ customerId: string; error: string }>;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function getCustomerGroups() {
  console.log('📋 Fetching Lightspeed customer groups...');

  const response = await fetchWithAuth(`${API_BASE}/customer_groups`);
  const groups = response.data || [];

  console.log(`✅ Found ${groups.length} customer groups:`);
  groups.forEach((group: any) => {
    console.log(`   - ${group.name} (ID: ${group.id})`);
  });

  return groups;
}

async function getCurrentCustomerGroup(customerId: string): Promise<string | null> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/customers/${customerId}`);
    return response.data?.customerGroupId || null;
  } catch (error) {
    console.error(`❌ Error fetching customer ${customerId}:`, error);
    return null;
  }
}

async function assignCustomerToGroup(customerId: string, groupId: string): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would assign customer ${customerId} to group ${groupId}`);
    return true;
  }

  try {
    await fetchWithAuth(`${API_BASE}/customers/${customerId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        customerGroupId: groupId
      })
    });
    return true;
  } catch (error) {
    console.error(`❌ Error assigning customer ${customerId} to group:`, error);
    return false;
  }
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

function loadCustomersFromCSV(): CustomerRecord[] {
  if (!fs.existsSync(MASTER_CSV)) {
    throw new Error(`Master CSV not found: ${MASTER_CSV}`);
  }

  const content = fs.readFileSync(MASTER_CSV, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = parseCSVLine(lines[0]);
  const customers: CustomerRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    const customer: CustomerRecord = {
      customerId: values[0] || '',
      customerCode: values[1] || '',
      name: values[2] || '',
      email: values[3] || '',
      tier: values[14] || 'None',
      isFirstTimeBuyer: values[18] || '',
      lastUpdated: values[20] || ''
    };

    if (customer.customerId) {
      customers.push(customer);
    }
  }

  return customers;
}

function loadSyncLog(): SyncLog | null {
  if (!fs.existsSync(SYNC_LOG_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(SYNC_LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('⚠️  Error loading sync log:', error);
    return null;
  }
}

function saveSyncLog(log: SyncLog) {
  fs.writeFileSync(SYNC_LOG_FILE, JSON.stringify(log, null, 2));
}

async function main() {
  console.log('🚀 Lightspeed Customer Tier Sync');
  console.log('================================\n');

  if (DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
  }

  // 1. Get customer groups from Lightspeed
  const groups = await getCustomerGroups();

  console.log('\n📊 Tier to Group Mapping:');
  Object.entries(TIER_TO_GROUP_MAP).forEach(([tier, groupId]) => {
    const group = groups.find((g: any) => g.id === groupId);
    console.log(`   ${tier} → ${group?.name || 'NOT FOUND'} (${groupId})`);
  });

  // 2. Load customers from CSV
  console.log('\n📁 Loading customers from CSV...');
  const customers = loadCustomersFromCSV();
  console.log(`✅ Loaded ${customers.length} customers\n`);

  // 3. Load previous sync log
  const previousLog = loadSyncLog();
  if (previousLog) {
    console.log(`📜 Last sync: ${previousLog.lastRun}`);
    console.log(`   Updated: ${previousLog.updated}, Skipped: ${previousLog.skipped}, Errors: ${previousLog.errors}\n`);
  }

  // 4. Process customers
  const log: SyncLog = {
    lastRun: new Date().toISOString(),
    totalCustomers: LIMIT > 0 ? Math.min(LIMIT, customers.length) : customers.length,
    updated: 0,
    skipped: 0,
    errors: 0,
    tierBreakdown: {},
    errorDetails: []
  };

  const customersToProcess = LIMIT > 0 ? customers.slice(0, LIMIT) : customers;

  console.log(`🔄 Processing ${customersToProcess.length} customers...\n`);

  for (let i = 0; i < customersToProcess.length; i++) {
    const customer = customersToProcess[i];
    const progress = `[${i + 1}/${customersToProcess.length}]`;

    // Determine target group
    let targetGroupId: string | null = null;

    if (customer.isFirstTimeBuyer === 'Yes') {
      targetGroupId = TIER_TO_GROUP_MAP['First Time Buyer'];
    } else if (customer.tier && customer.tier !== 'None') {
      targetGroupId = TIER_TO_GROUP_MAP[customer.tier] || null;
    }

    // Track tier breakdown
    const tierKey = customer.tier || 'None';
    log.tierBreakdown[tierKey] = (log.tierBreakdown[tierKey] || 0) + 1;

    if (!targetGroupId) {
      console.log(`${progress} ⏭️  Skipping ${customer.name || customer.email || customer.customerId} (tier: ${customer.tier})`);
      log.skipped++;
      continue;
    }

    // Check if already in correct group (unless --force)
    if (!FORCE) {
      const currentGroupId = await getCurrentCustomerGroup(customer.customerId);
      if (currentGroupId === targetGroupId) {
        console.log(`${progress} ✓ ${customer.name || customer.email || customer.customerId} already in correct group`);
        log.skipped++;
        continue;
      }
    }

    // Assign to group
    console.log(`${progress} 🔄 Assigning ${customer.name || customer.email || customer.customerId} to ${customer.tier}...`);
    const success = await assignCustomerToGroup(customer.customerId, targetGroupId);

    if (success) {
      log.updated++;
      console.log(`${progress} ✅ Updated`);
    } else {
      log.errors++;
      log.errorDetails.push({
        customerId: customer.customerId,
        error: `Failed to assign to group ${targetGroupId}`
      });
    }

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 5. Save log
  saveSyncLog(log);

  // 6. Summary
  console.log('\n' + '='.repeat(50));
  console.log('✨ Sync Complete!\n');
  console.log(`Total Customers: ${log.totalCustomers}`);
  console.log(`✅ Updated: ${log.updated}`);
  console.log(`⏭️  Skipped: ${log.skipped}`);
  console.log(`❌ Errors: ${log.errors}\n`);

  console.log('Tier Breakdown:');
  Object.entries(log.tierBreakdown).forEach(([tier, count]) => {
    console.log(`   ${tier}: ${count}`);
  });

  if (log.errors > 0) {
    console.log('\n❌ Errors:');
    log.errorDetails.slice(0, 10).forEach(err => {
      console.log(`   - ${err.customerId}: ${err.error}`);
    });
    if (log.errorDetails.length > 10) {
      console.log(`   ... and ${log.errorDetails.length - 10} more`);
    }
  }

  console.log(`\n📄 Sync log saved to: ${SYNC_LOG_FILE}`);

  if (DRY_RUN) {
    console.log('\n🧪 This was a DRY RUN - no actual changes were made');
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
