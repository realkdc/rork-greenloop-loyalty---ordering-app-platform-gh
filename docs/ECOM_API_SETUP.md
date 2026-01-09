# Lightspeed eCom (E-Series) API Setup Guide

## Why We Need This

The sync from eCom to Retail X-Series is too slow (orders from a month ago still not synced). We need to pull orders directly from eCom API to get real-time data.

## How to Get eCom API Credentials

### Step 1: Access eCom Admin Panel

1. **Log into Lightspeed Retail POS** (X-Series)
   - URL: `https://greenhauscannabisco.retail.lightspeed.app`

2. **Navigate to eCom (E-Series)**
   - From the main menu, select **Retail (R-Series)**
   - Then choose **eCom (E-Series)**
   - This opens the eCom Admin Panel in a new browser tab
   - URL should be: `https://my.business.shop` or similar

### Step 2: Create an App

1. **Go to Apps Section**
   - In eCom Admin Panel, navigate to: **Apps** > **My Apps**

2. **Create New App**
   - Click **"Add new app"**
   - Provide a name: e.g., "GreenLoop Customer Analytics"
   - Complete any required fields
   - Click **Save**

### Step 3: Get API Credentials

1. **View App Details**
   - Click **"Details"** next to your app's name

2. **Retrieve Tokens**
   - On the app's details page, you'll find:
     - **Public Token**: For public data access
     - **Secret Token**: For full API access (use this one)
   - **⚠️ COPY THESE IMMEDIATELY** - you may not see them again!

3. **Set Permissions**
   - Within the app's details page, configure permissions:
     - ✅ Orders (read)
     - ✅ Customers (read)
     - ✅ Products (read) - if needed
   - Save permissions

### Step 4: Get Store/Account ID

The eCom API might need a store ID or account ID. Check:
- The eCom Admin Panel URL
- Settings > Store Settings
- Or the API documentation

## API Documentation

**Official eCom (E-Series) API Docs:**
- https://developers.lightspeedhq.com/ecom/e-series/

## Environment Variables

Once you have the credentials, add to `.env`:

```env
# Lightspeed eCom (E-Series) API
EXPO_PUBLIC_ECOM_TOKEN=your_secret_token_here
EXPO_PUBLIC_ECOM_STORE_ID=your_store_id_if_needed
EXPO_PUBLIC_ECOM_API_BASE=https://api.lightspeedhq.com/ecom/e-series
```

## Testing

Once you have the token, we'll create a test script to verify access.

## Next Steps

1. Get the eCom API token (follow steps above)
2. Test the API connection
3. Update customer analytics script to pull from both:
   - Retail X-Series API (for POS orders)
   - eCom E-Series API (for online orders)
4. Merge the data for complete customer history

---

**Note:** The eCom API is separate from Retail API. You'll need both tokens to get complete order history.
