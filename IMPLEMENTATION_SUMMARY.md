# GreenHaus WebView Implementation Summary

## Overview
Native-feeling React Native app using Expo Router with WebView-based tabs for the GreenHaus cannabis dispensary website.

## Key Features Implemented

### 1. Shared Configuration (`config/greenhaus.ts`)
- **URLs**: 
  - Home: `https://greenhauscc.com/products`
  - Search: `https://greenhauscc.com/products`
  - Cart: `https://greenhauscc.com/products/cart`
  - Orders: `https://greenhauscc.com/account/orders`
  - Profile: `https://greenhauscc.com/account`
- **Route Matcher**: `matchRoute(url)` function classifies URLs to determine which tab they belong to
- **Categories**: Pre-configured links to product categories (Flower, Edibles, Pre-Rolls, etc.)

### 2. WebView Skin (`lib/webviewSkin.ts`)
Injected CSS and JavaScript that runs on every page to make the website feel native:

#### CSS Cleanup:
- Hides site header, footer, and navigation
- Removes breadcrumbs (e.g., "Home / Store / Flower")
- Removes quick-links grid at bottom (Search Products, My Account, etc.)
- Eliminates white gaps and extra padding
- Makes buttons rounder (12px border-radius)

#### JavaScript Features:
- Removes DOM elements that CSS might miss
- Detects breadcrumbs by text content ("home/store" pattern)
- Removes quick-links sections by label matching
- Extracts cart count from multiple possible selectors
- Posts cart count to React Native via WebView bridge
- Continuously monitors for DOM changes (SPA support)
- Starts each page at scroll position 0

### 3. Unified WebView Component (`components/AppWebView.tsx`)
Shared component used by all tabs with:
- Safe area insets handling (status bar)
- Cookie sharing enabled across all tabs
- JavaScript and DOM storage enabled
- Auto-injection of CSS/JS skin
- Message handling for cart count updates
- Navigation state monitoring for auto tab switching
- External URL blocking (only greenhauscc.com allowed)

**Auto Tab Switching Logic**:
- When any WebView navigates to `/cart` → switches to Cart tab
- When navigating to `/account/orders` → switches to Orders tab  
- When navigating to `/account` → switches to Profile tab

### 4. Tab Implementation

All tabs use the simplified structure:
```tsx
<AppWebView 
  initialUrl={GREENHAUS.[tab]}
  webViewRef={[tab]WebViewRef}
/>
```

**Tabs**:
- **Home** (`app/(tabs)/home.tsx`): Products catalog
- **Search** (`app/(tabs)/search.tsx`): Product search/browse
- **Cart** (`app/(tabs)/cart.tsx`): Shopping cart with badge showing item count
- **Orders** (`app/(tabs)/orders.tsx`): Order history (requires login)
- **Profile** (`app/(tabs)/profile.tsx`): Account management

### 5. Tab Layout (`app/(tabs)/_layout.tsx`)
Bottom navigation with:
- Cart badge showing item count (updates automatically)
- Tab reselection handlers:
  - **Home**: Reloads to home URL and scrolls to top
  - **Other tabs**: Scrolls to top
- Lucide icons (Home, Search, ShoppingCart, Package, User)
- Brand color: `#1E4D3A` (GreenHaus green)

### 6. WebView Bridge Utilities (`lib/webviewBridge.ts`)
Helper functions for WebView control:
- `scrollToTop()`: Instantly scrolls WebView to top
- `reloadToUrl()`: Navigates to URL and scrolls to top
- `getCurrentUrl()`: Retrieves current URL from WebView

### 7. Debug Menu (`lib/debugMenu.tsx`)
**Development-only** floating debug button (🐛):
- Shows current cart count
- Lists all tab URLs from config
- Documents implemented features
- Explains navigation behavior
- Details cleanup operations
- Only visible when `__DEV__ === true`

### 8. Context Providers

**WebViewContext** (`contexts/WebViewContext.tsx`):
- Provides refs to all 5 WebViews
- Allows cross-tab communication
- Enables tab reselection handlers

**AppContext** (`contexts/AppContext.tsx`):
- Manages cart count state
- Shared across all tabs
- Updated via WebView messages

## User Experience Features

### Navigation Behavior
1. **First Load**: App opens to Home tab showing product catalog
2. **Tab Switching**: Instant, no reload (WebViews stay mounted)
3. **Tab Reselection**: 
   - Home: Always reloads to products page
   - Others: Scroll to top
4. **Auto-switching**: Cart/account links automatically switch to correct tab

### Session Management
- Cookies shared across all WebViews
- Login in one tab = logged in everywhere
- Cart persists across tabs
- Session survives tab switches

### Visual Polish
- No visible website header/footer
- No breadcrumbs
- No quick-links grid at bottom
- Native-looking buttons
- No white gaps or extra padding
- Smooth transitions

### Cart Badge
- Real-time updates from WebView
- Shows count on Cart tab icon
- Supports guest and logged-in users
- Scrapes from multiple selectors
- Falls back to localStorage
- Handles cart page quantity inputs

## Technical Details

### Platform Support
- **iOS**: Full support with back gesture
- **Android**: Full support
- **Web**: Compatible (React Native Web)

### Cookie Strategy
- `sharedCookiesEnabled={true}` on all WebViews
- `thirdPartyCookiesEnabled={true}` for cross-domain assets
- `incognito={false}` to persist sessions

### Error Handling
- External URLs blocked
- Parse errors caught in message handlers
- TypeScript strict mode enabled
- Console logging for debugging

### Performance
- WebViews stay mounted (no reload on tab switch)
- CSS injected before content load (no flash)
- MutationObserver for SPA page changes
- Polling interval: 1.5s for cart count

## File Structure
```
app/
  (tabs)/
    _layout.tsx          # Tab navigator with badges & handlers
    home.tsx             # Products catalog
    search.tsx           # Product search
    cart.tsx             # Shopping cart
    orders.tsx           # Order history
    profile.tsx          # Account settings
  _layout.tsx            # Root layout with providers
  index.tsx              # Redirect to home tab
  
components/
  AppWebView.tsx         # Unified WebView wrapper
  
config/
  greenhaus.ts           # URLs and route matcher
  
lib/
  webviewSkin.ts         # Injected CSS/JS
  webviewBridge.ts       # WebView helper functions
  debugMenu.tsx          # Dev tools
  
contexts/
  AppContext.tsx         # Cart count state
  WebViewContext.tsx     # WebView refs
  AuthContext.tsx        # User auth (existing)
```

## Testing Checklist

- [ ] Home tab loads products catalog
- [ ] Search tab shows all products
- [ ] Cart tab displays shopping cart
- [ ] Orders tab requires/shows orders
- [ ] Profile tab shows account page
- [ ] Cart badge updates on add-to-cart
- [ ] Breadcrumbs are hidden
- [ ] Footer is hidden
- [ ] Quick-links grid is removed
- [ ] No white gaps at bottom
- [ ] Tapping Home tab reloads to products
- [ ] Tapping other tabs scrolls to top
- [ ] Clicking cart link switches to Cart tab
- [ ] Clicking account link switches to Profile tab
- [ ] Login persists across all tabs
- [ ] Debug menu shows in dev builds
- [ ] Debug menu hidden in production

## Next Steps (Optional)
1. Add pull-to-refresh on WebViews
2. Add loading spinner overlay
3. Implement deep linking for product URLs
4. Add native share button for products
5. Implement native search bar
6. Add offline detection
7. Cache frequently visited pages

## Notes
- All TypeScript errors resolved
- All ESLint errors resolved
- Safe area handling included in AppWebView
- Works with Expo Go v53
- No custom native modules required
