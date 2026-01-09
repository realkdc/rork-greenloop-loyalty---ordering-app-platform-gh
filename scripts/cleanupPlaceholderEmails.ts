#!/usr/bin/env node
/**
 * Cleanup Placeholder Emails in Master CSV
 *
 * Removes duplicate/placeholder emails from the master customer analytics CSV.
 * These are emails that Lightspeed assigns as placeholders when customers
 * don't provide an email address.
 *
 * Usage: npx tsx scripts/cleanupPlaceholderEmails.ts
 */

import * as fs from 'fs';

const MASTER_CSV = 'customer_analytics_master.csv';
const BACKUP_CSV = `customer_analytics_master_backup_${new Date().toISOString().split('T')[0]}.csv`;

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

function escapeCsvField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

console.log('🧹 CLEANUP PLACEHOLDER EMAILS');
console.log('═'.repeat(60));

// Read master CSV
if (!fs.existsSync(MASTER_CSV)) {
  console.error('❌ Error: customer_analytics_master.csv not found!');
  process.exit(1);
}

const content = fs.readFileSync(MASTER_CSV, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());

if (lines.length < 2) {
  console.error('❌ Error: CSV file is empty or invalid!');
  process.exit(1);
}

// Create backup
console.log(`📦 Creating backup: ${BACKUP_CSV}\n`);
fs.writeFileSync(BACKUP_CSV, content);

// Parse CSV
const headers = parseCSVLine(lines[0]);
const emailIdx = headers.indexOf('Email');

if (emailIdx === -1) {
  console.error('❌ Error: Email column not found in CSV!');
  process.exit(1);
}

console.log(`📊 Analyzing emails in ${lines.length - 1} customer records...\n`);

// Count email frequencies
const emailFrequency = new Map<string, number>();
const rows = lines.slice(1).map(line => parseCSVLine(line));

for (const row of rows) {
  const email = (row[emailIdx] || '').toLowerCase().trim();
  if (email && email.includes('@')) {
    emailFrequency.set(email, (emailFrequency.get(email) || 0) + 1);
  }
}

// Find placeholder emails (used by more than one customer)
const placeholderEmails = new Set<string>();
for (const [email, count] of emailFrequency.entries()) {
  if (count > 1) {
    placeholderEmails.add(email);
  }
}

console.log(`🔍 Found ${placeholderEmails.size} placeholder emails`);
console.log(`   Top 10 most common:`);

const sorted = Array.from(emailFrequency.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

for (const [email, count] of sorted) {
  if (count > 1) {
    console.log(`     ${email}: ${count} customers`);
  }
}

console.log('');

// Clean emails
let cleanedCount = 0;
for (const row of rows) {
  const email = (row[emailIdx] || '').toLowerCase().trim();
  if (email && placeholderEmails.has(email)) {
    row[emailIdx] = ''; // Remove placeholder email
    cleanedCount++;
  }
}

console.log(`✅ Cleaned ${cleanedCount} placeholder emails\n`);

// Write cleaned CSV
console.log(`💾 Writing cleaned CSV to ${MASTER_CSV}...`);

const cleanedCsv = [
  headers.map(escapeCsvField).join(','),
  ...rows.map(r => r.map(escapeCsvField).join(','))
].join('\n');

fs.writeFileSync(MASTER_CSV, cleanedCsv);

console.log(`✅ Done! Master CSV has been cleaned.\n`);
console.log(`📝 Summary:`);
console.log(`   Total customers: ${rows.length}`);
console.log(`   Placeholder emails removed: ${cleanedCount}`);
console.log(`   Backup saved as: ${BACKUP_CSV}\n`);
