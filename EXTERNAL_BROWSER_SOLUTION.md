# External Browser Solution - Status & Next Steps

## Problem
Google Play suspended the app because checkout happens in-app. Need to open external browser (Chrome) when user clicks "Go to Checkout" instead of allowing checkout within the WebView.

## What We Tried (All Failed)

### 1. ❌ `Linking.openURL()`
- **Result**: Opens Custom Tabs (looks like in-app browser)
- **Why it failed**: React Native's Linking API always uses Custom Tabs on Android

### 2. ❌ `expo-web-browser` with `createTask: false`
- **Result**: Still opens Custom Tabs
- **Why it failed**: This option doesn't force external browser, just controls task behavior

### 3. ❌ Intent URL scheme (`intent://...`)
- **Result**: Still opens Custom Tabs
- **Why it failed**: React Native's Linking.openURL() intercepts and uses Custom Tabs regardless

### 4. ⏳ Custom Native Android Module (In Progress)
- **Status**: Created but not tested yet
- **Files**:
  - `android/app/src/main/java/app/rork/greenlooployaltyorderingplatform/ExternalBrowserModule.kt`
  - `android/app/src/main/java/app/rork/greenlooployaltyorderingplatform/ExternalBrowserPackage.kt`
  - Updated `MainApplication.kt` to register the package
  - Updated `components/WebShell.tsx` to use the native module

## The ONLY Solution That Will Work

Create a native Android module that uses these specific Intent flags:

```kotlin
val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
intent.addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
intent.addCategory(Intent.CATEGORY_BROWSABLE)
```

This forces Android to open the URL in the **default browser app** (Chrome/Firefox/etc.) as a completely separate app task.

## Current Implementation

### Native Module Created
- ✅ `ExternalBrowserModule.kt` - Native module with proper Intent flags
- ✅ `ExternalBrowserPackage.kt` - Package to register the module
- ✅ `MainApplication.kt` - Registered the package
- ✅ `WebShell.tsx` - Updated to use `NativeModules.ExternalBrowser.openURL()`

### Next Steps to Complete

1. **Clean build** (native code changed):
   ```bash
   cd android
   ./gradlew clean
   cd ..
   npm run android
   ```

2. **Verify native module loads**:
   - Check logs for native module registration
   - Add console.log in WebShell to confirm `ExternalBrowser` is available

3. **Test**:
   - Click "Go to Checkout" on product page
   - Should see app minimize and Chrome open as separate app

## Why Custom Tabs Keep Appearing

Custom Tabs is Android's default in-app browser system. It's designed to keep users in your app. The ONLY way to bypass it is:

1. Use native Android code (not React Native APIs)
2. Set `FLAG_ACTIVITY_NEW_TASK` flag on Intent
3. Don't use any React Native Linking or WebBrowser APIs

## Files Modified

1. `components/WebShell.tsx` - Uses `NativeModules.ExternalBrowser`
2. `android/app/src/main/java/.../ExternalBrowserModule.kt` - NEW
3. `android/app/src/main/java/.../ExternalBrowserPackage.kt` - NEW
4. `android/app/src/main/java/.../MainApplication.kt` - Added package registration

## How to Test the Fix

1. Rebuild: `npm run android`
2. Open app, go to Browse tab
3. Click any product
4. Click "Go to Checkout" button
5. **Expected**: App minimizes, Chrome opens to greenhauscc.com/products/cart
6. **NOT Expected**: Custom Tabs overlay or in-app browser

## If It Still Doesn't Work

The native module might not be loading. Check:
- Logcat for module registration errors
- Add `console.log('ExternalBrowser available:', !!ExternalBrowser)` in WebShell
- Ensure clean build was done after adding native code
