# Lightspeed Webhook Setup Guide

## Why Webhooks?

Since eCom orders sync slowly to Retail API, webhooks give us **real-time notifications** when orders finally sync. This way we don't have to wait months or constantly poll the API.

## Setup Steps

### Step 1: Access Webhook Configuration

1. **Log into Lightspeed Retail POS:**
   - URL: `https://greenhauscannabisco.retail.lightspeed.app`

2. **Navigate to API Setup:**
   - Go to: **Setup → API**
   - OR directly: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`

### Step 2: Create Webhook

1. **Click "Add Webhook" or "Create Webhook"**

2. **Configure Webhook:**
   - **Event Type:** **`sale.update`** ⭐ (This is the correct event type)
     - Fires when sales are created OR updated
     - Catches eCom orders when they sync to Retail
     - Also fires for regular POS sales
   - **URL:** `https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created`
   - **Method:** POST
   - **Active:** ✅ Enabled

3. **Save Webhook**

### Step 3: Test Webhook

The webhook will send a POST request to your backend when:
- A new sale is created in Retail POS
- An eCom order syncs to Retail POS
- A sale is updated

**Webhook Payload Example:**
```json
{
  "type": "sale.created",
  "data": {
    "id": "sale-id-here",
    "customer_id": "customer-id-here",
    "receipt_number": "2030",
    "created_at": "2025-11-16T18:49:31+00:00"
  }
}
```

### Step 4: Backend Processing

The webhook endpoint (`backend/trpc/routes/webhooks/lightspeed/route.ts`) will:
1. Receive the notification
2. Fetch full sale details from Retail API
3. Check if it's an eCom order (by `source` field)
4. Update customer analytics
5. Trigger app notification if needed

## Benefits

✅ **Real-time updates** - Get notified as soon as orders sync
✅ **No polling** - Don't need to constantly check API
✅ **Efficient** - Only process new orders
✅ **Catches delayed syncs** - Even if sync takes months, you'll know when it happens

## Testing

1. **Create a test sale** in Retail POS
2. **Check backend logs** for webhook notification
3. **Verify** customer analytics updated

## Troubleshooting

**Webhook not firing?**
- Check webhook is active in Lightspeed dashboard
- Verify backend URL is accessible
- Check backend logs for errors

**Webhook firing but not processing?**
- Check backend endpoint is correct
- Verify API token has permissions
- Check error logs

## Next Steps

Once webhooks are set up:
1. Webhooks catch orders as they sync
2. Run analytics script weekly for bulk updates
3. Manual CSV export for complete historical data
4. Combined = real-time + complete data
