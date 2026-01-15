# Cart Debugging Guide

## What I Fixed

### 1. **Critical Logic Error in `WebShell.tsx`**
There was a major bug in the `handleMessage` function where the code referenced `normalized` before it was defined. This could cause JavaScript errors and prevent cart updates from working correctly.

**Before:**
```typescript
// Line 2307: normalized is used here...
if (storageCount === null && normalized === 0) {
  // ...
}
// Line 2321: ...but it's not defined until here!
let normalized = isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
```

**After:**
- Moved the `normalized` definition to the TOP of the cart count handling
- Reorganized all the logic to flow correctly
- Added comprehensive debugging logs at every step

### 2. **Enhanced Navigation Debugging**
Added detailed logging to both `navigateTo` in `SharedWebViewContext.tsx` and the cart tab handler in `_layout.tsx` to:
- Show exactly when Ecwid API is being called
- Verify the API is available
- Log cart state after navigation to confirm session persists
- Provide clear error messages if something goes wrong

### 3. **Robust Ecwid API Calls**
Improved the calls to `window.Ecwid.openPage()` to:
- Check if Ecwid is available before calling
- Retry if Ecwid isn't ready yet (up to 20 attempts over 2 seconds)
- Fall back to full navigation only as a last resort
- Log detailed information about what's happening

## How to Debug the Issue

When you test the app now, watch the logs carefully. Here's what to look for:

### When Adding an Item to Cart

Look for these logs in sequence:
```
[CartCounter] 🛍️ Ecwid.Cart.get returned: 1
[CartCounter] 📢 Sending CART_COUNT message to React Native with value: 1
[WebShell:shared] 🛒 CART_COUNT received - raw value: 1, count: undefined, normalized: 1
[WebShell:shared] 📦 Incoming storage - count: 1, cartId: abc123...
[WebShell:shared] 💾 Cached state - count: null, cartId: null
[WebShell:shared] 💾 Saved incoming storage to cartState
[WebShell:shared] ✅ Final cart count: 1 - updating badge now
```

**Key things to check:**
- Is the `cartId` present in the incoming storage?
- Is it the same `cartId` each time you add an item?

### When Navigating Between Tabs

#### Home/Browse Tab Navigation:
```
[SharedWebView] 🧭 Navigating to: https://greenhauscc.com/products
[SharedWebView] 📍 Using Ecwid internal navigation to: search (URL: https://greenhauscc.com/products)
[Ecwid Nav] 🎯 Attempting to navigate to: search
[Ecwid Nav] 🔍 Current URL: https://greenhauscc.com/
[Ecwid Nav] ✅ Calling Ecwid.openPage("search") - this should NOT reload the page
[Ecwid Nav] ✅ Ecwid.openPage() called successfully
[Ecwid Nav] 🛒 Cart still has 1 items after navigation
```

**Key things to check:**
- Does it say "Calling Ecwid.openPage()" or does it fall back to "window.location.href"?
- If it falls back, that's BAD - it means Ecwid API isn't ready
- Does the cart still have the same number of items after navigation?

#### Cart Tab Navigation:
```
[Tabs] 🛒 Cart tab pressed → opening cart via Ecwid API
[Cart Tab] 🎯 Opening cart page
[Cart Tab] ✅ Calling Ecwid.openPage("cart") - this should NOT reload the page
[Cart Tab] ✅ Cart page opened successfully
[Cart Tab] 🛒 Cart check after opening: count=1, cartId=abc123...
```

**Key things to check:**
- Is the `cartId` the SAME as before?
- Is the count correct?

### If Cart Is Resetting (The Main Issue)

If you see this log, that's the smoking gun:
```
[WebShell:shared] 🚨 CART SESSION RESET DETECTED!
  Previous cartId: abc123
  New cartId: xyz789
  Previous count: 1
  New count: 0
  → This indicates Ecwid created a NEW session, losing the old cart!
  → We should NOT be getting new cartIds - something is breaking the session.
```

**What this means:**
- Ecwid created a brand new cart session
- The old cart is lost
- This happens when the page is reloaded (NOT using `openPage()`)
- OR when cookies/localStorage are not being maintained

### If Navigation Falls Back to Full Reload

If you see these logs, that's BAD:
```
[Ecwid Nav] ❌ window.Ecwid not found!
[Ecwid Nav] ❌ Giving up after 20 attempts - falling back to full navigation
[Ecwid Nav] ⚠️ THIS WILL CAUSE A PAGE RELOAD AND LOSE THE CART SESSION!
```

**What to do:**
1. Check if the Ecwid store is loading correctly
2. Check if the `CART_COUNTER_SCRIPT` is being injected (look for `[CartCounter] 🚀 Starting cart counter script`)
3. Check the network tab for any errors loading Ecwid's JavaScript

## Expected Behavior (Working Correctly)

1. **Add first item on Home tab**
   - Cart badge shows "1"
   - Logs show cartId (e.g., `abc123`)

2. **Navigate to Browse tab**
   - No page reload
   - Logs show "Calling Ecwid.openPage("search")"
   - Logs show "Cart still has 1 items after navigation"
   - Cart badge still shows "1"
   - CartId is STILL `abc123`

3. **Add second item on Browse tab**
   - Cart badge shows "2"
   - Logs show SAME cartId (`abc123`)
   - Storage count is 2

4. **Navigate to Cart tab**
   - No page reload
   - Logs show "Calling Ecwid.openPage("cart")"
   - Cart page shows BOTH items
   - Logs show count=2, cartId=abc123

## What Could Still Be Wrong

If the issue persists even with these changes, here are the possible causes:

### 1. Ecwid API Not Loading
- The `window.Ecwid.openPage` function might not exist
- This could be because Ecwid's main script hasn't loaded yet
- **Solution:** Check the network tab, ensure `app.ecwid.com` scripts are loading

### 2. Something Else Causing Page Reloads
- A click handler or navigation somewhere else in the code
- A redirect from the Ecwid store itself
- **Solution:** Look for ANY logs showing "window.location.href" or "reload()"

### 3. Cookies/Storage Being Cleared
- The WebView might be clearing cookies between navigations
- **Solution:** Check if the `ec-...-session` cookie persists across tab switches

### 4. Multiple WebView Instances
- Despite the shared WebView, something might be creating multiple instances
- **Solution:** Look for multiple sets of `[WebShell:shared] 📨 Raw message received` logs

## Testing Steps

1. **Start fresh** - Force close the app, reopen
2. **Add item from Home** - Note the cartId in logs
3. **Switch to Browse** - Verify no reload, same cartId
4. **Add another item** - Verify cartId is STILL the same
5. **Switch to Cart** - Verify both items are there

At each step, copy the relevant logs and check:
- Is `Ecwid.openPage()` being called?
- Is the cartId changing?
- Is the count correct?

## Next Steps if Still Broken

If the cart is STILL replacing items after these fixes:

1. **Verify Ecwid API is working**
   - Add a console log in the WebView: `console.log('Ecwid version:', window.Ecwid?.version)`
   - Check if `window.Ecwid.openPage` exists

2. **Check if something else is navigating**
   - Search the codebase for `webviewRef.current.reload()`
   - Search for `window.location.href =`
   - Look for any other navigation code

3. **Test Ecwid directly**
   - Open the store in a regular browser
   - Add items
   - Use browser dev tools to call `Ecwid.openPage('search')` manually
   - Verify items persist

4. **Consider Ecwid configuration**
   - Check if Ecwid has any settings that might cause session resets
   - Look for "persistent cart" or "session management" settings
   - Check if there's a short session timeout configured

