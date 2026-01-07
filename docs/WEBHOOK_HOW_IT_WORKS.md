# How Webhooks Work - Simple Explanation

## The Flow (Step by Step)

### 1. **Something Happens in Lightspeed**
   - A sale is created in Retail POS
   - OR an eCom order syncs to Retail (even if it was placed months ago)
   - Lightspeed detects: "Hey, a sale was updated!"

### 2. **Lightspeed Sends Notification**
   - Lightspeed automatically sends a POST request to your backend URL
   - URL: `https://greenhaus-admin.vercel.app/api/webhooks/lightspeed/sale-created`
   - Payload looks like:
     ```json
     {
       "event_type": "sale.update",
       "sale": {
         "id": "12345",
         "customer_id": "67890",
         "receipt_number": "2030",
         "total": 150.00,
         "created_at": "2025-11-16T18:49:31+00:00"
       }
     }
     ```

### 3. **Your Backend Receives It**
   - The endpoint in `backend/hono.ts` receives the POST request
   - It extracts: `saleId`, `customerId`, `receiptNumber`
   - Currently: Just logs it (see TODO comments)

### 4. **What It SHOULD Do** (Not implemented yet)

   **Option A: Update Firestore Database**
   ```typescript
   // 1. Fetch full sale details from Lightspeed API
   const sale = await fetch(`/sales/${saleId}`);
   
   // 2. Check if it's eCom order
   const isEcom = sale.source?.startsWith('ecw:');
   
   // 3. Get customer email
   const customer = await fetch(`/customers/${customerId}`);
   
   // 4. Update Firestore document
   await firestore.collection('customers').doc(customer.email).update({
     lastOrderDate: sale.created_at,
     totalSpend: increment(sale.total),
     orderCount: increment(1),
     ecomOrderCount: isEcom ? increment(1) : null,
     lastUpdated: new Date()
   });
   ```

   **Option B: Trigger Analytics Refresh**
   ```typescript
   // Queue a job to re-run customer analytics for this customer
   await queueAnalyticsUpdate(customerId);
   ```

   **Option C: Send Push Notification**
   ```typescript
   // If customer has app installed, send notification
   if (customer.pushToken) {
     await sendPushNotification(customer.pushToken, {
       title: "Order Confirmed!",
       body: `Your order #${receiptNumber} is being processed`
     });
   }
   ```

## Current State

✅ **What's Working:**
- Webhook endpoint exists and receives requests
- Logs the webhook data
- Returns success response

❌ **What's NOT Working Yet:**
- Doesn't actually update anything
- Just has TODO comments
- No Firestore updates
- No analytics refresh
- No notifications

## What Needs to Be Implemented

You need to decide WHERE to store/update customer analytics:

### Option 1: Firestore (Recommended)
- Store customer metrics in Firestore
- Update in real-time when webhook fires
- App can read from Firestore
- Pros: Real-time, accessible from app
- Cons: Need to set up Firestore structure

### Option 2: CSV Files (Current Approach)
- Keep using CSV exports
- Webhook just triggers a script to regenerate CSV
- Pros: Simple, no database needed
- Cons: Not real-time, file-based

### Option 3: Hybrid
- Webhook updates Firestore for real-time app data
- Weekly script updates CSV for analytics/reporting
- Pros: Best of both worlds
- Cons: More complex

## Example: What Happens When eCom Order Syncs

**Timeline:**
1. **Nov 16, 2025:** Customer places eCom order (receipt #2231)
2. **Jan 5, 2026:** Order finally syncs to Retail API
3. **Jan 5, 2026 (same moment):** Lightspeed sends webhook to your backend
4. **Jan 5, 2026 (same moment):** Your backend:
   - Receives webhook
   - Fetches full sale details
   - Checks: "Is this eCom?" → Yes (source: "ecw:...")
   - Updates customer analytics
   - Sends push notification (if customer has app)

**Result:** Customer analytics updated immediately, no waiting!

## Next Steps

1. **Decide where to store data** (Firestore vs CSV vs both)
2. **Implement the update logic** in `backend/hono.ts`
3. **Test with a real sale** to make sure it works
4. **Monitor logs** to see webhooks firing
