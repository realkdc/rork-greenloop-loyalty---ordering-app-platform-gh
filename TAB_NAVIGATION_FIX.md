# Tab Navigation Fix ✅

## The Problem
- **Cart IS working!** All 3 items preserved with same cartId ✨
- BUT tabs weren't navigating the WebView to the correct pages
- Clicking Cart tab → stayed on whatever page you were on
- Clicking Browse tab → stayed on whatever page you were on

## Root Cause
1. **Duplicate navigation logic** - Both `_layout.tsx` (tabPress) AND individual tab files (useFocusEffect) were trying to navigate
2. **Race condition** - webviewRef wasn't ready when navigation was attempted
3. **No delay** - JavaScript injection happened before WebView was fully mounted

## The Fix

### 1. Removed Duplicate Logic (`_layout.tsx`)
**Before:**
```typescript
listeners={{
  tabPress: () => {
    // Complex hash injection logic here...
    targetRef.current.injectJavaScript(...);
  }
}}
```

**After:**
```typescript
listeners={{
  tabPress: () => {
    console.log(`[Tabs] 📱 Tab ${name} pressed`);
    // Navigation handled by each tab's useFocusEffect
    // This prevents race conditions with webviewRef availability
  }
}}
```

### 2. Added Delay for WebView Ref (`cart.tsx`, `search.tsx`)
**Before:**
```typescript
useFocusEffect(
  React.useCallback(() => {
    if (webviewRef?.current) {  // ❌ Often null!
      webviewRef.current.injectJavaScript(...);
    }
  }, [webviewRef])
);
```

**After:**
```typescript
useFocusEffect(
  React.useCallback(() => {
    const timer = setTimeout(() => {  // ✅ Wait 100ms for ref
      if (webviewRef?.current) {
        console.log('[CartTab] ✅ WebView ref is ready');
        webviewRef.current.injectJavaScript(...);
      } else {
        console.warn('[CartTab] ⚠️ WebView ref not available');
      }
    }, 100);
    
    return () => clearTimeout(timer);  // Cleanup
  }, [webviewRef])
);
```

## How It Works Now

1. **User clicks Cart tab** 
   - Tab switches immediately (React Navigation)
   - `cart.tsx` useFocusEffect fires
   - Waits 100ms for webviewRef to be ready
   - Injects: `window.location.hash = '#!/~/cart'`
   - WebView navigates to cart page (preserving cart session!)

2. **User clicks Browse tab**
   - Tab switches immediately 
   - `search.tsx` useFocusEffect fires
   - Waits 100ms for webviewRef
   - Injects: `window.location.hash = '#!/~/search'`
   - WebView navigates to products/catalog page

3. **User clicks Home tab**
   - First focus: Full navigation to `https://greenhauscc.com/` (loads Ecwid)
   - Subsequent focuses: Hash navigation to `#!/` (preserves cart)

## Why Hash Navigation?
Using `window.location.hash = '#!/~/cart'` instead of `Ecwid.openPage('cart')` is CRITICAL:
- ✅ Hash navigation = Same cart session preserved
- ❌ Ecwid.openPage() = Creates NEW cart session (items replaced)

## Test It
1. Start on Home tab
2. Add 3 items to cart (from different product pages)
3. Click Cart tab → Should show all 3 items
4. Click Browse tab → Should show products grid
5. Click Home tab → Should show home page
6. Click Cart tab again → Should STILL show all 3 items ✅

## Debug Logs to Watch For
```
[CartTab] 🛒 Tab focused - navigating to cart via hash
[CartTab] ✅ WebView ref is ready, injecting hash navigation
[CartTab] 📍 Current hash: #!/
[CartTab] 🎯 Target hash: #!/~/cart
[CartTab] 🚀 Navigating to cart via hash (preserves cart session)
```

If you see `⚠️ WebView ref not available`, the 100ms delay might need to be increased.

