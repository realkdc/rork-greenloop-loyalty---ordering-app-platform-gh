# eCom API Integration Plan

## Problem

- eCom orders take too long to sync to Retail X-Series API
- Orders from Nov/Dec 2025 still not showing in Retail API
- Need real-time access to online orders

## Solution

Pull orders from **both** APIs and merge:
1. **Retail X-Series API** - For POS/in-store orders
2. **eCom E-Series API** - For online/website orders

## Implementation Steps

### Phase 1: Get eCom API Access ✅ (User needs to do this)

1. Log into Lightspeed Retail POS
2. Navigate to eCom Admin Panel
3. Create app in Apps > My Apps
4. Get Secret Token
5. Add to `.env`:
   ```env
   EXPO_PUBLIC_ECOM_TOKEN=your_secret_token
   EXPO_PUBLIC_ECOM_STORE_ID=your_store_id_if_needed
   EXPO_PUBLIC_ECOM_API_BASE=https://api.lightspeedhq.com/ecom/e-series
   ```

### Phase 2: Test eCom API

Run test script:
```bash
npx tsx scripts/testEcomAPI.ts
```

This will:
- Test API connection
- Find correct API base URL
- Test order retrieval
- Test email-based order search

### Phase 3: Update Customer Analytics Script

Modify `scripts/analyzeCustomerMetrics.ts` to:

1. **Fetch from both APIs:**
   - Retail API: `/search?type=sales&customer_id=...`
   - eCom API: `/orders?email=...` or similar

2. **Merge orders:**
   - Combine orders from both sources
   - Deduplicate by order number/receipt
   - Calculate metrics from combined data

3. **Mark source:**
   - Add field: `orderSource: 'retail' | 'ecom'`
   - Helps identify where each order came from

### Phase 4: Update App Order History

Modify `lib/lightspeedClient.ts`:

1. **Add eCom API client:**
   ```typescript
   export async function getEcomOrders(customerEmail: string) {
     // Fetch from eCom API
   }
   ```

2. **Update `getCustomerSales()`:**
   - Fetch from Retail API (existing)
   - Fetch from eCom API (new)
   - Merge and return combined list

## Benefits

✅ **Real-time data** - No waiting for sync
✅ **Complete order history** - All orders (POS + online)
✅ **Accurate analytics** - Full customer picture
✅ **Better customer experience** - Users see all their orders

## API Endpoints to Test

Based on Lightspeed eCom API docs, try:
- `GET /orders` - List all orders
- `GET /orders?email={email}` - Search by email
- `GET /orders/{orderId}` - Get specific order
- `GET /customers` - List customers
- `GET /customers?email={email}` - Search customer by email

## Notes

- eCom API might use different authentication
- May need OAuth instead of simple token
- Rate limits might be different
- Order structure might differ from Retail API

## Documentation

- eCom API: https://developers.lightspeedhq.com/ecom/e-series/
- Support: Check Lightspeed support for eCom API access
