# Ecwid API Findings - greenhauscc.com

## ✅ Platform Identified

**Your website uses: ECWID** (not Lightspeed e-Commerce)

## 🔍 Evidence Found

### From Network Requests:
1. **Ecwid Script**: `https://app.ecwid.com/script.js?86917525`
2. **Ecwid API Calls**: 
   - `https://us-vir2-storefront-api.ecwid.com/storefront/api/v1/86917525/bootstrap`
   - `https://us-vir2-storefront-api.ecwid.com/storefront/api/v1/86917525/initial-data`
3. **Store ID**: `86917525` (visible in all API URLs)

### Console Messages:
- Ecwid development logs detected
- Storefront API calls to Ecwid servers

## 📋 What You Need

### Store ID
✅ **Found**: `86917525`

### API Token
❌ **Need to get**: Ecwid API Token

## 🔑 How to Get Your Ecwid API Token

### Step 1: Log into Ecwid Admin
1. Go to: https://my.ecwid.com
2. Sign in with your Ecwid account credentials

### Step 2: Navigate to My Apps
1. Once logged in, go to: **My Apps** (in the left sidebar or top menu)
2. If you don't have an app yet, you'll need to create one:
   - Click **"Create App"** or **"Add App"**
   - Give it a name (e.g., "GreenLoop Integration")
   - Select app type: **"Custom App"** or **"API Access"**

### Step 3: Get Your Access Token
1. Open your app details
2. Go to the **"Access Tokens"** or **"API Settings"** section
3. You'll see:
   - **Secret Token**: Full API access (use this for backend)
   - **Public Token**: Limited public access (for client-side)
4. **Copy the Secret Token** - this is what you need!

### Step 4: Find Store ID (if needed)
- Your Store ID is: **86917525** (already found)
- But you can also find it at the bottom of any Ecwid admin page

## 🔧 API Configuration

### Ecwid API v3 Base URL
```
https://app.ecwid.com/api/v3
```

### API Endpoints You'll Use

#### Store Profile
```
GET https://app.ecwid.com/api/v3/86917525/profile
Authorization: Bearer {your_secret_token}
```

#### Products
```
GET https://app.ecwid.com/api/v3/86917525/products
Authorization: Bearer {your_secret_token}
```

#### Orders
```
GET https://app.ecwid.com/api/v3/86917525/orders
Authorization: Bearer {your_secret_token}
```

#### Categories
```
GET https://app.ecwid.com/api/v3/86917525/categories
Authorization: Bearer {your_secret_token}
```

## 📝 Environment Variables

Once you have your Ecwid API token, update your `.env` file:

```env
# Ecwid API Configuration
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_ecwid_secret_token_here
EXPO_PUBLIC_LIGHTSPEED_STORE_ID=86917525
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
```

**Note**: The variable names still say "LIGHTSPEED" but they're actually for Ecwid. You can rename them later if you want.

## ✅ Test Your API

Once you have the token, run:
```bash
npx tsx scripts/testLightspeedAPI.ts
```

The script will test:
- Store profile
- Products list
- Categories list

## 🎯 Summary

- **Platform**: Ecwid ✅
- **Store ID**: 86917525 ✅
- **API Token**: Need to get from Ecwid admin ❌
- **API Base**: `https://app.ecwid.com/api/v3` ✅

## 📚 Resources

- [Ecwid API Documentation](https://docs.ecwid.com/api-reference/)
- [Ecwid App Settings (How to Get Tokens)](https://docs.ecwid.com/develop-apps/app-settings)
- [Ecwid API Authentication](https://docs.ecwid.com/get-started/make-your-first-api-request)

## ⚠️ Important Notes

1. **The token you have (`lsxs_pt_...`) is for Lightspeed Retail POS**, not Ecwid
2. **You need a separate Ecwid API token** for your website
3. **For full integration**, you might want both:
   - Ecwid token (for website data)
   - Lightspeed Retail token (for physical store data, if needed)

## 🚀 Next Steps

1. ✅ Log into Ecwid admin panel
2. ✅ Go to My Apps
3. ✅ Create/get app and copy Secret Token
4. ✅ Update `.env` with token
5. ✅ Run test script
6. ✅ Start building your integration!
