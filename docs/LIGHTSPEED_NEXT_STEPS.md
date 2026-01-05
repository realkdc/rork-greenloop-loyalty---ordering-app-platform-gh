# Lightspeed API - Next Steps

## ✅ What You Just Did

You created a Lightspeed OAuth application and got:
- **Client ID**: `pRBGpqlZ02WrBGkPNa4bSWQIK8hDIXMp`
- **Client Secret**: `vpLlo8tMurLHyzSQun1tUH7zjN6R0Xc5`

These are stored in your `.env` file.

## 🎯 What to Do Next

### Step 1: Understand What You Have

You now have **TWO different types of credentials**:

1. **OAuth Credentials** (just created):
   - Client ID & Secret
   - Used for OAuth flow (user authorization)
   - Good for multi-store access

2. **Personal Token** (you already had):
   - `lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9`
   - Direct API access (no OAuth needed)
   - Simpler for single-store access

### Step 2: Determine Which API to Use

Your website (`greenhauscc.com`) uses:
- **Lightspeed Retail** channel
- **Ecwid infrastructure** (`vuega.ecwid.com`)
- **Store ID**: `86917525`

You need to test which API works:

#### Option A: Ecwid API (since infrastructure is Ecwid)
- Base URL: `https://app.ecwid.com/api/v3`
- Use OAuth credentials OR Personal Token
- Store ID: `86917525`

#### Option B: Lightspeed Retail API
- Base URL: `https://{store}.retail.lightspeed.app/api/2.0/`
- Use Personal Token
- Need store subdomain

### Step 3: Test the API

Run the test script:
```bash
npx tsx scripts/testLightspeedAPI.ts
```

This will test:
- Ecwid API with your credentials
- Lightspeed Retail API
- Lightspeed eCom API

### Step 4: Use OAuth Flow (If Needed)

If you need OAuth flow (for user authorization):

1. **Get Authorization Code**:
   ```
   https://api.lsk.lightspeed.app/oauth/authorize?
     client_id=pRBGpqlZ02WrBGkPNa4bSWQIK8hDIXMp&
     redirect_uri=https://greenhaus-admin.vercel.app/api/auth/callback&
     response_type=code&
     scope=read_products read_orders
   ```

2. **Exchange Code for Access Token**:
   ```bash
   POST https://api.lsk.lightspeed.app/oauth/token
   {
     "grant_type": "authorization_code",
     "code": "{authorization_code}",
     "redirect_uri": "https://greenhaus-admin.vercel.app/api/auth/callback",
     "client_id": "pRBGpqlZ02WrBGkPNa4bSWQIK8hDIXMp",
     "client_secret": "vpLlo8tMurLHyzSQun1tUH7zjN6R0Xc5"
   }
   ```

3. **Use Access Token** for API calls

### Step 5: Or Use Personal Token Directly (Simpler)

Since you have a Personal Token, you might be able to use it directly:

```bash
# Test with Personal Token
curl -X GET \
  "https://app.ecwid.com/api/v3/86917525/profile" \
  -H "Authorization: Bearer lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9"
```

## 🚀 Quick Start

1. **Test the API**:
   ```bash
   npx tsx scripts/testLightspeedAPI.ts
   ```

2. **Check the results** - it will tell you which API works

3. **Update your backend** (`backend/hono.ts`) to use the working API

4. **Build your integration**:
   - Products endpoint
   - Orders endpoint
   - Analytics
   - Promos

## 📝 Important Notes

- **OAuth credentials** are for user authorization flows
- **Personal Token** is for direct API access
- Your website uses **Ecwid infrastructure**, so Ecwid API might work
- Store ID is: **86917525**

## 🔗 Resources

- [Lightspeed Retail API Docs](https://x-series-api.lightspeedhq.com/docs/)
- [Ecwid API Docs](https://docs.ecwid.com/api-reference/)
- [OAuth Flow Guide](https://x-series-api.lightspeedhq.com/docs/authorization)
