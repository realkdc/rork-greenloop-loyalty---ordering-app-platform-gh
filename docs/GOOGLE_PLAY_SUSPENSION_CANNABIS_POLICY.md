# Google Play Suspension - Cannabis Sales Policy Violation

**Date**: December 21, 2025  
**Status**: App Suspended  
**Reason**: "Facilitates the sale of marijuana products or illegal drugs"  
**Version**: 1.0.13 (versionCode 4)

---

## The Problem

Google Play Store has a **strict prohibition** against apps that facilitate the sale of cannabis/marijuana products, **regardless of state legality**. This is different from Apple's App Store policy.

### What Google Saw

During review, Google's team saw:
- Product listings for cannabis products (e.g., "Pink Cookies - Top Shelf THCa Flower")
- Shopping cart functionality
- Checkout flow with payment processing
- Direct ability to purchase cannabis products through the app

This clearly violates Google Play's **Inappropriate Content and Illegal Activities** policy.

---

## Google Play Policy vs Apple App Store

### Google Play Store ❌
- **Prohibits**: Apps that facilitate the sale of marijuana/cannabis products
- **No exceptions** for state-legal operations
- Policy applies regardless of:
  - State legality
  - Age verification
  - Licensed dispensary status
  - Compliance with local laws

### Apple App Store ✅
- **Allows**: Cannabis apps if they comply with state laws
- Requires:
  - Age restrictions (21+)
  - State-licensed operations
  - Proper age verification
  - Compliance with local regulations
- Your app appears to be approved/pending on iOS ✅

---

## Options Moving Forward

### Option 1: Remove Sales Functionality (Recommended for Google Play)

Convert the Android app to **informational only**:

**Remove:**
- ❌ Shopping cart functionality
- ❌ Checkout/payment processing
- ❌ "Add to Cart" buttons
- ❌ Direct purchase flows

**Keep:**
- ✅ Product browsing/menus
- ✅ Store locator
- ✅ Loyalty program features
- ✅ Account management
- ✅ Order history (read-only)

**Add:**
- ✅ "Purchase on Website" button/link
- ✅ "Order Online at greenhauscc.com" messaging
- ✅ Deep links to website checkout

**Implementation:**
- Detect platform (iOS vs Android) in app code
- Hide cart/checkout UI on Android builds
- Show informational-only interface
- Redirect users to website for purchases

**Trade-offs:**
- ✅ App can be on Google Play
- ❌ Reduced functionality on Android
- ❌ Users must visit website to purchase
- ❌ Split user experience between platforms

---

### Option 2: Android APK Distribution Only

Distribute Android app outside Google Play:

**Methods:**
- Direct download from your website
- APK hosting services
- Email distribution to customers

**Trade-offs:**
- ✅ Full app functionality maintained
- ✅ No policy restrictions
- ❌ No automatic updates
- ❌ Users must enable "Install from unknown sources"
- ❌ Limited discoverability
- ❌ No Google Play reviews/ratings
- ❌ Users may be wary of non-Play Store apps

---

### Option 3: iOS-Only Distribution

Focus on iOS App Store only:

**Trade-offs:**
- ✅ Full functionality
- ✅ Better user experience
- ✅ App Store distribution
- ❌ Excludes Android users (~40% of market)
- ❌ Business decision needed

---

### Option 4: Appeal (Unlikely to Succeed)

You can submit an appeal, but Google's policy is clear and non-negotiable on cannabis sales. Appeals typically succeed only if:
- Policy was incorrectly applied
- App doesn't actually facilitate sales (yours clearly does)
- There was a mistake in review process

**Note:** Your app clearly facilitates sales (shopping cart, checkout, products), so an appeal is very unlikely to succeed.

---

## Recommendation

Given your situation:

1. **Short-term**: Focus on iOS App Store (seems to be working)
2. **Medium-term**: Consider Option 1 (informational Android app) if Android market share is important
3. **Long-term**: Monitor if Google Play policy changes (unlikely in near future)

---

## Implementation Plan (If Choosing Option 1)

### Step 1: Create Platform-Specific Build Config

```typescript
// constants/config.ts
export const PLATFORM_CONFIG = {
  ios: {
    enablePurchases: true,
    showCart: true,
    showCheckout: true,
  },
  android: {
    enablePurchases: false, // Redirect to website
    showCart: false,
    showCheckout: false,
  },
};
```

### Step 2: Modify WebView to Hide Purchase UI on Android

```typescript
// lib/webviewSkin.ts
const platform = Platform.OS;
if (platform === 'android') {
  // Inject CSS/JS to hide cart buttons, checkout, etc.
  // Add "Purchase on Website" buttons instead
}
```

### Step 3: Update App Store Listings

**Android (Google Play):**
- Update description: "Browse products, find stores, manage loyalty account. Purchase products at greenhauscc.com"
- Screenshots: Show browsing, store locator, account features (no cart/checkout)

**iOS (App Store):**
- Keep current description
- Can show full functionality

---

## Policy References

### Google Play Policies
- [Inappropriate Content Policy](https://support.google.com/googleplay/android-developer/answer/9888179)
- [Illegal Activities](https://support.google.com/googleplay/android-developer/answer/9888179#illegal_activities)
- Specific prohibition: "Facilitates the sale of marijuana products or illegal drugs"

### Apple App Store Guidelines
- Guideline 1.1.4: Safety - Physical Harm
- Allows cannabis apps with proper age restrictions and state compliance

---

## Decision Matrix

| Option | Google Play | Full Features | User Experience | Implementation Effort |
|--------|-------------|---------------|-----------------|----------------------|
| **Remove Sales** | ✅ Yes | ❌ Partial | ⚠️ Android limited | Medium |
| **APK Only** | ❌ No | ✅ Full | ⚠️ Installation friction | Low |
| **iOS Only** | ❌ No | ✅ Full | ✅ Good | Low |
| **Appeal** | ⚠️ Unlikely | ✅ Full | ✅ Good | Low (but futile) |

---

## Next Steps

1. **Decide on strategy** based on business needs
2. **If Option 1**: Plan implementation timeline
3. **If Option 2/3**: Set up alternative distribution
4. **Update documentation** with decision
5. **Communicate** to stakeholders about Android limitations

---

## Questions to Consider

1. What percentage of your users are on Android?
2. Is Android market share critical to your business?
3. Would informational-only app on Android provide enough value?
4. Can you redirect Android users to website for purchases?
5. Is iOS-only distribution acceptable long-term?

---

**Last Updated**: December 21, 2025  
**Status**: Awaiting decision on path forward

