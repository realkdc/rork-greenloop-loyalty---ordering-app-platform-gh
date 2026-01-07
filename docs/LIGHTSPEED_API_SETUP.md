# Lightspeed Retail (X-Series) API Setup Guide

**⚠️ THIS WAS A PAIN TO FIGURE OUT - READ CAREFULLY**

## What We Figured Out

GreenHaus uses **Lightspeed Retail (X-Series)** - this is their **POS system**, NOT their e-commerce platform.

- **Retail URL**: `https://greenhauscannabisco.retail.lightspeed.app`
- **E-commerce URL**: `https://my.business.shop` (E-Series - different system)
- **Public Website**: `https://greenhauscc.com` (uses Ecwid Store ID: 86917525)

These are **THREE SEPARATE SYSTEMS** that need separate API credentials.

---

## Critical Information

### API Configuration

```bash
# Domain Prefix (subdomain before .retail.lightspeed.app)
DOMAIN_PREFIX=greenhauscannabisco

# API Base URL
API_BASE=https://greenhauscannabisco.retail.lightspeed.app/api/2.0

# Personal Token (from Retail dashboard)
# ⚠️ NEVER commit tokens to git! Use environment variables or GitHub Secrets
TOKEN=your_token_here

# Authentication
HEADER=Authorization: Bearer {TOKEN}
```

### What Works

| Endpoint | Data Available | Example |
|----------|---------------|---------|
| `/retailer` | Store info, loyalty settings, timezone | Store name: "GreenHaus JS LLC" |
| `/products` | Products, variants, images, pricing | Gift Cards, inventory items |
| `/customers` | Customer database, loyalty balances | Walk-in customers, loyalty members |
| `/sales` | Orders, transactions, line items | Completed sales, returns |
| `/outlets` | Store locations | Crossville, Cookeville |
| `/registers` | POS registers | Online Register, main |
| `/inventory` | Stock levels per outlet | Real-time inventory |
| `/consignments` | Purchase orders | Incoming stock |

---

## Setup Process (What We Had to Do)

### Step 1: Find the Domain Prefix

The domain prefix is the subdomain in your Lightspeed Retail URL:

```
https://greenhauscannabisco.retail.lightspeed.app
         ^^^^^^^^^^^^^^^^^^
         This is your domain prefix
```

**How to find it:**
1. Log into Lightspeed Retail (X-Series)
2. Look at the URL in your browser
3. Everything before `.retail.lightspeed.app` is your domain prefix

### Step 2: Verify You're on Plus Plan

**CRITICAL**: Personal tokens ONLY work on the **Plus plan**.

Check your plan:
1. Go to: **Billing** in left sidebar
2. Look for "Plus plan" in the licenses section
3. If you're NOT on Plus, you'll need to:
   - Upgrade to Plus, OR
   - Use OAuth instead (more complex)

### Step 3: Generate Personal Token

**THIS IS THE TRICKY PART:**

1. Log into: `https://greenhauscannabisco.retail.lightspeed.app`
2. Go to: **Setup → Personal Tokens**
3. Click: **"Add personal token"**
4. Enter a name: e.g., "GreenLoop App API"
5. **Set NO EXPIRY DATE** (uncheck the expiry checkbox)
6. Click: **"Generate personal token"**
7. **⚠️ COPY THE FULL TOKEN IMMEDIATELY** - you'll never see it again!

**Token format:** `lsxs_pt_XXXXXXXXXXXXXXXXXXXXXXXXXX` (40 characters)

### Step 4: Test the Token

Run our test script:

```bash
npx tsx scripts/testLightspeedAPI.ts
```

**If you get "access token is not valid":**
- Delete the token in the dashboard
- Create a NEW one
- The token must be created while logged into the CORRECT domain
- Old tokens may become invalid even if they show in the dashboard

---

## Real Data Examples

### Retailer Info
```json
{
  "name": "GreenHaus JS LLC",
  "domain_prefix": "greenhauscannabisco",
  "store_url": "https://greenhauscannabisco.retail.lightspeed.app",
  "loyalty": {
    "enabled": true,
    "ratio": 0.03,
    "signup_bonus": "5.00000"
  },
  "timezone": "America/Chicago",
  "currency": { "code": "USD", "symbol": "$" }
}
```

### Products
```json
{
  "id": "0ac98a3b-571f-11ed-e863-e0c6497377aa",
  "name": "Gift Card",
  "sku": "vend-internal-gift-card",
  "active": true,
  "supply_price": 0,
  "image_url": "https://vendimageuploadcdn.global.ssl.fastly.net/..."
}
```

### Store Outlets
```json
[
  {
    "id": "06819b3a-2e91-11ed-f9a0-c4d550292f42",
    "name": "GreenHaus Cannabis Co-Crossville",
    "physical_address_1": "750 US Hwy 70 E, Suite 106",
    "physical_city": "Crossville",
    "physical_state": "US-TN",
    "physical_postcode": "38555",
    "latitude": "36.1446857",
    "longitude": "-85.5244405",
    "email": "greenhauscc@gmail.com",
    "phone": "9313370880"
  },
  {
    "name": "GreenHaus Cannabis Co-Cookeville",
    ...
  }
]
```

### Sales/Orders
```json
{
  "id": "b98cca69-0167-8c24-11ed-dec6bec3db62",
  "invoice_number": "1",
  "status": "CLOSED",
  "total_loyalty": 0,
  "sale_date": "2023-04-20T16:09:16+00:00",
  "line_items": [
    {
      "product_id": "06819b3a-2e1f-11ed-f9a0-c4d550d00569",
      "quantity": 1,
      "price": 1,
      "tax": 0.0975
    }
  ]
}
```

---

## Common Errors & Solutions

### Error: "access token is not valid"

**Causes:**
1. Token created on wrong account/domain
2. Token expired (check expiry date)
3. Account not on Plus plan
4. Token needs regeneration

**Solution:**
1. Delete existing token in dashboard
2. Create a NEW token (follow Step 3 above)
3. Update `.env` immediately
4. Test with `npx tsx scripts/testLightspeedAPI.ts`

### Error: 404 Not Found

**Cause:** Wrong domain prefix

**Solution:**
- Check the URL when logged into Lightspeed
- Update `EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX` in `.env`

### Error: 403 Forbidden

**Cause:** Not on Plus plan

**Solution:**
- Check billing page
- Upgrade to Plus plan
- Or use OAuth (more complex setup)

---

## Environment Variables

Add these to your `.env` file:

```bash
# LightSpeed Retail (X-Series) API Configuration
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_token_here  # ⚠️ Never commit real tokens to git!
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://greenhauscannabisco.retail.lightspeed.app/api/2.0

# OAuth Credentials (if needed for multi-store apps)
EXPO_PUBLIC_LIGHTSPEED_CLIENT_ID=pRBGpqlZ02WrBGkPNa4bSWQIK8hDIXMp
EXPO_PUBLIC_LIGHTSPEED_CLIENT_SECRET=vpLlo8tMurLHyzSQun1tUH7zjN6R0Xc5
```

---

## API Documentation

**Official Docs:**
- [Lightspeed X-Series API](https://x-series-api.lightspeedhq.com/docs/introduction)
- [Authorization Guide](https://x-series-api.lightspeedhq.com/docs/authorization)
- [Quick Start](https://x-series-api.lightspeedhq.com/docs/quick_start)

**Support:**
- Email: x-series.api@lightspeedhq.com

---

## Next Steps

Now that the API is working, you can:

1. **Create a Lightspeed service** (`services/lightspeed.ts`)
2. **Sync products** to the app
3. **Pull customer loyalty data**
4. **Display real-time inventory**
5. **Show sales history**

See: `services/lightspeed.ts` (to be created)

---

## Notes

- **Personal tokens** are for single-store use only
- For multi-store apps, use **OAuth** instead
- Tokens don't expire unless you set an expiry date
- Keep tokens secure - they have full API access
- The API is rate-limited (check headers for limits)

---

**Last Updated:** January 5, 2026
**Token Last Regenerated:** January 5, 2026
**Tested By:** KeShaun (keenerjess1990@gmail.com)
