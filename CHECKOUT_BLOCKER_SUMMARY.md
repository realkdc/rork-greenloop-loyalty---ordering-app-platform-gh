# Android Checkout Blocker - Implementation Summary

## Problem
Google Play suspended the app because checkout was happening in-app. Need to redirect to external browser instead.

## Root Cause
Ecwid (the e-commerce platform) uses **hash-based routing** (`#cart`, `#!/checkout`) which doesn't trigger React Native's navigation events (`onShouldStartLoadWithRequest`). This is why normal URL blocking doesn't work.

## Solution Implemented

### 1. Pre-Load Hash Blocker (WebShell.tsx:3750-3776)
Hijacks `window.location.hash` setter BEFORE page loads to intercept Ecwid's hash navigation.

### 2. Navigation Blocker (WebShell.tsx:3363-3401)
Three-layer protection at React Native level for any URL-based navigation.

### 3. Message Handler (WebShell.tsx:2480-2492)
Handles `OPEN_EXTERNAL_URL` messages from WebView and opens external browser via `Linking.openURL()`.

## Code Locations

- **Hash blocker**: `components/WebShell.tsx` lines 3750-3776 (in `injectedJavaScriptBeforeContentLoaded`)
- **Message handler**: `components/WebShell.tsx` lines 2480-2492
- **Navigation blocker**: `components/WebShell.tsx` lines 3363-3401 (in `handleShouldStartLoadWithRequest`)
- **Config**: `constants/config.ts` line 71 (`allowPurchaseFlow: false`)

## How It Works

1. When page loads, pre-load script hijacks `window.location.hash`
2. When Ecwid tries to navigate to `#cart` or `#!/checkout`, the setter intercepts it
3. Posts message to React Native: `{type: 'OPEN_EXTERNAL_URL', url: 'https://greenhauscc.com/products/cart'}`
4. React Native receives message and calls `Linking.openURL()` to open external browser
5. In-app navigation is blocked (returns early from setter)

## Testing

To test if it's working, check Android logcat for these messages:
```
[PRELOAD] ✅ Hash blocker installed
[PRELOAD] 🚫 BLOCKED hash = #cart
[WebShell:home] ✅ OPEN_EXTERNAL_URL detected!
[WebShell:home] ✅ Linking.openURL SUCCESS
```

## Current Status

Code is implemented but not confirmed working due to Metro connection issues during testing.

## Next Steps

1. Build a **production APK** (not dev) to avoid Metro connection issues:
   ```bash
   cd android
   ./gradlew assembleRelease
   # APK will be in: android/app/build/outputs/apk/release/
   ```

2. Install on device:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release-unsigned.apk
   ```

3. Test by clicking "Go to Checkout" - external browser should open

## Alternative: EAS Build

If local builds keep having issues, use EAS to build:
```bash
eas build --platform android --profile preview
```

This creates a production-like build without Metro/dev dependencies.
