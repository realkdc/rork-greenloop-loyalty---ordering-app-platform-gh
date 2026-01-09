#!/usr/bin/env node
/**
 * Test script to find loyalty/bonus points in Lightspeed customer data
 * Usage: npx tsx scripts/testCustomerLoyalty.ts
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

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

async function testCustomerLoyalty() {
  console.log('\n🔍 TESTING CUSTOMER LOYALTY/BONUS POINTS...\n');
  console.log('━'.repeat(60));

  try {
    // Get a few customers to see what fields they have
    const data = await apiRequest('/customers?page_size=5');
    const customers = Array.isArray(data.data) ? data.data : [];

    console.log(`\n✅ Found ${customers.length} customers\n`);

    if (customers.length > 0) {
      // Show first customer with ALL fields
      const customer = customers[0];
      console.log('📋 FIRST CUSTOMER - ALL FIELDS:');
      console.log('━'.repeat(60));
      console.log(JSON.stringify(customer, null, 2));
      console.log('\n');

      // Look for loyalty-related fields
      console.log('🎯 LOYALTY-RELATED FIELDS FOUND:');
      console.log('━'.repeat(60));
      
      const loyaltyFields: string[] = [];
      const allKeys = Object.keys(customer);
      
      allKeys.forEach(key => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('loyalty') ||
          lowerKey.includes('bonus') ||
          lowerKey.includes('point') ||
          lowerKey.includes('reward') ||
          lowerKey.includes('balance') ||
          lowerKey.includes('credit')
        ) {
          loyaltyFields.push(key);
          console.log(`   ✅ ${key}: ${JSON.stringify(customer[key])}`);
        }
      });

      if (loyaltyFields.length === 0) {
        console.log('   ⚠️  No obvious loyalty fields found in customer object');
        console.log('   💡 Checking all numeric fields that might be points...\n');
        
        allKeys.forEach(key => {
          const value = customer[key];
          if (typeof value === 'number' && value >= 0 && value < 100000) {
            console.log(`   💰 ${key}: ${value} (might be points/balance)`);
          }
        });
      }

      // Also check if there's a separate loyalty endpoint
      console.log('\n🔍 CHECKING FOR SEPARATE LOYALTY ENDPOINTS...');
      console.log('━'.repeat(60));
      
      const endpointsToTry = [
        `/customers/${customer.id}/loyalty`,
        `/customers/${customer.id}/bonus`,
        `/customers/${customer.id}/points`,
        `/loyalty/customers/${customer.id}`,
        `/bonus/customers/${customer.id}`,
      ];

      for (const endpoint of endpointsToTry) {
        try {
          const loyaltyData = await apiRequest(endpoint);
          console.log(`   ✅ Found: ${endpoint}`);
          console.log(`   Data: ${JSON.stringify(loyaltyData, null, 2)}`);
        } catch (e: any) {
          // Endpoint doesn't exist, that's fine
        }
      }
    } else {
      console.log('⚠️  No customers found');
    }

    // Also check retailer for loyalty settings
    console.log('\n🏪 CHECKING RETAILER LOYALTY SETTINGS...');
    console.log('━'.repeat(60));
    const retailer = await apiRequest('/retailer');
    
    const retailerLoyaltyFields: string[] = [];
    Object.keys(retailer).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('loyalty') ||
        lowerKey.includes('bonus') ||
        lowerKey.includes('point') ||
        lowerKey.includes('reward')
      ) {
        retailerLoyaltyFields.push(key);
        console.log(`   ✅ ${key}: ${JSON.stringify(retailer[key])}`);
      }
    });

    if (retailerLoyaltyFields.length === 0) {
      console.log('   ⚠️  No loyalty settings found in retailer object');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testCustomerLoyalty();
