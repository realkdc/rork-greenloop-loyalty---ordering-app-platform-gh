# API Test Status

## Current Situation

✅ **Store ID**: `86917525` (Confirmed)

❌ **API Token**: Personal Token (`lsxs_pt_...`) doesn't work with Ecwid API

## Test Results

- **Ecwid API**: Returns `403 Forbidden` - Token is wrong type
- **Lightspeed eCom API**: Returns `401 Unauthorized` - Token is wrong type  
- **Lightspeed Retail API**: Needs store subdomain

## What You Need

Since your website (`greenhauscc.com`) uses **Ecwid infrastructure** (`vuega.ecwid.com`), you need an **Ecwid API token**.

### How to Get Ecwid API Token:

1. **Option 1: Ecwid Admin Panel**
   - Go to: https://my.ecwid.com
   - Log in (might use your Lightspeed account)
   - Navigate to: **My Apps** → **Your App** (or create one)
   - Get **Access Token** (Secret Token for full API access)

2. **Option 2: Lightspeed Retail Admin**
   - Log into Lightspeed Retail dashboard
   - Look for: **Settings** → **Store Settings** → **Developers**
   - Check if there's an "Ecwid API" or "Website API" section
   - There might be an API token for the website there

3. **Option 3: Check Your Lightspeed Developer Portal**
   - You already created an OAuth app
   - But that's for Lightspeed Retail API, not Ecwid
   - You might need a separate token for Ecwid

## Next Steps

1. **Get Ecwid API Token** from one of the options above
2. **Update `.env`**:
   ```env
   EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_ecwid_token_here
   EXPO_PUBLIC_LIGHTSPEED_STORE_ID=86917525
   EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
   ```
3. **Test again**: `npx tsx scripts/testLightspeedAPI.ts`

## Summary

- ✅ Store ID: `86917525`
- ❌ Need: Ecwid API Token (not Lightspeed Personal Token)
- 🔗 API Base: `https://app.ecwid.com/api/v3`
