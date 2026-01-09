#!/usr/bin/env node
import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN}.retail.lightspeed.app/api/2.0`;

// Check a few customers with placeholder emails from the backup
const testCustomerIds = [
  '02269032-111f-11f0-fa97-a2344749380d', // Zviad M - had wyatt.wheeler@outlook.com
  '0282e8ff-bc1f-11ef-f633-993d545ebf04', // Zoey - had wyatt.wheeler@outlook.com
  '02269032-111f-11f0-eb9a-762fe6055c46', // Zeke Spirko - had wyatt.wheeler@outlook.com
  '02269032-111f-11f0-eb9a-586cd1d23f1f', // Ziad Chaoul - had ijh1990@icloud.com
];

async function checkCustomer(customerId: string) {
  const url = `${API_BASE}/customers/${customerId}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
}

async function main() {
  console.log('🔍 Checking Lightspeed API for placeholder emails...\n');

  for (const customerId of testCustomerIds) {
    try {
      const customer = await checkCustomer(customerId);
      console.log(`Customer: ${customer.name || 'Unknown'}`);
      console.log(`  ID: ${customer.id}`);
      console.log(`  Email from API: ${customer.email || '(EMPTY - NO EMAIL)'}`);
      console.log(`  Phone: ${customer.phone || customer.mobile || '(empty)'}`);
      console.log('');
      await new Promise(r => setTimeout(r, 100));
    } catch (e: any) {
      console.error(`Error checking ${customerId}: ${e.message}`);
    }
  }
}

main();
