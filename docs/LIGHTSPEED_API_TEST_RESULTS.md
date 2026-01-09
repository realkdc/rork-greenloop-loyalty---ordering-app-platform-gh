# Lightspeed API Test Results

## Test Date
Tested the API token: `lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9`

## Key Finding: Token Type Mismatch

### ✅ Token Identified
- **Token Format**: `lsxs_pt_` 
- **Token Type**: **Lightspeed Retail (X-Series) Personal Token**
- **Purpose**: Point-of-Sale (POS) system API access

### ❌ The Problem
Your token is for **Lightspeed Retail POS**, but your website (`greenhauscc.com`) uses **Lightspeed e-Commerce** (or possibly Ecwid). These are **completely different systems** with different APIs:

1. **Lightspeed Retail (X-Series)** - POS system for physical stores
   - API: `https://{store}.retail.lightspeed.app/api/2.0/`
   - Used for: Inventory, sales, customers in physical stores
   - Token format: `lsxs_pt_...`

2. **Lightspeed e-Commerce (C-Series)** - Online store platform
   - API: `https://api.shoplightspeed.com` (US) or `https://api.webshopapp.com` (EU)
   - Used for: Online products, orders, web store
   - Token format: Different (API keys from back office)

3. **Ecwid** - Alternative e-commerce platform
   - API: `https://app.ecwid.com/api/v3`
   - Used for: Online store (if you're using Ecwid instead)
   - Token format: Different (from My Apps section)

## Test Results

### ❌ Lightspeed Retail API
- **Status**: Cannot test without store subdomain
- **Issue**: Requires `https://{store-name}.retail.lightspeed.app` format
- **Note**: This token is for POS, not e-commerce

### ❌ Lightspeed e-Commerce API  
- **Status**: Failed (404 errors)
- **Issue**: Token doesn't work with e-Commerce API
- **Reason**: Wrong token type (POS token vs e-Commerce token)

### ❌ Ecwid API
- **Status**: Failed (400 Bad Request)
- **Issue**: Token doesn't work with Ecwid API
- **Reason**: Token is for Lightspeed, not Ecwid

## What You Need to Do

### Step 1: Determine Your Platform
Check which platform `greenhauscc.com` actually uses:

1. **Log into your website admin panel**
2. **Check the admin URL and interface**:
   - Lightspeed e-Commerce: Usually `https://yourstore.shoplightspeed.com/admin` or similar
   - Ecwid: Usually `https://my.ecwid.com` or similar
   - Lightspeed Retail: Different admin interface

### Step 2: Get the Correct API Token

#### If Using Lightspeed e-Commerce:
1. Log into **Lightspeed e-Commerce Back Office**
2. Navigate to: **Settings > Store Settings > Developers**
3. Click **"New API key"**
4. Provide a name and save
5. Enable the API key
6. Select necessary permissions
7. Copy the **API key** and **API secret**
8. Get your **Store ID** from: **Help** section (bottom-left of dashboard)

**API Base URLs:**
- US Cluster: `https://api.shoplightspeed.com`
- EU Cluster: `https://api.webshopapp.com`

#### If Using Ecwid:
1. Log into **Ecwid Admin Panel**
2. Navigate to: **My Apps > Your App** (or create one)
3. Go to **Access Tokens** section
4. Copy your **Secret Token** or **Public Token**
5. Get your **Store ID** from bottom of any admin page

**API Base URL:** `https://app.ecwid.com/api/v3`

### Step 3: Update Environment Variables

Once you have the correct token and Store ID, update your `.env` file:

```env
# For Lightspeed e-Commerce
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_ecom_api_key_here
EXPO_PUBLIC_LIGHTSPEED_STORE_ID=your_store_id_here
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://api.shoplightspeed.com

# OR for Ecwid
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_ecwid_token_here
EXPO_PUBLIC_LIGHTSPEED_STORE_ID=your_ecwid_store_id_here
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
```

### Step 4: Test Again

Run the test script:
```bash
npx tsx scripts/testLightspeedAPI.ts
```

## Current Token (What You Have)

- **Type**: Lightspeed Retail (X-Series) Personal Token
- **Format**: `lsxs_pt_...`
- **Use Case**: POS system integration
- **Not Suitable For**: E-commerce API access

If you need to use this token for Lightspeed Retail POS:
- You'll need your store subdomain
- API format: `https://{your-store}.retail.lightspeed.app/api/2.0/`
- Find subdomain in Lightspeed Retail admin: **Setup > Personal Tokens**

## Summary

**The Issue**: You have a Lightspeed Retail POS token, but need either:
- A Lightspeed e-Commerce API token, OR
- An Ecwid API token

**The Solution**: 
1. Identify which platform `greenhauscc.com` uses
2. Get the correct API token for that platform
3. Update `.env` with correct credentials
4. Test again

## References

- [Lightspeed e-Commerce API Docs](https://ecom-support.lightspeedhq.com/hc/en-us/articles/1260804034770-Creating-API-keys)
- [Ecwid API Docs](https://docs.ecwid.com/api-reference/)
- [Lightspeed Retail API Docs](https://x-series-api.lightspeedhq.com/docs/authorization)
- [Research Document](./LIGHTSPEED_API_RESEARCH.md)
