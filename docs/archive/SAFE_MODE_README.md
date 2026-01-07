# Cart Persistence Fix - Safe Mode Navigation

## The Problem

The cart was being cleared/reset every time users navigated between tabs. This happened because:

1. **`Ecwid.openPage('cart')` creates NEW cart sessions** - Every time we called this API, Ecwid would create a brand new cart with a new `cartId`, effectively wiping out the previous cart
2. **Rapid hash changes confused Ecwid** - When switching between tabs, we were changing `window.location.hash` multiple times in quick succession, which could cause Ecwid to lose track of the cart session

## The Solution

### 1. **Hash-Based Navigation in `SharedWebViewContext.tsx`**
Instead of using `Ecwid.openPage()` which creates new sessions, we now navigate by directly setting `window.location.hash`:

```javascript
// For cart: window.location.hash = '#!/~/cart';
// For search: window.location.hash = '#!/~/search';
// For home: window.location.hash = '#!/';
```

This is the same method Ecwid's own UI uses, so it properly preserves cart sessions.

### 2. **Conditional Navigation in `cart.tsx`**
The cart tab now checks if we're ALREADY on the cart page before navigating:

```javascript
// Only navigate if we're NOT already on cart
if (!currentHash.includes('/cart')) {
  window.location.hash = '#!/~/cart';
} else {
  console.log('Already on cart, no navigation needed');
}
```

This prevents unnecessary hash changes that could reset the cart.

### 3. **Cart Tab Handles Its Own Navigation**
The cart tab's navigation is now handled exclusively in `cart.tsx` using `useFocusEffect`, NOT in the `_layout.tsx` tab press listener. This prevents double-navigation.

## How It Works Now

### Normal Flow:
1. **User browses products** on Home or Search tabs
2. **User adds item** → Ecwid automatically redirects to cart (via `NAVIGATE_TAB` message)
3. **User switches to Home tab** → hash changes to `#!/`
4. **User switches back to Cart tab** → cart.tsx checks hash:
   - If NOT on cart → sets hash to `#!/~/cart` → cart appears
   - If already on cart → does nothing → cart remains intact
5. **Cart items persist** because the same Ecwid session is maintained

### Key Benefits:
- ✅ Cart items persist across tab navigation
- ✅ Cart count badge stays accurate
- ✅ Fewer unnecessary navigations
- ✅ Ecwid session is preserved

## What to Test

### Test 1: Basic Cart Persistence
1. Open app
2. Go to Home or Search
3. Add item to cart → should see cart with 1 item
4. Navigate to Home tab
5. Navigate back to Cart tab
6. **Expected**: Cart still shows the item (NOT empty)
7. Add another item
8. **Expected**: Cart now shows 2 items (NOT just the new item)

### Test 2: Multiple Items
1. Add item A
2. Go to Home
3. Add item B
4. **Expected**: Cart shows BOTH item A and item B

### Test 3: Cart Badge
1. Add 3 items
2. Navigate between tabs
3. **Expected**: Badge always shows "3", cart always shows 3 items

### Test 4: Manual Cart Access
1. Browse products (don't add anything)
2. Click Cart tab
3. **Expected**: Shows empty cart OR last cart state (if there was one)

## Debugging

Watch for these log messages:

### Good Signs:
```
[CartTab] ✅ Already on cart page, no navigation needed
[Ecwid Nav] 🛒 BEFORE nav - Cart: 2 items, cartId: ABC123
[Ecwid Nav] 🛒 AFTER nav - Cart: 2 items, cartId: ABC123
[Ecwid Nav] ✅ CartId preserved: ABC123
```

### Bad Signs:
```
[Ecwid Nav] ⚠️ CartId CHANGED! Before: ABC123 After: XYZ789
```
This means the cart session was lost and a new one was created.

## If Cart Still Clears

If the cart is still being cleared, check these:

1. **Look for cartId changes in logs** - Search for "CartId CHANGED"
2. **Check for full page reloads** - Search for "Full page reload"
3. **Verify hash navigation** - Look for "Setting hash to:" logs
4. **Check storage persistence** - Look for "storage snapshot" logs

## Technical Details

### Files Changed:
- `contexts/SharedWebViewContext.tsx` - Switched from `Ecwid.openPage()` to hash-based navigation
- `app/(tabs)/cart.tsx` - Added conditional hash checking before navigation
- `app/(tabs)/_layout.tsx` - Cart tab navigation now handled in cart.tsx only

### How Ecwid Cart Works:
- Ecwid stores cart data in browser localStorage
- Each cart has a unique `cartId` (UUID)
- Calling `Ecwid.openPage('cart')` can create a NEW cartId
- Setting `window.location.hash` preserves the existing cartId
- The hash format is: `#!/~/cart` for cart, `#!/~/search` for products, `#!/` for home

### Why This Should Work:
- We're using the SAME navigation method Ecwid uses internally
- We minimize hash changes by checking current state first  
- We avoid the `Ecwid.openPage()` API that was causing new sessions
- The SharedWebView persists across tabs, so localStorage is maintained
