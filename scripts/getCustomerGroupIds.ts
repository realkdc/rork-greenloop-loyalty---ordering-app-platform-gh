#!/usr/bin/env node
/**
 * Get Lightspeed Customer Group IDs
 *
 * Fetches all customer groups from Lightspeed and displays their IDs.
 * Use this to get the IDs needed for syncCustomerTiersToLightspeed.ts
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

async function fetchWithAuth(url: string) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log('🔍 Fetching Lightspeed Customer Groups\n');

  try {
    const response = await fetchWithAuth(`${API_BASE}/customer-groups`);
    const groups = response.data || [];

    console.log(`✅ Found ${groups.length} customer groups:\n`);

    groups.forEach((group: any, index: number) => {
      console.log(`${index + 1}. ${group.name}`);
      console.log(`   ID: ${group.id}`);
      console.log(`   Created: ${group.created_at || 'N/A'}`);
      console.log(`   Customers: ${group.customer_count || 0}`);
      console.log('');
    });

    console.log('\n📋 Copy these IDs to syncCustomerTiersToLightspeed.ts:');
    console.log('\nconst TIER_TO_GROUP_MAP = {');

    // Try to map based on names
    const nameMap: Record<string, string> = {
      'First Time Buyer': '',
      'Seed': '',
      'Sprout': '',
      'Bloom': '',
      'Evergreen': ''
    };

    groups.forEach((group: any) => {
      const name = group.name.toLowerCase();
      if (name.includes('first') && name.includes('time')) {
        nameMap['First Time Buyer'] = group.id;
      } else if (name.includes('seed')) {
        nameMap['Seed'] = group.id;
      } else if (name.includes('sprout')) {
        nameMap['Sprout'] = group.id;
      } else if (name.includes('bloom')) {
        nameMap['Bloom'] = group.id;
      } else if (name.includes('evergreen')) {
        nameMap['Evergreen'] = group.id;
      }
    });

    Object.entries(nameMap).forEach(([tier, id]) => {
      const idValue = id || 'REPLACE_WITH_ID';
      console.log(`  '${tier}': '${idValue}',`);
    });

    console.log('  \'None\': \'\'');
    console.log('};');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
