# Real-Time Order Data Solution

## Problem

- eCom orders take **months** to sync to Retail X-Series API
- We need **real-time, accurate** customer database
- Waiting for sync defeats the purpose of GreenLoop
- Can't create custom apps in eCom to access API directly

## Solution Options

### Option 1: Webhooks (Real-Time Notifications) ⭐ RECOMMENDED

Set up webhooks to get **instant notifications** when orders sync (even if delayed):

**Setup:**
1. Go to: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`
2. Create webhook for event: `sale.created`
3. Point to your backend endpoint
4. When eCom order syncs → webhook fires → fetch full order details immediately

**Benefits:**
- Get orders as soon as they sync (no polling)
- Real-time updates
- Can trigger customer analytics refresh
- Works with existing Retail API

**Implementation:**
- Backend endpoint receives webhook
- Fetches full sale details from Retail API
- Updates customer analytics
- Triggers app notification if needed

### Option 2: Manual CSV Export from eCom Dashboard

Since eCom dashboard shows all orders, we can:

1. **Export Orders from eCom:**
   - Go to eCom Admin → My Sales → Orders
   - Use export feature (if available)
   - Get CSV with all eCom orders

2. **Merge with Retail Data:**
   - Run customer analytics script (gets Retail orders)
   - Import eCom CSV
   - Merge by customer email/phone
   - Create combined database

**Limitations:**
- Manual process (not automated)
- Need to export regularly
- But gives you complete data NOW

### Option 3: Poll Retail API More Aggressively

Since orders DO sync (just slowly), we can:

1. **Run Analytics Script More Frequently:**
   - Daily or weekly runs
   - Catch orders as they sync
   - Update customer database incrementally

2. **Track Last Sync Time:**
   - Store timestamp of last run
   - Only process new orders since last run
   - Faster subsequent runs

### Option 4: Hybrid Approach (Best of Both)

**For Real-Time Needs:**
- Use webhooks for immediate notifications
- Update customer records as orders sync

**For Complete Historical Data:**
- Manual eCom CSV export (one-time or periodic)
- Merge with Retail API data
- Create master customer database

**For Ongoing:**
- Run analytics script weekly
- Webhooks catch new orders
- CSV export for verification

## Recommended Implementation

### Phase 1: Immediate (This Week)

1. **Set Up Webhook:**
   ```bash
   # Backend endpoint: /api/webhooks/lightspeed-sale-created
   # Event: sale.created
   # Action: Fetch sale details, update customer analytics
   ```

2. **Manual eCom Export:**
   - Export all orders from eCom dashboard
   - Import into customer analytics
   - Get complete picture NOW

### Phase 2: Short Term (This Month)

1. **Automated Weekly Runs:**
   - Schedule `analyzeCustomerMetrics.ts` to run weekly
   - Catches synced orders
   - Updates database incrementally

2. **Webhook Processing:**
   - Process webhook notifications
   - Real-time updates for new orders

### Phase 3: Long Term (Ongoing)

1. **Periodic eCom Exports:**
   - Monthly CSV export from eCom
   - Verify completeness
   - Fill any gaps

2. **Monitoring:**
   - Track sync delays
   - Alert if orders missing after X days
   - Manual intervention if needed

## Code Changes Needed

### 1. Webhook Endpoint (Backend)

```typescript
// backend/hono.ts or backend/trpc/routes/webhooks/route.ts
export async function handleLightspeedWebhook(event: any) {
  if (event.type === 'sale.created') {
    const saleId = event.data.id;
    // Fetch full sale details
    // Update customer analytics
    // Trigger app notification if needed
  }
}
```

### 2. CSV Import Script

```typescript
// scripts/importEcomOrders.ts
// Reads eCom CSV export
// Merges with existing customer data
// Updates analytics
```

### 3. Scheduled Analytics

```typescript
// scripts/scheduledAnalytics.ts
// Runs weekly
// Only processes new orders since last run
// Updates customer database
```

## Benefits

✅ **Real-time data** - Webhooks catch orders as they sync
✅ **Complete data** - CSV export fills gaps
✅ **Accurate analytics** - Combined eCom + Retail data
✅ **No waiting** - Get data NOW, not months later

## Next Steps

1. **Set up webhook** (5 minutes)
2. **Export eCom CSV** (manual, but immediate)
3. **Create import script** (30 minutes)
4. **Schedule weekly runs** (automated)

This gives you the best of both worlds: real-time updates + complete historical data.
