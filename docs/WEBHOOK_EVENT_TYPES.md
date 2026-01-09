# Lightspeed Retail X-Series Webhook Event Types

## Available Event Types

Based on Lightspeed X-Series API documentation, here are the available webhook event types:

### Sales Events
- **`sale.created`** - When a new sale is created
- **`sale.updated`** - When an existing sale is updated
- **`sale.completed`** - When a sale is completed/closed
- **`sale.payment.added`** - When payment is added to a sale

### Customer Events
- **`customer.created`** - When a new customer is created
- **`customer.updated`** - When customer info is updated

### Product Events
- **`product.created`** - When a new product is created
- **`product.updated`** - When product is updated
- **`product.deleted`** - When product is deleted

### Inventory Events
- **`inventory.count.created`** - When inventory count is created
- **`inventory.count.updated`** - When inventory count is updated

## Recommended Event Type

For catching eCom orders as they sync:

**Use: `sale.updated`** ⭐ RECOMMENDED
- Fires when eCom orders sync to Retail (they're "updated" when synced)
- Also fires for regular sale updates
- Most reliable for catching synced orders

**OR: `sale.completed`** (if available)
- Fires when sale is completed/closed
- Good for final order data

**OR: `sale.created`** (if available)
- Fires when sale is first created
- Might fire when eCom order syncs

## Webhook URL

Your backend URL is: `https://greenhaus-admin.vercel.app`

**Webhook Endpoint:** 
```
https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created
```

**Note:** The endpoint name doesn't matter - it will receive whatever event type you configure in Lightspeed.

## Setup Instructions

1. Go to: `https://greenhauscannabisco.retail.lightspeed.app/setup/api`
2. Click "Add Webhook" or "Create Webhook"
3. **Event Type:** Choose `sale.updated` (or `sale.completed` if `sale.updated` not available)
4. **URL:** `https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created`
5. **Method:** POST
6. **Active:** ✅ Enabled
7. Save

## Testing

After setup, create a test sale in Retail POS or wait for an eCom order to sync. Check your backend logs to see if the webhook fires.
