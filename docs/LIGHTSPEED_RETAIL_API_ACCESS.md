# Lightspeed Retail API Access - greenhauscc.com

## ✅ Platform Confirmed

**Your website IS Lightspeed Retail!**

From the page source:
- **Channel**: `lightspeed_retail`
- **Plan**: `LIGHTSPEED_RETAIL_BUSINESS`
- **Site ID**: `86917525`
- **Service URL**: `https://vuega.ecwid.com` (Ecwid infrastructure)

## 🔍 What This Means

Your website is **Lightspeed Retail e-commerce**, but it's **powered by Ecwid's infrastructure**. This is why you see both:
- Lightspeed branding and channel
- Ecwid API calls in the network

## 🔑 API Access - Where to Get It

### Option 1: Lightspeed Retail Admin Panel

1. **Log into Lightspeed Retail Admin**
   - Go to your Lightspeed Retail dashboard
   - This is where you manage your POS system

2. **Navigate to API Settings**
   - Go to: **Settings** > **Store Settings** > **Developers**
   - OR
   - Look for **"API"** or **"Developers"** in the menu

3. **Create API Key**
   - Click **"New API Key"**
   - Name it (e.g., "GreenLoop Integration")
   - Enable it
   - Set permissions (Products, Orders, etc.)
   - Copy the **API Key** and **API Secret**

### Option 2: Ecwid Admin (Since it uses Ecwid infrastructure)

Since your site uses Ecwid's infrastructure (`vuega.ecwid.com`), you might also be able to access it through:

1. **Log into Ecwid Admin**
   - Go to: https://my.ecwid.com
   - Use your Lightspeed Retail account (might be linked)

2. **My Apps Section**
   - Go to: **My Apps**
   - Look for your store or create an app
   - Get **Access Token**

## 📋 What You Have vs What You Need

### ✅ What You Have:
- **Token**: `lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9`
- **Type**: Lightspeed Retail (X-Series) Personal Token
- **Purpose**: POS system API access

### ❌ What You Need:
- **API Key/Token**: For e-commerce website API
- **Store ID**: `86917525` (already found!)
- **API Base URL**: Need to determine (likely Ecwid API since infrastructure is Ecwid)

## 🎯 Next Steps

1. **Log into Lightspeed Retail Admin Dashboard**
2. **Find the API/Developers section**
3. **Create API credentials for e-commerce**
4. **Test with the API**

## 🔗 API Documentation

- **Lightspeed Retail API**: https://x-series-api.lightspeedhq.com/docs/
- **Ecwid API** (since infrastructure): https://docs.ecwid.com/api-reference/

## 💡 Important Note

Your site uses **Lightspeed Retail** but the **backend infrastructure is Ecwid**. This means:
- You might need **Ecwid API token** to access the website data
- OR Lightspeed Retail might have its own e-commerce API endpoint
- The token you have (`lsxs_pt_`) is for POS, not e-commerce

## 🚀 Test Once You Have Token

Update `.env`:
```env
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_new_token_here
EXPO_PUBLIC_LIGHTSPEED_STORE_ID=86917525
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
```

Then run:
```bash
npx tsx scripts/testLightspeedAPI.ts
```
