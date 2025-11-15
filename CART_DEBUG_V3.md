# Cart Debug - Enhanced Logging (V3)

## What Changed

### 1. Fixed Tab Navigation (cart.tsx & search.tsx)
Previously, clicking tabs did NOTHING - the WebView just stayed on whatever page it was on. Now:
- **Cart Tab**: Uses hash navigation (`#!/~/cart`) to go to cart page
- **Search Tab**: Uses hash navigation (`#!/~/search`) to go to products/search page
- **Key**: Hash navigation preserves cart session (doesn't create new cart like `Ecwid.openPage()` does)

### 2. Enhanced Cart Item Logging (WebShell.tsx)
Added detailed logging to see EXACTLY what items are in the cart at all times:
- Now logs the actual item names, quantities, and IDs
- Shows both incoming and cached cart items
- This will help us identify if items are being replaced or if something else is happening

## How to Test

1. **Clear cache and restart the app**
2. **Add first item (Item A)**:
   - Browse to a product
   - Click "Add to Cart"
   - Watch the logs - you should see the item details
3. **Navigate away and add second item (Item B)**:
   - Go back to browse (home/search tab)
   - Find a different product
   - Click "Add to Cart"
   - **CRITICAL**: Check the logs to see if:
     - Both items are shown (Item A + Item B) ✅ GOOD
     - Only Item B is shown (Item A disappeared) ❌ BAD - confirms replacement issue
     - CartId changed ❌ BAD - means new session was created

## What to Look For in Logs

Look for these log entries:
```
[WebShell:shared] 📦 Incoming storage - count: X, cartId: XXXXX
[WebShell:shared] 📦 Incoming ITEMS: [
  {
    "name": "Product Name",
    "quantity": 1,
    "productId": "...",
    "cartItemId": "..."
  }
]
```

**If you only see 1 item after adding 2, that confirms items are being replaced.**

## Possible Causes (Once We Confirm the Issue)

1. **Ecwid Configuration**: The store might be configured to replace cart contents instead of adding
2. **Navigation Interference**: Our tab switching might be causing Ecwid to reset
3. **Storage Corruption**: Something might be corrupting the cart storage between additions
4. **Session Issues**: Cart session might be expiring or resetting between additions

## Next Steps

After testing, share the logs showing:
1. After adding Item A (should show 1 item)
2. After adding Item B (should show 2 items if working, 1 item if broken)
3. Any cartId changes between additions

This will pinpoint exactly where and why items are being replaced.

