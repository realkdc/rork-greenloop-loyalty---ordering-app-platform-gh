# Cart Badge Fix - Final Implementation

## Problem
Cart badge not showing item count on the tab bar, even though items exist in the cart.

## Root Cause
Timing issue - the WebView cart counter script was running but the messages weren't being received reliably due to:
1. Script executing before DOM was fully loaded
2. No retry mechanism on page load
3. Messages being sent before React Native listeners were ready

## Solution Implemented

### 1. Enhanced Cart Counter Script (WebShell.tsx & AppWebView.tsx)
- Added multiple delayed checks: 500ms, 2s, and 4s after page load
- Ensures cart count is detected even if DOM loads slowly
- Script now posts cart count multiple times to catch the React Native listener

### 2. Load End Hook (WebShell.tsx)
- Added PING message on `onLoadEnd` callback
- Forces immediate cart count check when page finishes loading
- 500ms delay ensures DOM is settled

### 3. Enhanced Debug Logging
- Added comprehensive console logs throughout the flow:
  - `[GH Cart]` - WebView cart detection logs
  - `[WebShell:tabKey]` - Tab-specific message handling
  - `[AppWebView]` - Message receipt confirmation
  - `[cartBadge]` - State manager updates
  - `[AppContext]` - Context subscription logs
  - `[TabLayout]` - Badge rendering logs

### 4. Message Flow
```
WebView (greenhauscc.com)
  → Cart Counter Script detects count from DOM
  → postMessage({ type: 'CART_COUNT', value: N })
  ↓
WebShell/AppWebView onMessage
  → Parse message
  → Call setCartCount(N)
  ↓
AppContext setCartCount
  → Call cartBadge.set(N)
  ↓
cartBadge manager
  → Emit to all listeners
  ↓
AppContext listener
  → Update cartCount state
  ↓
TabLayout useApp()
  → Render badge when cartCount > 0
```

## Detection Methods (in priority order)
1. **Header badge** - `a.ins-header__icon--cart[data-count]` attribute
2. **Footer text** - "Shopping Bag (N)" text parsing
3. **Cart page** - Count of `.ec-cart__products li` items (only on /products/cart)
4. **Widget counter** - `.ec-cart-widget__counter` or `[data-cart-count]`
5. **Ecwid API** - `window.Ecwid.getCart()` callback (async fallback)

## Files Modified
- `components/WebShell.tsx` - Added delayed PING on load, extended retry timings
- `components/AppWebView.tsx` - Added detailed logging, extended retry timings
- `lib/cartBadge.ts` - Already correct (no changes needed)
- `contexts/AppContext.tsx` - Already correct (no changes needed)
- `app/(tabs)/_layout.tsx` - Already correct (rendering badge properly)

## Testing
1. Add items to cart from any page
2. Switch between tabs
3. Check console for `[GH Cart] Posting to RN: { type: 'CART_COUNT', value: N }`
4. Verify `[WebShell] 📨 Cart count received: N` appears
5. Badge should appear on Cart tab with correct count

## Troubleshooting
If badge still doesn't show:
1. Check console for `[GH Cart]` logs - if missing, script isn't running
2. Check for `[WebShell] 📨 Message received` - if missing, messages not reaching RN
3. Check for `[cartBadge] ✅ Updating` - if missing, state manager not firing
4. Check for `[TabLayout] 🎨 Rendering with cartCount: N` - if N is 0, state not propagating

If you see all logs but no badge:
- Badge CSS might be rendering off-screen
- Check tab layout styles in `app/(tabs)/_layout.tsx`
