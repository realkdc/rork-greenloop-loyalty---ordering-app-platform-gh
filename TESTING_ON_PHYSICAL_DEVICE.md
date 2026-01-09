# Testing on Physical Android Device - Google Play Build v1.0.15

## Version Information
- **Version Name**: 1.0.15
- **Version Code**: 5
- **Package**: com.greenloop.greenhaus
- **Build Date**: January 9, 2026

## Prerequisites

1. **Physical Android device** (Android 13+ recommended for full testing)
2. **USB cable** to connect device to computer
3. **Enable Developer Options on your Android device:**
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times until it says "You are now a developer"
   - Go back to Settings > System > Developer Options
   - Enable "USB Debugging"

4. **Install ADB (Android Debug Bridge):**
   - If you have Android Studio, it's already installed
   - Or install via Homebrew: `brew install android-platform-tools`
   - Verify: `adb --version`

---

## Method 1: Quick Testing with Expo (Recommended for Initial Testing)

This method is fastest for quick testing and iteration.

### Step 1: Connect Your Device
```bash
# Connect your Android device via USB

# Verify device is connected
adb devices
# You should see your device listed
```

### Step 2: Run Development Build
```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp

# Start the development build
npx expo run:android
```

**What this does:**
- Installs the app on your connected device
- Starts Metro bundler for hot reload
- Opens the app automatically

### Step 3: Test the Features
See "Testing Checklist" section below.

---

## Method 2: Build Production APK (Recommended Before Google Play Submission)

This creates a production-ready APK that's identical to what users will get from Google Play.

### Option A: Using EAS Build (Easiest, Cloud-Based)

```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp

# Build a preview APK (production-like but for testing)
eas build --platform android --profile preview

# Wait for build to complete (5-10 minutes)
# You'll get a URL to download the APK

# Download the APK to your computer
# Then install it on your device:
adb install -r ~/Downloads/build-xxxxx.apk
```

### Option B: Local Gradle Build

```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp

# Clean previous builds
cd android && ./gradlew clean && cd ..

# Build the release APK
cd android && ./gradlew assembleRelease && cd ..

# The APK will be at:
# android/app/build/outputs/apk/release/app-release.apk

# Install on connected device
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

**Note:** If you get signing errors, the APK uses debug signing which is fine for testing.

---

## Method 3: Build for Google Play Store (Final Step)

This creates an App Bundle (.aab) for Google Play submission.

```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp

# Build production App Bundle
eas build --platform android --profile production

# Wait for build to complete
# Download the .aab file when ready

# You CANNOT install .aab files directly on devices
# .aab files are only for uploading to Google Play Console
```

---

## Testing Checklist

### ✅ 1. Browse Tab Testing (Most Important)

**Expected Behavior:**
- Browse tab is visible in bottom navigation
- Products are visible
- **ALL prices are hidden** (no $XX.XX anywhere)
- **No "Add to Cart" buttons visible**
- Users can browse/view product details
- Clicking a product shows details (but no prices/buy buttons)

**Test Steps:**
1. Open app, tap Browse tab
2. Scroll through products
3. Look for ANY prices - there should be NONE
4. Look for "Add to Cart" or "Buy Now" buttons - there should be NONE
5. Tap on a product to view details
6. Confirm no prices/buttons on detail page either

**If you see prices or buy buttons:** This is a CRITICAL ISSUE and will get rejected by Google Play.

---

### ✅ 2. Cart Tab Testing

**Expected Behavior:**
- Cart tab should be **completely hidden** from navigation
- No way to access cart in the app

**Test Steps:**
1. Look at bottom navigation bar
2. Confirm there are only 3 tabs: Home, Browse, Account
3. Confirm Cart tab is NOT visible

---

### ✅ 3. Orders Tab Testing

**Expected Behavior:**
- Orders tab should be **completely hidden** from navigation

**Test Steps:**
1. Look at bottom navigation bar
2. Confirm Orders tab is NOT visible
3. Only visible tabs: Home, Browse, Account

---

### ✅ 4. Checkout Blocking Testing

**Expected Behavior:**
- If user somehow triggers cart/checkout, external browser opens

**Test Steps:**
1. Try to find any way to add items to cart (there shouldn't be)
2. If any checkout-related action is triggered, external browser should open to greenhauscc.com

---

### ✅ 5. Push Notifications Testing

**Expected Behavior:**
- App should request notification permission on first launch
- Notifications should work normally

**Test Steps:**
1. Fresh install of app
2. Grant notification permission when prompted
3. Check Android logcat for token registration:
   ```bash
   adb logcat | grep -i "push\|notification\|token"
   ```
4. Look for: `[registerPushToken] Successfully registered!`
5. Send a test notification from admin dashboard
6. Verify notification appears on device

**If notifications don't work:**
- Check Settings > Apps > GreenHaus > Notifications are enabled
- Check that POST_NOTIFICATIONS permission was granted

---

### ✅ 6. Home Tab Testing

**Expected Behavior:**
- Shows store information
- Shows welcome message
- No products or prices
- May show categories (hidden: Disposables, Cartridges, Vapes)

**Test Steps:**
1. Open app to Home tab
2. Scroll through content
3. Confirm no vape-related categories visible
4. Confirm no prices anywhere

---

### ✅ 7. Account Tab Testing

**Expected Behavior:**
- User can log in
- Loyalty points are visible
- Profile information accessible
- No order history

**Test Steps:**
1. Tap Account tab
2. Log in if needed
3. View loyalty points
4. Confirm no order history section

---

### ✅ 8. iOS Comparison Testing (Optional)

If you have an iOS device, verify iOS version still has full functionality:
- Browse tab shows prices
- Cart tab is visible
- Add to cart works
- Checkout works
- Order history visible

This confirms the changes only affect Android.

---

## Common Issues & Solutions

### Issue: `adb: command not found`
**Solution:** Install Android platform tools:
```bash
brew install android-platform-tools
```

### Issue: Device not showing in `adb devices`
**Solutions:**
1. Enable USB Debugging in Developer Options
2. Tap "Allow USB Debugging" popup on your phone
3. Try different USB cable or port
4. Restart adb: `adb kill-server && adb start-server`

### Issue: App crashes on launch
**Solutions:**
1. Check logcat for errors: `adb logcat | grep -i error`
2. Clear app data: Settings > Apps > GreenHaus > Clear Data
3. Uninstall and reinstall: `adb uninstall com.greenloop.greenhaus`

### Issue: Metro bundler errors with `npx expo run:android`
**Solutions:**
1. Clear Metro cache: `npx expo start --clear`
2. Clean node_modules: `rm -rf node_modules && npm install`
3. Clear watchman: `watchman watch-del-all`

### Issue: Build fails with Gradle
**Solutions:**
1. Clean build: `cd android && ./gradlew clean && cd ..`
2. Check Java version: `java -version` (should be 17 or 11)
3. Clear Gradle cache: `cd android && ./gradlew cleanBuildCache && cd ..`

### Issue: Prices still showing on Android
**Critical Issue - Must Fix:**
1. Check [app/(tabs)/search.tsx](app/(tabs)/search.tsx) - price hiding code
2. Check [constants/config.ts](constants/config.ts) - `allowPurchaseFlow: false`
3. Check Platform.OS detection is working: add logs
4. Rebuild app completely

---

## Viewing Logs

### View All Logs
```bash
adb logcat
```

### Filter for Specific Logs
```bash
# Push notifications
adb logcat | grep -i "push\|notification"

# Android compliance/blocking
adb logcat | grep -i "android\|blocker\|compliance"

# General app logs
adb logcat | grep -i "greenhaus\|greenhauscc"

# React Native logs
adb logcat *:S ReactNative:V ReactNativeJS:V
```

### Clear Logs
```bash
adb logcat -c
```

---

## After Testing - Next Steps

### If Everything Passes:

1. **Build for Google Play:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Wait for build to complete** (download the .aab file)

3. **Upload to Google Play Console:**
   - Go to https://play.google.com/console
   - Select your app
   - Production > Create new release
   - Upload the .aab file
   - Version: 1.0.15 (5)
   - Release notes:
     ```
     - Updated for Google Play compliance
     - Browse products without purchase functionality
     - App is informational only
     - Push notification improvements
     ```

4. **Wait for Google Review** (usually 1-3 days)

### If Issues Found:

1. **Document the issue** (screenshots, logs)
2. **Fix the issue** in code
3. **Test again** with Method 1 (Quick Testing)
4. **Repeat until all tests pass**
5. **Then proceed with Google Play build**

---

## Quick Reference Commands

```bash
# Connect and verify device
adb devices

# Install APK
adb install -r path/to/app.apk

# Uninstall app
adb uninstall com.greenloop.greenhaus

# View logs
adb logcat | grep -i "push\|notification\|android"

# Clear logs
adb logcat -c

# Quick test build (Method 1)
npx expo run:android

# Production APK (Method 2)
cd android && ./gradlew assembleRelease && cd ..
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Google Play build (Method 3)
eas build --platform android --profile production
```

---

## Important Reminders

⚠️ **DO NOT SUBMIT TO GOOGLE PLAY** until:
- All tests pass on physical device
- Confirmed NO prices visible
- Confirmed NO add-to-cart buttons
- Confirmed Cart/Orders tabs are hidden
- Push notifications work

✅ **Version is ready:** v1.0.15 (build 5)
✅ **All changes committed:** Ready for deployment

---

## Questions or Issues?

If you encounter any issues during testing:
1. Check the "Common Issues & Solutions" section above
2. Review logs with `adb logcat`
3. Test on a fresh install (uninstall/reinstall)
4. Document the exact steps to reproduce the issue
