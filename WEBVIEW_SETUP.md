# GreenHaus WebView Setup Guide

## Quick Start

The app is fully configured and ready to run. All WebView tabs are wired up with automatic cleanup, cart badge, and native-feeling behavior.

## Architecture

### 1. Config (`config/greenhaus.ts`)
Central configuration for all URLs:
```typescript
import { GREENHAUS, matchRoute } from '@/config/greenhaus';

// Use these constants:
GREENHAUS.home    // Products catalog
GREENHAUS.search  // Product search
GREENHAUS.cart    // Shopping cart
GREENHAUS.orders  // Order history
GREENHAUS.profile // Account page

// Classify URLs:
matchRoute(url) // Returns: "home" | "search" | "cart" | "orders" | "profile" | "other"
```

### 2. WebView Component (`components/WebShell.tsx`)
Drop-in component for all tabs:
```tsx
<WebShell 
  initialUrl={GREENHAUS.home}
  tabKey="home"
/>
```

**Features**:
- Auto-injects cleanup CSS/JS
- Handles safe area insets
- Shares cookies across tabs
- Monitors navigation for auto tab-switching
- Posts cart count to React Native
- Blocks external URLs

### 3. WebView Skin (`lib/webviewSkin.ts`)
Pre-built CSS/JS that gets injected:
- Hides header, footer, breadcrumbs
- Removes quick-links grid at bottom
- Eliminates white gaps
- Extracts cart count from page
- Runs on every page load and DOM change

### 4. Tab Layout (`app/(tabs)/_layout.tsx`)
Bottom navigation configured with:
- Cart badge (auto-updates)
- Scroll-to-top on reselect
- Home tab reloads on reselect
- Debug console logs

## How to Add a New Tab

1. Create file: `app/(tabs)/newtab.tsx`
```tsx
/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
import React from 'react';
import { Stack } from 'expo-router';
import { WebShell } from '@/components/WebShell';
import { GREENHAUS } from '@/config/greenhaus';
export default function NewTabScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'New Tab', headerShown: false }} />
      <WebShell 
        initialUrl="https://greenhauscc.com/new-page"
        tabKey="newtab"
      />
    </>
  );
}
```

2. Add ref to `contexts/WebViewContext.tsx`:
```typescript
const newTabWebViewRef = useRef<WebView>(null);
return {
  // ... existing refs
  newTabWebViewRef,
};
```

3. Add to tab layout `app/(tabs)/_layout.tsx`:
```tsx
<Tabs.Screen
  name="newtab"
  options={{
    title: "New Tab",
    headerShown: false,
    tabBarIcon: ({ color }) => <Icon size={24} color={color} />,
  }}
  listeners={{
    tabPress: () => scrollToTop(newTabWebViewRef),
  }}
/>
```

## Debug Tools

### Debug Menu
In dev builds, tap the 🐛 button (bottom-right) to see:
- Current cart count
- All tab URLs
- Feature documentation
- Navigation behavior

### Console Logs
Tab presses log to console:
```
🏠 Home tab pressed
🔍 Search tab pressed
🛒 Cart tab pressed (count: 3)
```

Navigation events log:
```
Navigation: https://greenhauscc.com/products/cart
→ Switching to Cart tab
```

## Customization

### Modify Cleanup Behavior
Edit `lib/webviewSkin.ts`:
```typescript
export const INJECTED_CSS = `
  /* Add more selectors to hide */
  .my-custom-element { display: none !important; }
`;

export const INJECTED_JS = `
  // Add custom JavaScript
  console.log('Custom script running');
`;
```

### Change Tab URLs
Edit `config/greenhaus.ts`:
```typescript
export const GREENHAUS = {
  home: "https://greenhauscc.com/new-home",
  // ... other URLs
};
```

### Adjust Cart Count Detection
Edit the cart counter script at the top of `components/WebShell.tsx`:
```typescript
const CART_COUNTER_SCRIPT = `
  // Update selectors inside findCartCount()
`;
```

### Modify Auto Tab Switching
Edit the `handleMessage`/`checkNav` logic in `components/WebShell.tsx`:
```typescript
if (msg.type === 'NAVIGATE_TAB') {
  // custom tab routing
}
```

## Common Issues

### Breadcrumbs Still Showing
Add the selector to cleanup in `lib/webviewSkin.ts`:
```typescript
rm('.your-breadcrumb-class');
```

### Footer White Gap
Ensure these are in CSS:
```css
body, .Page, #MainContent { 
  padding-bottom: 0 !important; 
  margin-bottom: 0 !important; 
}
```

### Cart Badge Not Updating
Check console for "🛒 Cart count updated: X" logs. If missing, add your cart count selector to `getCartCount()` in `lib/webviewSkin.ts`.

### External Links Opening
These are blocked by default. To allow specific domains:
```typescript
// components/WebShell.tsx
const handleShouldStartLoad = useCallback((request: any) => {
  const isAllowed = request.url.includes('greenhauscc.com') || 
                    request.url.includes('trusted-domain.com');
  return isAllowed;
}, []);
```

## Testing

### Manual Tests
1. **Cart Badge**: Add item to cart → badge appears
2. **Breadcrumbs**: Navigate to product → no breadcrumbs visible
3. **Footer**: Scroll to bottom → no footer/quick-links
4. **Tab Switch**: Click cart in website → switches to Cart tab
5. **Scroll**: Tap Home tab twice → scrolls to top
6. **Login**: Login in Profile → still logged in on Home tab

### Device Testing
```bash
# Start dev server
bun expo start

# Scan QR code with Expo Go
# Test on real device for accurate cookie/session behavior
```

## Performance Notes

- **WebViews stay mounted**: No reload when switching tabs
- **CSS injected early**: No flash of website header/footer
- **MutationObserver**: Handles SPA navigation automatically
- **Polling**: Cart count updates every 1.5s as fallback

## Resources

- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Injected JS explained: `lib/webviewSkin.DOCUMENTED.js`
- Bridge utilities: `lib/webviewBridge.ts`
- Route matching: `config/greenhaus.ts`
