# Complete Solution for Real-Time Customer Database

## The Problem

- eCom orders take **months** to sync to Retail X-Series API
- We need **real-time, accurate** customer database for GreenLoop
- Waiting for sync defeats the purpose
- Can't create custom apps in eCom to access API directly

## The Solution: Multi-Layered Approach

### Layer 1: Webhooks (Real-Time Notifications) ⭐ PRIMARY

**What it does:**
- Gets **instant notification** when eCom orders sync to Retail API
- No waiting, no polling - real-time updates

**Setup:**
1. Go to: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`
2. Create webhook: Event `sale.created`, URL: `https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created`
3. Backend receives notification → fetches order → updates analytics

**Benefits:**
- ✅ Real-time (as soon as order syncs)
- ✅ Efficient (only processes new orders)
- ✅ Automatic (no manual work)

### Layer 2: Manual CSV Export (Complete Historical Data) ⭐ IMMEDIATE

**What it does:**
- Export all orders from eCom dashboard NOW
- Import into customer analytics
- Get complete picture immediately

**Steps:**
1. eCom Admin → My Sales → Orders
2. Export to CSV
3. Run: `npx tsx scripts/importEcomCSV.ts`
4. Merges with Retail API data

**Benefits:**
- ✅ Complete data NOW (no waiting)
- ✅ Fills gaps from slow sync
- ✅ One-time or periodic export

### Layer 3: Weekly Analytics Script (Bulk Updates)

**What it does:**
- Runs `analyzeCustomerMetrics.ts` weekly
- Catches all orders that have synced
- Updates customer database incrementally

**Benefits:**
- ✅ Catches synced orders
- ✅ Automated
- ✅ Keeps database current

### Layer 4: eCom Order Identification (Already Implemented)

**What it does:**
- Identifies eCom orders in Retail API by:
  - `source` field starting with `"ecw:"`
  - Using "Online Register"
  - Notes containing "Order ID:"

**Benefits:**
- ✅ Knows which orders are eCom vs Retail
- ✅ Tracks separately
- ✅ Accurate analytics

## Implementation Status

### ✅ Completed

1. **Updated `analyzeCustomerMetrics.ts`:**
   - Uses correct endpoint (`/search?type=sales&customer_id=...`)
   - Identifies eCom orders
   - Tracks eCom vs Retail separately
   - Deduplicates customers
   - Can reuse existing customer data

2. **Created webhook endpoint:**
   - `backend/hono.ts` - `/api/webhooks/lightspeed/sale-created`
   - Ready to receive notifications

3. **Created CSV import script:**
   - `scripts/importEcomCSV.ts`
   - Merges eCom CSV with Retail data

4. **Documentation:**
   - Webhook setup guide
   - Alternative access methods
   - Complete solution summary

### 🔄 To Do

1. **Set up webhook in Lightspeed dashboard:**
   - Go to: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`
   - Create webhook pointing to your backend

2. **Export eCom orders CSV:**
   - One-time export for complete historical data
   - Run import script

3. **Schedule weekly analytics:**
   - Set up cron job or scheduled task
   - Runs `analyzeCustomerMetrics.ts --reuse-customers` weekly

4. **Enhance webhook processing:**
   - Add customer analytics update logic
   - Trigger app notifications if needed

## How It Works Together

```
┌─────────────────────────────────────────────────────────┐
│                    ECOM ORDERS                          │
│  (Website orders - slow to sync)                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Syncs (slowly, but eventually)
                   ▼
┌─────────────────────────────────────────────────────────┐
│              RETAIL X-SERIES API                        │
│  (All orders - POS + synced eCom)                      │
└──────┬──────────────────────────────┬──────────────────┘
       │                               │
       │                               │
       ▼                               ▼
┌──────────────┐              ┌──────────────────┐
│  WEBHOOK     │              │  ANALYTICS SCRIPT │
│  (Real-time) │              │  (Weekly bulk)    │
└──────┬───────┘              └────────┬─────────┘
       │                               │
       │                               │
       └───────────────┬───────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  CUSTOMER DATABASE   │
            │  (Complete & Current)│
            └──────────────────────┘
```

## Quick Start

### Today (5 minutes):

1. **Export eCom CSV:**
   - eCom Admin → My Sales → Orders → Export
   - Save as `ecom_orders_export.csv`

2. **Import CSV:**
   ```bash
   npx tsx scripts/importEcomCSV.ts
   ```

3. **Get complete data NOW** ✅

### This Week:

1. **Set up webhook:**
   - Follow `docs/WEBHOOK_SETUP_GUIDE.md`
   - Get real-time notifications

2. **Run analytics script:**
   ```bash
   npx tsx scripts/analyzeCustomerMetrics.ts --reuse-customers
   ```

### Ongoing:

- Webhooks catch new orders automatically
- Weekly script keeps database current
- Periodic CSV exports verify completeness

## Result

✅ **Real-time data** - Webhooks notify as orders sync
✅ **Complete data** - CSV export fills historical gaps  
✅ **Accurate analytics** - Combined eCom + Retail data
✅ **No waiting** - Get data NOW, not months later

This gives you the best of both worlds: immediate access to complete data + real-time updates going forward.
