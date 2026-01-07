# Webhook Setup - Simple Instructions

## Event Type to Choose

**Use: `sale.update`**

This is the event type that fires when:
- New sales are created
- Sales are updated
- **eCom orders sync to Retail** ⭐

## Webhook URL

```
https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created
```

## Quick Setup

1. Go to: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`
2. Click "Add Webhook"
3. **Event Type:** `sale.update`
4. **URL:** `https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created`
5. **Method:** POST
6. **Active:** ✅
7. Save

That's it! The webhook will now notify your backend whenever:
- A new sale is created
- An eCom order syncs to Retail
- A sale is updated
