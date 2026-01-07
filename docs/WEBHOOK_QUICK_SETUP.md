# Quick Webhook Setup Guide

## Step 1: Access Webhook Settings

Go to: **https://greenhauscannabisco.retail.lightspeed.app/setup/api**

## Step 2: Create Webhook

1. Click **"Add Webhook"** or **"Create Webhook"**

2. **Event Type:** 
   - **Use: `sale.update`** ⭐ (This is the correct event type)
   - This fires when sales are created OR updated (including eCom orders syncing)

3. **URL:** 
   ```
   https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created
   ```

4. **Method:** POST

5. **Active:** ✅ Enabled

6. **Save**

## Why `sale.updated`?

- eCom orders sync to Retail as "updates" to existing records
- `sale.updated` fires when eCom orders sync
- Also fires for regular sale updates
- Most reliable for catching synced orders

## Testing

1. Create a test sale in Retail POS
2. OR wait for an eCom order to sync
3. Check backend logs at: Vercel Dashboard → Functions → Logs
4. Should see: `[Webhook] Lightspeed event received`

## Troubleshooting

**Can't find event type?**
- Look for "Sale" or "Order" related events
- Any event that fires on sale creation/update will work
- The endpoint handles multiple event types

**Webhook not firing?**
- Check webhook is "Active" ✅
- Verify URL is correct (no typos)
- Check backend is deployed to Vercel
- Look for errors in Vercel logs

**Need help?**
- Check Vercel function logs
- Test webhook URL manually with a POST request
- Verify backend endpoint is accessible
