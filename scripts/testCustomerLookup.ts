/**
 * Test customer lookup functionality
 */

import { lookupCustomer } from '../services/lightspeedCustomerLookup';

async function test() {
  const testEmail = 'kdcxmusic@gmail.com';

  console.log('🔍 Testing customer lookup for:', testEmail);
  console.log('───────────────────────────────────────');

  try {
    const customerData = await lookupCustomer(testEmail);

    if (customerData) {
      console.log('✅ Customer found!');
      console.log('');
      console.log('Customer Data:');
      console.log('  Name:', customerData.firstName, customerData.lastName);
      console.log('  Email:', customerData.email);
      console.log('  Tier:', customerData.tier);
      console.log('  Lifetime Value: $' + (customerData.lifetimeValue || 0).toFixed(2));
      console.log('  Order Count:', customerData.orderCount || 0);
      console.log('  VIP Status:', customerData.isVIP ? 'Yes' : 'No');
      console.log('  Lightspeed ID:', customerData.lightspeedCustomerId);
      console.log('');
      console.log('Full object:', JSON.stringify(customerData, null, 2));
    } else {
      console.log('❌ No customer data found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('');
    console.error('Error details:', (error as Error).message);
    console.error('Stack:', (error as Error).stack);
  }
}

test();
