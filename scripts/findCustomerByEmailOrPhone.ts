#!/usr/bin/env node
/**
 * Find customer by email or phone to verify identity
 */

import 'dotenv/config';
import * as fs from 'fs';

async function main() {
  const searchTerm = process.argv[2];
  
  if (!searchTerm) {
    console.log('Usage: npx tsx scripts/findCustomerByEmailOrPhone.ts <email or phone>');
    process.exit(1);
  }
  
  const csvFile = 'customer_analytics_updated_2026-01-06.csv';
  const content = fs.readFileSync(csvFile, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(',');
  
  console.log(`🔍 SEARCHING FOR: ${searchTerm}`);
  console.log('═'.repeat(70));
  console.log('');
  
  const matches: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const email = (row[4] || '').toLowerCase();
    const phone = row[5] || '';
    const name = row[2] || '';
    
    if (email.includes(searchTerm.toLowerCase()) || 
        phone.includes(searchTerm) ||
        name.toLowerCase().includes(searchTerm.toLowerCase())) {
      const record: any = {};
      header.forEach((h, idx) => {
        record[h] = row[idx] || '';
      });
      matches.push(record);
    }
  }
  
  if (matches.length === 0) {
    console.log('❌ No matches found');
    console.log('');
    console.log('This means:');
    console.log('  - You have no orders in the system');
    console.log('  - OR your email/phone is different in Lightspeed');
    console.log('  - OR you ordered as a guest (no account)');
    process.exit(0);
  }
  
  console.log(`✅ Found ${matches.length} record(s):\n`);
  matches.forEach((match, i) => {
    console.log(`Record ${i + 1}:`);
    console.log(`  Customer ID: ${match['Customer ID'] || 'N/A'}`);
    console.log(`  Name: ${match.Name || 'N/A'}`);
    console.log(`  Email: ${match.Email || '(no email)'}`);
    console.log(`  Phone: ${match.Phone || '(no phone)'}`);
    console.log(`  Lifetime Value: $${match['Lifetime Value'] || '0'}`);
    console.log(`  Order Count: ${match['Order Count'] || '0'}`);
    console.log(`  First Order: ${match['First Order'] || 'N/A'}`);
    console.log(`  Last Order: ${match['Last Order'] || 'N/A'}`);
    console.log('');
  });
}

main().catch(console.error);
