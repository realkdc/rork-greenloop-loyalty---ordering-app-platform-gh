#!/usr/bin/env node
/**
 * Verify Customer Group Counts
 *
 * The Lightspeed dashboard UI caches customer counts.
 * This script queries the API directly to get actual customer counts per group.
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

const GROUPS = [
  { name: 'First Time Buyer', id: '02269032-111f-11f0-fa97-eb12f658ba5a' },
  { name: 'Seed', id: '02269032-111f-11f0-fa97-eb16249d0715' },
  { name: 'Sprout', id: '02269032-111f-11f0-fa97-eb1725275e64' },
  { name: 'Bloom', id: '02269032-111f-11f0-fa97-eb175d275306' },
  { name: 'Evergreen', id: '02269032-111f-11f0-fa97-eb1779efd27b' },
];

async function getCustomerCount(groupId: string): Promise<number> {
  try {
    const response = await fetch(
      `${API_BASE}/customers?customer_group_id=${groupId}&page_size=1`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return -1;
    }

    const data = await response.json();

    // Try to get total from pagination
    if (data.pagination?.total !== undefined) {
      return data.pagination.total;
    }

    // Otherwise count the data array
    return (data.data || []).length;
  } catch (error) {
    console.error(`Error fetching count for group ${groupId}:`, error);
    return -1;
  }
}

async function main() {
  console.log('🔍 Verifying Customer Group Counts\n');
  console.log('Note: The Lightspeed dashboard UI may cache counts.');
  console.log('This script queries the API directly for actual counts.\n');
  console.log('═'.repeat(60));

  let totalAssigned = 0;

  for (const group of GROUPS) {
    process.stdout.write(`\n${group.name}... `);
    const count = await getCustomerCount(group.id);

    if (count === -1) {
      console.log('❌ Error fetching count');
    } else {
      console.log(`✅ ${count} customers`);
      totalAssigned += count;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Total customers assigned to tier groups: ${totalAssigned}`);
  console.log('\n💡 If the Lightspeed dashboard shows 0, try:');
  console.log('   1. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)');
  console.log('   2. Click "View customers" on a group to see the list');
  console.log('   3. Wait a few minutes for the dashboard cache to update\n');
}

main();
