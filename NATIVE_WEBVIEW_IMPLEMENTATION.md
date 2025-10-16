# GreenHaus Native WebView Implementation

## Overview
The GreenHaus app now provides a fully native experience using WebViews with injected CSS/JS to hide site chrome and enable seamless navigation between tabs.

## Key Features Implemented

### 1. Store Configuration (`config/greenhaus.ts`)
- **Store URLs**: Centralized configuration for all tab URLs
  - `HOME`: https://greenhauscc.com/ (main homepage)
  - `SEARCH`: https://greenhauscc.com/products
  - `CART`: https://greenhauscc.com/products/cart
  - `ORDERS`: https://greenhauscc.com/account/orders
  - `PROFILE`: https://greenhauscc.com/account

- **Route Matching**: Smart URL detection to automatically switch tabs
  - Cart URLs → Cart tab
  - Account/Orders URLs → Orders/Profile tabs
  - Product URLs → Search tab

### 2. WebView Skin (`lib/webviewSkin.ts`)

#### CSS Injection (Applied Before Content Load)
Hides all site chrome immediately to prevent flashing:
- Site header and navigation
- Breadcrumbs (all variants)
- Footer and quick-link grids
- Floating/sticky elements
- Removes all padding/margin gaps

#### JavaScript Injection (Applied After Load)
- **Cart Count Detection**: Scans 15+ common cart badge selectors
  - Detects header cart badges
  - Counts cart page quantity inputs
  - Posts count updates to React Native via `CART_COUNT` message
  - Polls every 1.2 seconds + watches DOM mutations

- **Route Hints**: Detects navigation and posts `ROUTE_HINT` messages
  - Automatically switches to Cart tab when user clicks checkout
  - Switches to Profile/Orders tabs when navigating to account pages

- **Footer Cleanup**: Removes quick-link grids (Search Products, My Account, etc.)
  - Keeps legal footer but removes icon row
  - Multiple fallback strategies

- **Loyalty Detection**: Scrapes "Earn $X Loyalty" text (best-effort)

### 3. AppWebView Component (`components/AppWebView.tsx`)

Features:
- **Shared cookies** across all tabs (users stay logged in)
- **Message handling** for cart count, route hints, and loyalty
- **Automatic tab switching** based on URL navigation
- **Loading indicators** for better UX
- **Pull-to-refresh** enabled
- **Safe area handling** with proper insets

Props:
- `initialUrl`: Starting URL for the WebView
- `webViewRef`: Optional ref for external control

### 4. Tab Navigation (`app/(tabs)/_layout.tsx`)

Bottom tabs (5 total):
1. **Home** 🏠 - Main homepage
2. **Search** 🔍 - Product catalog
3. **Cart** 🛒 - Shopping cart (with badge)
4. **Orders** 📦 - Order history
5. **Profile** 👤 - Account settings

#### Tab Press Behavior:
- **Home**: Reloads to homepage URL and scrolls to top
- **Search**: Scrolls to top
- **Cart**: Reloads cart URL and scrolls to top (refreshes count)
- **Orders**: Reloads orders URL and scrolls to top
- **Profile**: Reloads profile URL and scrolls to top

#### Cart Badge:
- Displays red badge with count when items in cart
- Shows "99+" for 99+ items
- Updates automatically via WebView messages
- Positioned at top-right of cart icon

### 5. Individual Tab Screens

Each tab uses `AppWebView` with:
- Proper WebView ref from `WebViewContext`
- Correct Store URL
- Stack.Screen configuration (headerShown: false)

**Cart Tab Special Behavior**:
- Uses `useFocusEffect` to reload when tab becomes active
- Ensures fresh cart data when user navigates back

## Session & Cookie Management

### Shared Authentication
- All WebViews use `sharedCookiesEnabled={true}`
- Users login once and stay logged in across all tabs
- Session cookies persist between app sessions

### Cookie Settings
- `thirdPartyCookiesEnabled={true}`: Allows payment/checkout cookies
- `incognito={false}`: Preserves session across app restarts
- `cacheEnabled={true}`: Faster page loads

## Navigation Flow

### Deep Linking Scenarios

1. **User clicks "Add to Cart" on product page**
   - Cart count badge updates automatically
   - User stays on product page

2. **User clicks "Checkout" or "View Cart"**
   - WebView detects cart URL
   - App automatically switches to Cart tab
   - Cart page loads with updated items

3. **User clicks "My Orders" or "Account"**
   - App switches to Orders or Profile tab
   - User sees their account page
   - Can navigate freely within account section

4. **User taps active tab**
   - Page reloads to canonical URL
   - Scrolls to top
   - Fresh data loaded

## Technical Details

### WebView Configuration
```typescript
sharedCookiesEnabled={true}
thirdPartyCookiesEnabled={true}
javaScriptEnabled={true}
domStorageEnabled={true}
setSupportMultipleWindows={false}
originWhitelist={['*']}
pullToRefreshEnabled={true}
```

### Message Protocol
Messages from WebView → React Native:

```typescript
// Cart count update
{ type: 'CART_COUNT', count: number }

// Navigation hint for tab switching
{ type: 'ROUTE_HINT', value: 'CART'|'ORDERS'|'PROFILE', url: string }

// Loyalty points detected (best-effort)
{ type: 'LOYALTY_HINT', value: string }
```

### Route Detection Logic
```typescript
/\/products\/cart/i → "cart"
/\/account\/orders/i → "orders"
/\/account(\/|$)/i → "profile"
/\/products/i → "search"
exact match "https://greenhauscc.com/" → "home"
```

## Performance Optimizations

1. **CSS Injection Before Content Load**
   - Prevents white flashes from hidden elements
   - Applied before DOM paint

2. **Polling + Mutation Observer**
   - Cart count: 1.2s intervals + DOM watch
   - Balances freshness vs. performance

3. **Cached WebViews**
   - Each tab maintains its own WebView instance
   - No reload when switching between tabs
   - Faster tab switching

4. **Pull-to-Refresh**
   - Users can manually refresh any page
   - Rebuilds cart count and route hints

## QA Checklist

✅ Home tab loads main homepage (not /products)  
✅ Cart badge shows correct item count  
✅ Adding items updates cart badge within ~2 seconds  
✅ "Checkout" button switches to Cart tab automatically  
✅ Tapping active tab scrolls to top and reloads  
✅ No header/footer/breadcrumb flashes on page load  
✅ Quick-link grid hidden on all pages  
✅ Session persists across all tabs (stay logged in)  
✅ Orders/Profile navigation switches tabs correctly  
✅ External links blocked (only greenhauscc.com allowed)  
✅ Pull-to-refresh works on all tabs  

## Known Limitations

1. **Cart count delay**: 1-2 second delay after add-to-cart (normal for polling)
2. **External links**: Blocked to keep users in-app
3. **Loyalty detection**: Best-effort scraping (may not catch all variants)
4. **Web-only**: No deep linking from external apps yet

## Future Enhancements

- [ ] Real-time cart updates via WebSocket
- [ ] Native share sheet integration
- [ ] Biometric login
- [ ] Apple Pay / Google Pay native integration
- [ ] Push notifications for orders
- [ ] Deep linking from SMS/email
- [ ] Offline mode with cached pages

## Testing Instructions

### Manual Testing
1. **Launch app** - Verify home page loads without header/footer
2. **Browse products** - Add items to cart, verify badge updates
3. **Click checkout** - Should auto-switch to Cart tab
4. **Sign in** - Login on Profile tab, verify persistence
5. **View orders** - Navigate to orders, verify tab switching
6. **Tap active tabs** - Verify scroll-to-top behavior
7. **Pull to refresh** - Verify pages reload properly

### Debug Logging
All navigation and cart updates log to console with emojis:
- 🏠 Home tab events
- 🔍 Search tab events  
- 🛒 Cart events and counts
- 📦 Orders tab events
- 👤 Profile tab events
- 📍 Route detection
- 🔗 URL navigation

### Verification URLs
- Home: `https://greenhauscc.com/`
- Products: `https://greenhauscc.com/products`
- Cart: `https://greenhauscc.com/products/cart`
- Orders: `https://greenhauscc.com/account/orders`
- Profile: `https://greenhauscc.com/account`
