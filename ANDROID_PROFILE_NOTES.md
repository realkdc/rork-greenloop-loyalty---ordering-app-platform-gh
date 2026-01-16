# Android Profile Implementation Notes

Based on the `android-googleplay` branch, here are key differences for the profile/rewards page:

## Google Play Compliance Features

The Android version includes **informational-only mode** for Google Play compliance:

### Blocked Navigation (Google Play)
```typescript
const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
  const url = request.url || '';

  if (platformConfig.informationalOnly) {
    // Allow account page and auth-related pages
    if (url.includes('/account') || url.includes('greenhauscc.com/') && !url.includes('/products')) {
      return true;
    }

    // Block cart, checkout, product pages
    const blockedPaths = [
      '/cart',
      '/checkout',
      '/products',
      '/place-order',
      '/payment',
      '#!/cart',
      '#!/checkout',
      '#!/product'
    ];

    if (blockedPaths.some(path => url.toLowerCase().includes(path))) {
      console.log('[Profile] Blocked navigation to transactional page:', url);
      return false;
    }
  }

  return true;
}, [platformConfig.informationalOnly]);
```

### Shopping Button Hiding (Google Play)
In the injected script, the Android version hides shopping-related buttons:

```javascript
if (isAndroidGooglePlay) {
  // Block links and buttons that navigate to shopping
  document.querySelectorAll('a, button').forEach(el => {
    const text = (el.textContent || '').toLowerCase();
    const href = (el.getAttribute('href') || '').toLowerCase();

    if (
      text.includes('start shopping') ||
      text.includes('shop now') ||
      text.includes('browse') ||
      text.includes('continue shopping') ||
      text.includes('view products') ||
      text.includes('shop our') ||
      href.includes('/products') ||
      href.includes('/shop') ||
      href.includes('/browse') ||
      href.includes('/catalog') ||
      href.includes('#!/products') ||
      href.includes('#!/shop')
    ) {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    }
  });
}
```

## iOS Implementation Differences

For the iOS app, we should **NOT** implement Google Play restrictions:

### ✅ iOS Should Allow:
- Shopping/browsing buttons
- Product page navigation
- Cart and checkout access
- Full e-commerce functionality

### ✅ iOS Should Keep:
- Magic link login flow (same as Android)
- Email extraction (same as Android)
- Lightspeed customer lookup (same as Android)
- Account management features (same as Android)
- Analytics tracking (same as Android)

## Recommendations for iOS Profile Page

### Current Implementation (Correct)
Your iOS profile page already has the right approach:
1. Full webview access to all Lightspeed pages
2. No shopping restrictions
3. Magic link authentication
4. Email extraction for analytics
5. Customer segmentation via Lightspeed lookup

### Don't Add from Android:
- ❌ `informationalOnly` mode
- ❌ Shopping button hiding
- ❌ Product page blocking
- ❌ `handleShouldStartLoadWithRequest` restrictions

### Do Keep Similar to Android:
- ✅ Magic link detection and banner
- ✅ Email extraction logic
- ✅ User login event tracking
- ✅ Account deletion request flow
- ✅ Loading timeouts and error handling

## Platform Configuration

If you want to share code between platforms, use platform detection:

```typescript
import { getPlatformConfig } from "@/constants/config";

const platformConfig = getPlatformConfig();

// Then use platformConfig.informationalOnly for Android-specific logic
if (platformConfig.informationalOnly) {
  // Google Play restrictions
} else {
  // iOS full functionality
}
```

## Key Takeaway

**iOS = Full E-commerce Experience**
- Users can shop, add to cart, checkout
- Profile page is just one part of the shopping experience

**Android Google Play = Informational Only** (if required)
- Users can view account, loyalty info
- Cannot make purchases through the app
- Must use website for transactions

Your iOS implementation is already correct and doesn't need the Android restrictions!
