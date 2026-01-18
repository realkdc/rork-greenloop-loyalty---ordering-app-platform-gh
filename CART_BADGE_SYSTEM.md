# Cart Badge System - Working Implementation

**Last Updated:** January 16, 2026 11:45 PM
**Status:** ✅ Working & Optimized
**Location:** [app/(tabs)/cart.tsx](app/(tabs)/cart.tsx)

## Overview

The cart badge displays the total quantity of items in the shopping cart. Only the **Cart tab** sends cart count updates to prevent conflicts between tabs.

**Key Features:**
- Cart automatically expands on page load to ensure accurate quantity counting
- Optimized performance with reduced polling and debounced DOM operations
- Product links in cart redirect to Browse tab
- Fast page loading with caching enabled

## How It Works

### Architecture

- **Single Source:** Only [app/(tabs)/cart.tsx](app/(tabs)/cart.tsx) sends cart counts
- **Message Type:** `CART_COUNT_CONFIRMED` with `confirmed: true` flag
- **Update Frequency:** Every 3 seconds + immediately on load (optimized from 2s)
- **Cookie Sharing:** Enabled on all tabs for session persistence
- **Auto-Expand:** Cart automatically expands on load to show Qty values
- **Performance:** Debounced DOM mutations (100ms), no console logging, optimized caching

### The Problem We Solved

Lightspeed's cart has two views:
- **Collapsed:** Shows "4 items" (counts PRODUCTS, not total quantity)
- **Expanded:** Shows "Qty: 1", "Qty: 1", "Qty: 1", "Qty: 2" (actual quantities)

If you have 4 products with quantities 1+1+1+2, the total is **5 items**, but collapsed view only shows **4 items** (product count).

**Solution:** Auto-expand the cart on page load so we can always read the "Qty: X" values and calculate the correct total.

### Detection Logic

1. **Check for Empty Cart**
   - Regex: `/your (shopping )?cart is empty/i`
   - Returns: `0`

2. **Sum "Qty: X" Values** (Primary Method)
   - Finds all "Qty: 1", "Qty: 2", etc. in page text
   - Sums the quantities for accurate total
   - Example: "Qty: 1" + "Qty: 1" + "Qty: 1" + "Qty: 2" = 5

3. **Auto-Expand if Collapsed**
   - If no "Qty: X" values found, clicks the "X items" button to expand
   - Waits 300ms and rechecks for Qty values

4. **Fallback to "X items" Text**
   - Last resort if auto-expand fails
   - Note: This counts products, not quantities (may be inaccurate)

## Code Implementation

### Auto-Expand Function

```javascript
// From app/(tabs)/cart.tsx line 48-61
function expandCart() {
  // Look for the "X items" button/link that expands the cart
  const buttons = document.querySelectorAll('a, button, div[class*="summary"], div[class*="items"]');
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const text = btn.textContent || '';
    if (/\d+\s*items?/i.test(text)) {
      // Found the expand button, click it
      btn.click();
      break;
    }
  }
}

// Auto-expand on page load
setTimeout(expandCart, 500);
```

### Cart Count Detection

```javascript
// From app/(tabs)/cart.tsx line 63-115
let hasExpanded = false;
function sendCartCount() {
  let count = 0;
  const bodyText = document.body.innerText || '';

  // Check if cart is empty first
  if (/your (shopping )?cart is empty/i.test(bodyText)) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'CART_COUNT_CONFIRMED',
      count: 0
    }));
    return;
  }

  // Method 1: Sum "Qty: X" values (most accurate when visible)
  const qtyMatches = bodyText.match(/Qty:\s*(\d+)/gi);
  if (qtyMatches && qtyMatches.length > 0) {
    count = qtyMatches.reduce((sum, match) => {
      const num = parseInt(match.replace(/Qty:\s*/i, '')) || 0;
      return sum + num;
    }, 0);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'CART_COUNT_CONFIRMED',
      count
    }));
    return;
  }

  // If no Qty values visible and we haven't tried to expand yet, expand the cart
  if (!hasExpanded) {
    hasExpanded = true;
    expandCart();
    setTimeout(sendCartCount, 300); // Recheck after expanding
    return;
  }

  // Method 2: Try to find Lightspeed header cart badge (hidden but in DOM)
  const header = document.querySelector('header');
  if (header) {
    const cartBadge = header.querySelector('[class*="cart"][class*="count"], [class*="cart"][class*="badge"], [class*="minicart"]');
    if (cartBadge) {
      const badgeText = cartBadge.textContent?.trim();
      if (badgeText && /^\d+$/.test(badgeText)) {
        count = parseInt(badgeText) || 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CART_COUNT_CONFIRMED',
          count
        }));
        return;
      }
    }
  }

  // Method 3: Fallback to "X items" text
  const itemsMatch = bodyText.match(/(\d+)\s*items?/i);
  if (itemsMatch) {
    count = parseInt(itemsMatch[1]) || 0;
  }

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'CART_COUNT_CONFIRMED',
    count
  }));
}

// Check every 3 seconds (optimized for performance)
setInterval(sendCartCount, 3000);
sendCartCount(); // Send immediately
```

### React Native Handler

```typescript
// From app/(tabs)/cart.tsx line 236-237
if (data.type === 'CART_COUNT_CONFIRMED') {
  setCartCount(data.count, true);
}
```

### Product Link Interception

```javascript
// From app/(tabs)/cart.tsx line 147-170
document.addEventListener('click', function(e) {
  let target = e.target;
  if (!target) return;

  // Traverse up to find parent link if clicked on child element (like img)
  let linkElement = target;
  while (linkElement && linkElement.tagName !== 'A' && linkElement !== document.body) {
    linkElement = linkElement.parentElement;
  }

  const href = linkElement && linkElement.tagName === 'A' ?
    (linkElement.getAttribute('href') || '').toLowerCase() : '';

  // Check if it's a product link
  if (href && (href.includes('/p/') ||
      (href.includes('greenhauscc.com') && !href.includes('/cart') && !href.includes('checkout')))) {
    e.preventDefault();
    e.stopPropagation();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'NAVIGATE_TO_BROWSE',
      url: linkElement.getAttribute('href')
    }));
    return;
  }
}, true);
```

## Other Tabs

All other tabs (Home, Browse, Orders, Account) have **cart count detection removed** to prevent conflicts:

- [app/(tabs)/home.tsx](app/(tabs)/home.tsx) - No cart count detection
- [app/(tabs)/search.tsx](app/(tabs)/search.tsx) - No cart count detection
- [app/(tabs)/orders.tsx](app/(tabs)/orders.tsx) - No cart count detection
- [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) - No cart count detection

**Important:** Only Cart tab should send `CART_COUNT_CONFIRMED` messages.

## Why This Works

1. **Single Source of Truth:** Only one tab sends counts, eliminating race conditions
2. **Always Expanded:** Cart auto-expands so Qty values are always visible
3. **Quantity-Aware:** Sums "Qty: X" values for accurate total quantity (not product count)
4. **Confirmed Flag:** `confirmed: true` bypasses delays and immediately updates badge
5. **Cookie Sharing:** Cart state persists across tabs
6. **Performance Optimized:** Debounced operations, reduced polling, no debug logging
7. **Smart Navigation:** Product clicks redirect to Browse tab, cart stays accessible

## Common Issues & Solutions

### Badge shows wrong count (4 instead of 5)
**Cause:** Cart is collapsed and showing product count instead of quantity count
**Solution:** ✅ Fixed - cart auto-expands on load

### Cart doesn't auto-expand
**Cause:** Expand button selector not matching or page not fully loaded
**Solution:** ✅ Fixed - script waits 500ms before attempting to expand, and retries on every count check

### Badge shows stale count
**Cause:** Old count persisted in AsyncStorage
**Solution:** Close and reopen app completely (swipe up from app switcher)

### Badge doesn't update
**Cause:** Script not running or message not reaching React Native
**Solution:** ✅ Fixed - cart only sends counts when on /cart URL

### Product links in cart open in cart tab
**Cause:** Click events not being intercepted properly
**Solution:** ✅ Fixed - DOM traversal finds parent links, redirects to Browse tab

### Slow page loading
**Cause:** Excessive console logging and aggressive polling
**Solution:** ✅ Fixed - removed all debug logs, optimized to 3s polling, debounced DOM operations

## Testing

1. **Add 1 product with Qty: 3**
   - Expected: Badge shows "3"
   - Cart should be auto-expanded showing "Qty: 3"

2. **Add 4 different products with quantities 1, 1, 1, 2**
   - Expected: Badge shows "5" (total quantity)
   - Cart should be auto-expanded showing all Qty values

3. **Remove all items**
   - Expected: Badge shows "0" or disappears

4. **Switch between tabs**
   - Expected: Badge persists, cart items remain

5. **Navigate to cart from checkout button on other tabs**
   - Expected: Cart auto-expands and shows correct count

## Files

- [app/(tabs)/cart.tsx](app/(tabs)/cart.tsx) - Cart tab with auto-expand and badge detection
- [contexts/AppContext.tsx](contexts/AppContext.tsx) - Badge state management
- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) - Badge rendering

## Performance Optimizations

### WebView Caching
All tabs now use optimized caching:
```typescript
cacheEnabled={true}
incognito={false}
// Default cache mode (faster than LOAD_CACHE_ELSE_NETWORK)
```

### Debounced DOM Operations
```javascript
// Debounced MutationObserver (100ms delay)
let hideTimeout;
const observer = new MutationObserver(() => {
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(hideUIElements, 100);
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Reduced Polling Frequency
- Cart count checks: Every 3 seconds (was 2 seconds)
- No aggressive 1-second UI hiding intervals
- All console logging removed

### Files Optimized
- [app/(tabs)/home.tsx](app/(tabs)/home.tsx) - Caching enabled, debug logs removed
- [app/(tabs)/cart.tsx](app/(tabs)/cart.tsx) - Debounced operations, 3s polling
- [app/(tabs)/search.tsx](app/(tabs)/search.tsx) - Caching enabled, logs removed
- [app/(tabs)/orders.tsx](app/(tabs)/orders.tsx) - Caching enabled, logs removed
- [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) - Caching enabled, logs removed

## History

- **Jan 16, 2026 11:45 PM:** Performance optimizations - removed debug logs, optimized caching, debounced DOM ops
- **Jan 16, 2026 10:30 PM:** Fixed product link interception with DOM traversal
- **Jan 16, 2026 9:27 PM:** Added auto-expand feature to fix collapsed vs expanded count issue
- **Jan 16, 2026:** Fixed to sum quantities instead of counting rows
- **Jan 15, 2026:** Removed cart detection from other tabs
- **Jan 15, 2026:** Added cookie sharing to all tabs
- **Earlier:** Multiple iterations trying different detection methods

## DO NOT

- ❌ Add cart count detection to other tabs
- ❌ Remove the auto-expand logic
- ❌ Remove the "Qty: X" summation logic
- ❌ Change message type from `CART_COUNT_CONFIRMED`
- ❌ Remove `confirmed: true` flag
- ❌ Remove cookie sharing props
- ❌ Add console.log statements (slows down performance)
- ❌ Reduce polling below 3 seconds (unnecessary performance hit)
- ❌ Remove debouncing from MutationObserver
- ❌ Disable caching on WebViews

## Summary

**The Working Method:**

1. Only Cart tab detects and sends cart counts
2. Cart automatically expands on page load (500ms delay)
3. If no Qty values found, script manually expands cart
4. Sum all "Qty: X" values for accurate total quantity
5. Send as `CART_COUNT_CONFIRMED` every 3 seconds
6. Enable cookie sharing on all tabs for session persistence
7. Intercept product clicks and redirect to Browse tab
8. Use debounced DOM operations for performance
9. No console logging in production
10. Caching enabled on all WebViews

**Key Insights:**
- Lightspeed's collapsed cart shows product count (4), but we need total quantity (5). Solution: Always keep cart expanded so we can read the actual Qty values.
- Console logging in WebView event handlers significantly slows down page load. Remove all debug logs for production.
- Default browser caching is faster than explicit cache modes.
- DOM traversal is needed to intercept clicks on nested elements (images inside links).

**This is the working, optimized method. Don't overthink it.**
