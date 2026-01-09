# Android App Versions

This repository contains three different versions of the GreenHaus Android app to handle different distribution channels and comply with Google Play's marijuana policy.

## Branch Overview

| Branch | Purpose | Package Name | Distribution | Shopping Features |
|--------|---------|--------------|--------------|-------------------|
| `ios` | iOS App Store version | `com.greenhauscc.customer` | Apple App Store | ✅ Full shopping |
| `android-sideload` | Android full version | `app.rork.greenlooployaltyorderingplatform` | Sideload / Alternative stores | ✅ Full shopping |
| `android-development` | Android external browser | `app.rork.greenlooployaltyorderingplatform` | Reference/Archive | ⚠️ External browser checkout |
| `android-googleplay` | Google Play compliant | `app.rork.greenhausinfo` | Google Play Store | ❌ No shopping (info only) |

---

## 1. iOS Version (`ios` branch)

**Distribution:** Apple App Store
**Package:** `com.greenhauscc.customer`
**Status:** ✅ Approved for App Store

### Features
- Full product catalog
- Shopping cart
- In-app checkout
- Order history
- Loyalty program

### Build Commands
```bash
git checkout ios
npm install
npx expo run:ios
# or for production
eas build --platform ios
```

---

## 2. Android Sideload Version (`android-sideload` branch)

**Distribution:** Direct APK download / Alternative app stores (not Google Play)
**Package:** `app.rork.greenlooployaltyorderingplatform`
**Status:** For users who want full shopping experience on Android

### Features
- ✅ Full product catalog (Browse tab)
- ✅ Shopping cart
- ✅ In-app checkout
- ✅ Order history
- ✅ Same functionality as iOS

### Why Use This?
- Users can download and install the APK directly
- Full shopping experience without restrictions
- Same package name as original Android app

### Build Commands
```bash
git checkout android-sideload
npm install

# Development build
npx expo run:android

# Production APK
eas build --platform android --profile production

# Or build locally with Gradle
cd android
./gradlew assembleRelease
```

### Installation
Users need to:
1. Enable "Install from Unknown Sources" in Android settings
2. Download the APK from your website
3. Install the APK

---

## 3. Android External Browser Version (`android-development` branch)

**Distribution:** Archive/Reference
**Package:** `app.rork.greenlooployaltyorderingplatform`
**Status:** ⚠️ Not compliant with Google Play - kept for reference

### Features
- Shows product catalog in WebView
- Intercepts "Add to Cart" button clicks
- Opens external browser for checkout
- ❌ Still rejected by Google Play (facilitates marijuana sales)

### Why Keep This?
- Historical reference
- Shows attempted Google Play compliance approach
- May be useful for other projects

### Note
This version was rejected by Google Play because it still shows products and prices, which violates their marijuana policy. Even though checkout happens in external browser, Google considers this "facilitating sales."

---

## 4. Google Play Compliant Version (`android-googleplay` branch)

**Distribution:** Google Play Store
**Package:** `app.rork.greenhausinfo` (NEW package name)
**Status:** 🆕 New app - ready for submission

### Features
- ❌ No product catalog (Browse tab hidden)
- ❌ No shopping cart (Cart tab hidden)
- ❌ No order history (Orders tab hidden)
- ✅ Store information (locations, hours)
- ✅ Contact information
- ✅ Link to website
- ✅ Loyalty program (Account tab)

### Why Compliant?
Google Play's marijuana policy bans ANY app that "facilitates the sale of marijuana or marijuana products, regardless of legality."

This version:
- Shows NO products
- Shows NO prices
- Shows NO add-to-cart buttons
- Shows NO checkout flow
- Is purely informational

### What Users See
**Home Tab:**
- Welcome message
- Store locations and addresses
- Store hours
- "Visit Our Website" button (opens greenhauscc.com in external browser)
- Disclaimer: "This app is for informational purposes only. No purchases can be made through this app."

**Account Tab:**
- User profile
- Loyalty points (viewing only)
- Settings

### Build Commands
```bash
git checkout android-googleplay
npm install

# Development build
npx expo run:android

# Production build for Google Play
eas build --platform android --profile production
```

### Submission to Google Play
1. Create new app listing (not an update to old app)
2. Use package name: `app.rork.greenhausinfo`
3. Emphasize in description:
   - "Informational app only"
   - "No purchases can be made in this app"
   - "Visit our website to shop"
4. Category: Lifestyle or Business
5. Content rating: Mature 17+ or 18+

---

## Configuration Summary

### Platform Config (`constants/config.ts`)

#### iOS & Android Sideload
```typescript
{
  enableCheckout: true,
  showCart: true,
  showBrowse: true,
  showOrders: true,
  allowPurchaseFlow: true,
  informationalOnly: false,
}
```

#### Google Play (Android)
```typescript
{
  enableCheckout: false,
  showCart: false,
  showBrowse: false,
  showOrders: false,
  allowPurchaseFlow: false,
  informationalOnly: true,
}
```

---

## Switching Between Versions

### To build iOS version:
```bash
git checkout ios
npm install
eas build --platform ios
```

### To build Android sideload version (full shopping):
```bash
git checkout android-sideload
npm install
eas build --platform android
```

### To build Google Play version (info only):
```bash
git checkout android-googleplay
npm install
eas build --platform android
```

---

## Package Names

**IMPORTANT:** Each version must maintain its package name:

| Branch | Package Name | Why |
|--------|--------------|-----|
| `ios` | `com.greenhauscc.customer` | App Store listing |
| `android-sideload` | `app.rork.greenlooployaltyorderingplatform` | Continuity for existing sideload users |
| `android-googleplay` | `app.rork.greenhausinfo` | NEW - Google Play requires new listing after suspension |

---

## Recommendation

1. **iOS users:** Continue with App Store version (`ios` branch)
2. **Android users who want full shopping:** Distribute sideload version (`android-sideload` branch) via your website
3. **Google Play presence:** Submit informational version (`android-googleplay` branch) as NEW app

---

## Google Play Policy Reference

From Google Play's [Restricted Content Policy](https://support.google.com/googleplay/android-developer/answer/9878810):

> "Apps that facilitate the sale of marijuana, marijuana products, or marijuana paraphernalia are not allowed on Google Play. This includes apps that: facilitate the sale of marijuana, marijuana products, or marijuana paraphernalia regardless of legality."

Even if checkout happens outside the app, showing products with prices is considered "facilitating sales."

---

## Questions?

- iOS version works fine → Keep using it
- Need Android app on Google Play → Use `android-googleplay` (info only)
- Want full Android shopping → Distribute `android-sideload` as APK download

The sideload version is recommended for your actual customers, while the Google Play version gives you visibility in the Play Store for discovery.
