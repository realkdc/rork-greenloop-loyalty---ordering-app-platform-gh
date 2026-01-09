#!/usr/bin/env node
import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

async function apiRequest(endpoint: string) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`API Error (${response.status})`);
  return response.json();
}

async function main() {
  const nikkiCustomerId = '02269032-111f-11f0-fa97-ae13eaec05b9';
  
  // Search for receipts 2231 and 1971
  for (const receipt of ['2231', '1971']) {
    try {
      console.log(`\n🔍 Searching for Receipt ${receipt}...`);
      const result = await apiRequest(`/search?type=sales&q=${receipt}&page_size=200`);
      const sales = Array.isArray(result.data) ? result.data : [];
      const match = sales.find((s: any) => 
        String(s.receipt_number || s.invoice_number) === receipt
      );
      
      if (match) {
        console.log(`✅ Found Receipt ${receipt}:`);
        console.log(`   ID: ${match.id}`);
        console.log(`   Customer ID: ${match.customer_id}`);
        console.log(`   Matches Nikki's ID: ${match.customer_id === nikkiCustomerId ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   Date: ${match.created_at || match.sale_date}`);
        console.log(`   Total: $${match.total_price_incl || match.total_price || 0}`);
        console.log(`   Status: ${match.status}/${match.state}`);
        
        // Get full sale details to check customer email
        try {
          const fullSale = await apiRequest(`/sales/${match.id}`);
          const saleData = fullSale.data || fullSale;
          if (saleData.customer) {
            console.log(`   Customer Email: ${saleData.customer.email || 'N/A'}`);
          }
        } catch (e) {
          // Ignore
        }
      } else {
        console.log(`❌ Receipt ${receipt} not found in search results`);
      }
    } catch (e: any) {
      console.log(`❌ Error: ${e.message}`);
    }
  }
}

main();
