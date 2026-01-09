#!/usr/bin/env node
/**
 * Test Lightspeed Retail (X-Series) API Customer Groups
 * 
 * Tests:
 * 1. Reading customer groups
 * 2. Reading a specific customer's group assignment
 * 3. Attempting to update a customer's group (if supported)
 * 
 * Usage: npx tsx scripts/testCustomerGroups.ts
 */

import 'dotenv/config';

const TOKEN = process.env.EXPO_PUBLIC_LIGHTSPEED_TOKEN || '';
const DOMAIN_PREFIX = process.env.EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX || 'greenhauscannabisco';
const API_BASE = `https://${DOMAIN_PREFIX}.retail.lightspeed.app/api/2.0`;

async function apiRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  console.log(`\n📡 ${method} ${url}`);

  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

async function testListCustomerGroups() {
  console.log('\n📋 TEST 1: List All Customer Groups');
  console.log('═'.repeat(60));
  
  try {
    const data = await apiRequest('/customer_groups');
    const groups = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    
    console.log(`\n✅ Found ${groups.length} customer groups:\n`);
    
    groups.forEach((group: any, index: number) => {
      console.log(`${index + 1}. ${group.name || group.group_name || 'Unnamed'}`);
      console.log(`   ID: ${group.id}`);
      console.log(`   Description: ${group.description || 'N/A'}`);
      if (group.customer_count !== undefined) {
        console.log(`   Customer Count: ${group.customer_count}`);
      }
      console.log('');
    });
    
    return groups;
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return [];
  }
}

async function testGetCustomerGroup(groupId: string) {
  console.log('\n📋 TEST 2: Get Specific Customer Group');
  console.log('═'.repeat(60));
  
  try {
    const data = await apiRequest(`/customer_groups/${groupId}`);
    const group = data.data || data;
    
    console.log(`\n✅ Customer Group Details:`);
    console.log(`   Name: ${group.name || group.group_name || 'N/A'}`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Description: ${group.description || 'N/A'}`);
    if (group.customer_count !== undefined) {
      console.log(`   Customer Count: ${group.customer_count}`);
    }
    console.log(`\n   Full Data:`, JSON.stringify(group, null, 2));
    
    return group;
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return null;
  }
}

async function testGetCustomerWithGroup(customerId?: string) {
  console.log('\n👤 TEST 3: Get Customer with Group Assignment');
  console.log('═'.repeat(60));
  
  // If no customer ID provided, get a random customer
  if (!customerId) {
    try {
      const customers = await apiRequest('/search?type=customers&page_size=1');
      const customerList = Array.isArray(customers.data) ? customers.data : [];
      if (customerList.length > 0) {
        customerId = customerList[0].id;
        console.log(`\n   Using customer: ${customerList[0].name || customerList[0].first_name} (${customerId})`);
      }
    } catch (e) {
      console.error(`\n❌ Could not fetch sample customer: ${e}`);
      return;
    }
  }
  
  if (!customerId) {
    console.log('\n⚠️  No customer ID available to test');
    return;
  }
  
  try {
    const data = await apiRequest(`/customers/${customerId}`);
    const customer = data.data || data;
    
    console.log(`\n✅ Customer Details:`);
    console.log(`   Name: ${customer.name || `${customer.first_name} ${customer.last_name}`}`);
    console.log(`   ID: ${customer.id}`);
    console.log(`   Customer Group ID: ${customer.customer_group_id || 'None'}`);
    console.log(`   Customer Group IDs (array): ${JSON.stringify(customer.customer_group_ids || [])}`);
    
    if (customer.customer_group_id) {
      console.log(`\n   Fetching group details...`);
      await testGetCustomerGroup(customer.customer_group_id);
    }
    
    return customer;
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return null;
  }
}

async function testUpdateCustomerGroup(customerId: string, groupId: string) {
  console.log('\n✏️  TEST 4: Attempt to Update Customer Group');
  console.log('═'.repeat(60));
  console.log(`\n   Customer ID: ${customerId}`);
  console.log(`   New Group ID: ${groupId}`);
  
  try {
    // Try PATCH first (most common for updates)
    const data = await apiRequest(`/customers/${customerId}`, 'PATCH', {
      customer_group_id: groupId,
    });
    
    console.log(`\n✅ Successfully updated customer group!`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    console.log(`\n⚠️  PATCH failed: ${error.message}`);
    
    // Try PUT as fallback
    try {
      console.log(`\n   Trying PUT method...`);
      const data = await apiRequest(`/customers/${customerId}`, 'PUT', {
        customer_group_id: groupId,
      });
      
      console.log(`\n✅ Successfully updated customer group with PUT!`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return data;
    } catch (putError: any) {
      console.error(`\n❌ PUT also failed: ${putError.message}`);
      console.log(`\n💡 Customer group updates may not be supported via API, or require different format.`);
      return null;
    }
  }
}

async function main() {
  console.log('🚀 LIGHTSPEED CUSTOMER GROUPS API TEST');
  console.log('═'.repeat(60));
  
  if (!TOKEN) {
    console.log('\n❌ ERROR: No token set in .env!');
    console.log('   Expected: EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...');
    process.exit(1);
  }

  console.log(`🔑 Token: ${TOKEN.substring(0, 8)}...${TOKEN.substring(TOKEN.length - 4)}`);
  console.log(`🌐 Domain: ${DOMAIN_PREFIX}`);
  console.log(`📍 API Base: ${API_BASE}`);

  try {
    // Test 1: List all customer groups
    const groups = await testListCustomerGroups();
    
    if (groups.length > 0) {
      // Test 2: Get details of first group
      await testGetCustomerGroup(groups[0].id);
      
      // Test 3: Get a customer and see their group
      await testGetCustomerWithGroup();
      
      // Test 4: Try to update a customer's group (using a test customer)
      const customerData = await testGetCustomerWithGroup();
      if (customerData && customerData.id && groups.length > 1) {
        // Try moving to a different group (use the second group, not "All Customers")
        const targetGroup = groups.find((g: any) => g.id !== customerData.customer_group_id) || groups[1];
        if (targetGroup) {
          console.log(`\n⚠️  Testing group update - this will change the customer's group!`);
          console.log(`   Current Group: ${customerData.customer_group_id}`);
          console.log(`   Target Group: ${targetGroup.id} (${targetGroup.name})`);
          // Uncomment the next line to actually test the update:
          // await testUpdateCustomerGroup(customerData.id, targetGroup.id);
        }
      }
    }
    
    console.log('\n✅ All tests completed!\n');
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR');
    console.error('═'.repeat(60));
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
