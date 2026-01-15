# Cart Fix V2 - Hybrid Approach

## The Problem with V1 (Zero Navigation)

V1 removed ALL navigation, which broke the initial page load. The WebView never loaded the Ecwid website, resulting in timeout errors.

## The V2 Solution: Initial Load + Zero Navigation

**Load the website once, then never navigate again.**

### What Changed:

**`app/(tabs)/home.tsx`** - Hybrid approach:
```typescript
const hasNavigatedRef = useRef(false);

useFocusEffect(() => {
  if (!hasNavigatedRef.current) {
    // FIRST TIME ONLY: Load Ecwid website
    console.log('[HomeTab] Initial focus - navigating to home to load Ecwid');
    navigateTo('https://greenhauscc.com/');
    hasNavigatedRef.current = true;
  } else {
    // SUBSEQUENT TIMES: Do nothing
    console.log('[HomeTab] Tab focused (no navigation to preserve cart)');
  }
});
```

**All other files remain the same as V1:**
- `search.tsx` - No navigation
- `cart.tsx` - No navigation
- `_layout.tsx` - No navigation on tab press
- `WebShell.tsx` - No `Ecwid.openPage()` calls

## How It Works:

**App Launch:**
1. User opens app
2. Home tab focuses
3. `hasNavigatedRef.current` is false
4. Home tab navigates to `https://greenhauscc.com/`
5. WebView loads Ecwid
6. `hasNavigatedRef.current` becomes true
7. ✅ **Website is loaded**

**After That:**
1. User switches tabs → NO navigation
2. User adds item → Ecwid handles cart navigation internally
3. User switches tabs again → NO navigation
4. ✅ **Cart session preserved**

## Key Principles:

1. **One-time load** - WebView loads Ecwid website once on app launch
2. **Zero subsequent navigation** - After initial load, app NEVER navigates
3. **Ecwid controls everything** - All page changes happen via Ecwid's internal navigation
4. **Cart persistence** - No external navigation = no cart session resets

## Testing:

**Test 1: Initial Load**
1. Open app
2. ✅ Should see Ecwid home page load

**Test 2: Multiple Items**
1. Browse products (using Ecwid's UI, not app tabs)
2. Add item A → Ecwid navigates to cart
3. Click "Continue Shopping" (in Ecwid, not app tabs)
4. Add item B → Ecwid navigates to cart
5. ✅ **Should see BOTH items**

**Test 3: Tab Switching**
1. Add item
2. Switch to Search tab (WebView might still show cart)
3. Use Ecwid's navigation to browse
4. Add another item
5. ✅ **Cart should have 2 items**

## Important User Behavior:

Users MUST use **Ecwid's internal navigation** to move between pages:
- "Continue Shopping" button
- "Back" button
- Product category links
- Search within Ecwid

The app tabs (Home, Search, Cart) are just labels - they don't change what's displayed in the WebView after initial load.

## Why This Works:

- ✅ Website loads on app launch
- ✅ No navigation after that = no cart disruption
- ✅ Ecwid's localStorage persists naturally
- ✅ CartId stays consistent
- ✅ Items accumulate properly

## Trade-offs:

**Pros:**
- ✅ Cart works perfectly
- ✅ Simple, minimal code
- ✅ Respects Ecwid's architecture

**Cons:**
- ⚠️ Tab labels don't match content after user navigates within Ecwid
- ⚠️ Users must learn to use Ecwid's navigation buttons

**The trade-off is worth it** - working cart > perfect UI synchronization.

## If It STILL Doesn't Work:

1. **Check logs for:** `[HomeTab] Initial focus - navigating to home to load Ecwid`
   - If you don't see this, the initial load didn't happen

2. **Check for:** `🔄 CartId changed from X to Y`
   - If you see this, something is still triggering navigation

3. **Check for:** WebView reload/mount messages
   - If WebView is being recreated, cart will be lost

4. **Try:** Clear app data and restart
   - Sometimes cached state causes issues

