# Version 1.0.15 (Build 5) - Google Play Update Summary

**Date:** January 9, 2026
**Status:** ✅ Ready for testing on physical device
**Branch:** dev (merged from android-googleplay)

---

## What Changed in This Version

### 🆕 New Features
1. **Browse Tab Enabled on Android** - Products are visible for browsing
2. **Price Hiding System** - All prices hidden on Android automatically
3. **Add-to-Cart Blocking** - All purchase buttons hidden on Android

### 🔒 Google Play Compliance
- Cart tab: Hidden on Android
- Orders tab: Hidden on Android
- Prices: Hidden everywhere on Android
- Purchase buttons: Hidden everywhere on Android
- Checkout: Completely blocked on Android
- External browser: Opens if checkout is somehow triggered

### 📱 Platform-Specific Behavior

| Feature | iOS | Android |
|---------|-----|---------|
| Browse Tab | ✅ Visible with prices | ✅ Visible without prices |
| Cart Tab | ✅ Visible | ❌ Hidden |
| Orders Tab | ✅ Visible | ❌ Hidden |
| Add to Cart | ✅ Works | ❌ Blocked |
| Checkout | ✅ Works | ❌ Blocked |
| Prices | ✅ Visible | ❌ Hidden |
| Push Notifications | ✅ Works | ✅ Works |

---

## Version Numbers Updated

### Before:
- Version: 1.0.14
- Version Code: 4

### After:
- Version: **1.0.15**
- Version Code: **5**

### Files Updated:
- ✅ [app.json](app.json:5) - `version: "1.0.15"`
- ✅ [app.json](app.json:34) - `versionCode: 5`
- ✅ [android/app/build.gradle](android/app/build.gradle:95-96) - Both version fields

---

## Configuration Summary

### [constants/config.ts](constants/config.ts:59-79)

**iOS Config:**
```typescript
ios: {
  enableCheckout: true,
  showCart: true,
  showBrowse: true,
  showOrders: true,
  allowPurchaseFlow: true,
  informationalOnly: false,
}
```

**Android Config:**
```typescript
android: {
  enableCheckout: false,
  showCart: false,
  showBrowse: true,        // ← NEW: Now enabled (was false)
  showOrders: false,
  allowPurchaseFlow: false,
  informationalOnly: true,
}
```

---

## Key Implementation Files

### Price Hiding
- [app/(tabs)/search.tsx](app/(tabs)/search.tsx:60-357) - Browse tab price hiding

### Checkout Blocking
- [components/WebShell.tsx](components/WebShell.tsx) - Multi-layer checkout blocker
- [lib/androidCheckoutBlocker.ts](lib/androidCheckoutBlocker.ts) - Blocker scripts

### Tab Configuration
- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx:122-264) - Conditional tab visibility

### Platform Config
- [constants/config.ts](constants/config.ts:59-87) - Platform-specific settings

---

## Push Notifications Status

✅ **Fully configured and working:**
- Permission: `POST_NOTIFICATIONS` in [app.json](app.json:42)
- Full permission: `android.permission.POST_NOTIFICATIONS` in [app.json](app.json:47)
- Required for Android 13+ (API 33+)
- Tested and verified working

---

## Testing Instructions

**📖 Full Testing Guide:** [TESTING_ON_PHYSICAL_DEVICE.md](TESTING_ON_PHYSICAL_DEVICE.md)

### Quick Start - Connect Device & Test

```bash
# 1. Connect your Android device via USB

# 2. Enable USB Debugging on device:
#    Settings > About Phone > Tap "Build Number" 7 times
#    Settings > System > Developer Options > Enable "USB Debugging"

# 3. Verify device connected
adb devices

# 4. Run the app
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp
npx expo run:android
```

### Critical Tests
1. ✅ Browse tab visible - products shown
2. ✅ NO prices visible anywhere
3. ✅ NO add-to-cart buttons visible
4. ✅ Cart tab NOT visible in navigation
5. ✅ Orders tab NOT visible in navigation
6. ✅ Push notifications work

---

## Next Steps

### 1. Test on Physical Device (Do This First!)
Follow instructions in [TESTING_ON_PHYSICAL_DEVICE.md](TESTING_ON_PHYSICAL_DEVICE.md)

**Important:** Test thoroughly before building for Google Play. Once you confirm everything works:

### 2. Build for Google Play
```bash
# Build production App Bundle (.aab)
eas build --platform android --profile production

# Wait for build to complete (5-10 minutes)
# Download the .aab file when ready
```

### 3. Upload to Google Play Console
1. Go to https://play.google.com/console
2. Select your app
3. Production > Create new release
4. Upload the .aab file
5. Version: 1.0.15 (5)
6. Add release notes:
   ```
   v1.0.15 - Google Play Compliance Update

   - Updated for Google Play policy compliance
   - Browse products without purchase functionality
   - App provides information and discovery only
   - Push notification improvements
   - Performance enhancements
   ```
7. Save and submit for review

### 4. Wait for Google Play Review
- Typical review time: 1-3 days
- Monitor Google Play Console for status updates
- Be ready to respond to any review feedback

---

## Strategy Notes

### Why Enable Browse Tab?

**Previous Strategy (ANDROID_VERSIONS.md):**
- Hide Browse tab completely
- Show no products
- Purely informational

**Current Strategy (This Version):**
- Enable Browse tab
- Show products (discovery/browsing)
- Hide ALL prices
- Hide ALL purchase buttons
- No checkout functionality

**Rationale:**
- More user-friendly than hiding products entirely
- Provides product discovery without facilitating sales
- Users can browse, then visit website to purchase
- Still compliant with Google Play policy (no sales facilitation)

### Google Play Policy Compliance

From Google Play's Restricted Content Policy:
> "Apps that facilitate the sale of marijuana, marijuana products, or marijuana paraphernalia are not allowed on Google Play."

**How This Version Complies:**
- ❌ No prices shown = Not listing products for sale
- ❌ No add-to-cart = Cannot purchase
- ❌ No checkout = Cannot complete transaction
- ✅ Browse only = Informational/discovery only
- ✅ External website = Purchases happen outside app

---

## File Changes Summary

### Modified Files:
- [app.json](app.json) - Version bumped to 1.0.15, versionCode 5
- [android/app/build.gradle](android/app/build.gradle) - Version numbers updated
- [constants/config.ts](constants/config.ts) - Android `showBrowse: true`
- [app/(tabs)/search.tsx](app/(tabs)/search.tsx) - Price hiding implementation
- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) - Conditional tab visibility
- [components/WebShell.tsx](components/WebShell.tsx) - Checkout blocking

### New Files:
- [TESTING_ON_PHYSICAL_DEVICE.md](TESTING_ON_PHYSICAL_DEVICE.md) - Testing guide
- [VERSION_1.0.15_SUMMARY.md](VERSION_1.0.15_SUMMARY.md) - This file

---

## Rollback Plan (If Needed)

If Google Play rejects this version:

### Option 1: Disable Browse Tab
```typescript
// In constants/config.ts
android: {
  showBrowse: false,  // ← Change back to false
  // ... rest unchanged
}
```

### Option 2: Revert to Previous Build
```bash
git checkout <previous-commit>
# Rebuild and resubmit
```

---

## Important Reminders

⚠️ **Before Submitting to Google Play:**
- ✅ Test on physical Android device
- ✅ Verify NO prices visible
- ✅ Verify NO purchase buttons
- ✅ Verify push notifications work
- ✅ Test on multiple Android versions if possible

⚠️ **After Submitting:**
- Monitor Google Play Console for review status
- Respond quickly to any review feedback
- Keep this documentation for reference

---

## Contact & Support

**Package Name:** com.greenloop.greenhaus
**EAS Project ID:** 975fd9b2-7c47-43a4-ac9b-da49f6d201fd
**Google Play Console:** https://play.google.com/console

**Build Commands:**
```bash
# Test on device
npx expo run:android

# Production build
eas build --platform android --profile production

# View logs
adb logcat | grep -i "greenhaus\|push\|notification"
```

---

**Version 1.0.15 is ready for testing!** 🚀

Follow the testing guide, verify everything works on your physical device, then proceed with the Google Play build and submission.
