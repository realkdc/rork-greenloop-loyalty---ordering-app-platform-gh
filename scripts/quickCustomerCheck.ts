#!/usr/bin/env node
/**
 * Quick customer tester for Lightspeed Retail (X-Series)
 *
 * Usage:
 *   npx tsx scripts/quickCustomerCheck.ts --email someone@example.com
 *   npx tsx scripts/quickCustomerCheck.ts --phone 5551234567
 *   npx tsx scripts/quickCustomerCheck.ts --id <customer-id>
 *
 * What it prints:
 * - Matched customer (name/email/phone/id)
 * - Total orders (all valid statuses), eCom vs in-store counts
 * - Lifetime value, first/last order dates, days since last order
 * - Last 5 orders (receipt, status/state, date, amount, eCom yes/no)
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API = `https://${DOMAIN}.retail.lightspeed.app/api/2.0`;

type Customer = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
};

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function apiRequest(endpoint: string) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} - ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function findCustomer(): Promise<Customer> {
  const email = getArg('--email');
  const phone = getArg('--phone');
  const id = getArg('--id');

  if (!email && !phone && !id) {
    throw new Error('Pass one of --email, --phone, or --id');
  }

  if (id) {
    const result = await apiRequest(`/customers/${id}`);
    if (!result?.data?.id) throw new Error(`No customer found for id ${id}`);
    return {
      id: result.data.id,
      name: result.data.name || '',
      email: result.data.email || '',
      phone: result.data.phone || '',
    };
  }

  const query = email ? encodeURIComponent(email) : encodeURIComponent(phone || '');
  const search = await apiRequest(`/search?type=customers&q=${query}&page_size=10`);
  const list = Array.isArray(search.data) ? search.data : [];

  const match = list.find((c: any) => {
    const cEmail = (c.email || '').toLowerCase();
    const cPhone = (c.phone || '').replace(/\D/g, '');
    const argPhone = (phone || '').replace(/\D/g, '');
    return (email && cEmail === email.toLowerCase()) || (phone && cPhone.endsWith(argPhone));
  }) || list[0];

  if (!match) throw new Error('No customer found for query');

  return {
    id: match.id,
    name: match.name || '',
    email: match.email || '',
    phone: match.phone || '',
  };
}

function isEcomOrder(sale: any, onlineRegisterId: string | null): boolean {
  const source = String(sale.source || '').toLowerCase();
  const note = String(sale.note || '').toLowerCase();
  return source.startsWith('ecw:') ||
    (onlineRegisterId && sale.register_id === onlineRegisterId) ||
    note.includes('order id') ||
    note.includes('ecom');
}

async function getOnlineRegisterId(): Promise<string | null> {
  try {
    const registers = await apiRequest('/registers');
    const list = Array.isArray(registers.data) ? registers.data : [];
    const online = list.find((r: any) => {
      const name = (r.name || '').toLowerCase();
      return name.includes('online') || name.includes('ecom');
    });
    return online ? online.id : null;
  } catch (e) {
    return null;
  }
}

async function getSales(customerId: string) {
  const allSales: any[] = [];
  const pageSize = 200;
  const onlineRegisterId = await getOnlineRegisterId();
  let offset = 0;
  let consecutiveEmpty = 0;

  while (consecutiveEmpty < 3) {
    const res = await apiRequest(`/search?type=sales&customer_id=${customerId}&page_size=${pageSize}&offset=${offset}`);
    const sales = Array.isArray(res.data) ? res.data : [];

    if (sales.length === 0) {
      consecutiveEmpty++;
      offset += pageSize;
      continue;
    }

    consecutiveEmpty = 0;

    const valid = sales.filter((s: any) => {
      const status = s.status || '';
      const state = s.state || '';
      return !status.includes('CANCELLED') && !status.includes('VOID') &&
             !state.includes('cancelled') && !state.includes('void');
    });

    valid.forEach(sale => {
      const ecom = isEcomOrder(sale, onlineRegisterId);
      allSales.push({ ...sale, _isEcom: ecom });
    });

    if (sales.length < pageSize) break;
    offset += pageSize;
    await new Promise(r => setTimeout(r, 50));
  }

  return allSales;
}

function summarizeSales(sales: any[]) {
  let total = 0;
  let first: Date | null = null;
  let last: Date | null = null;

  sales.forEach(s => {
    const amount = typeof s.total_price_incl === 'number' ? s.total_price_incl :
      (typeof s.total_price === 'number' ? s.total_price : 0);
    total += amount;

    const created = s.created_at ? new Date(s.created_at) : null;
    if (created) {
      if (!first || created < first) first = created;
      if (!last || created > last) last = created;
    }
  });

  const ecom = sales.filter(s => s._isEcom).length;
  const retail = sales.length - ecom;
  const daysSinceLast = last ? Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return { total, ecom, retail, count: sales.length, first, last, daysSinceLast };
}

function formatDate(d: Date | null) {
  return d ? d.toISOString().split('T')[0] : 'n/a';
}

async function main() {
  if (!TOKEN) throw new Error('Missing EXPO_PUBLIC_LIGHTSPEED_TOKEN in env');

  const customer = await findCustomer();
  console.log('👤 Customer');
  console.log(`   ID:    ${customer.id}`);
  console.log(`   Name:  ${customer.name || 'n/a'}`);
  console.log(`   Email: ${customer.email || 'n/a'}`);
  console.log(`   Phone: ${customer.phone || 'n/a'}`);
  console.log('');

  const sales = await getSales(customer.id);
  const summary = summarizeSales(sales);

  console.log('📊 Orders');
  console.log(`   Total orders: ${summary.count}`);
  console.log(`   eCom: ${summary.ecom} | In-store: ${summary.retail}`);
  console.log(`   LTV: $${summary.total.toFixed(2)}`);
  console.log(`   First order: ${formatDate(summary.first)}`);
  console.log(`   Last order:  ${formatDate(summary.last)}`);
  console.log(`   Days since last: ${summary.daysSinceLast ?? 'n/a'}`);
  console.log('');

  console.log('🧾 Last 5 orders:');
  sales
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 5)
    .forEach((sale, idx) => {
      const amount = typeof sale.total_price_incl === 'number' ? sale.total_price_incl :
        (typeof sale.total_price === 'number' ? sale.total_price : 0);
      const date = sale.created_at ? new Date(sale.created_at).toISOString().split('T')[0] : 'n/a';
      console.log(`   ${idx + 1}. ${date} | $${amount.toFixed(2)} | Receipt ${sale.receipt_number || sale.id} | ${sale.status}/${sale.state} | eCom:${sale._isEcom ? 'yes' : 'no'}`);
    });
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
