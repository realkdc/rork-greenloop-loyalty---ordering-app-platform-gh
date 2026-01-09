# Android Push Notification Fix - January 9, 2026

## The Problem

Android push notifications were not working even though:
- iOS push notifications worked fine
- Push tokens were being generated
- Backend registration appeared successful
- Firebase was configured

## Root Cause

**MISSING PERMISSION**: The app was missing the `POST_NOTIFICATIONS` permission required for Android 13+ (API level 33+).

Your app targets Android API 35 (Android 15), which requires explicit runtime permission for notifications. Without this permission in `app.json`, the system blocks all push notifications even if the token is registered.

## What Was Fixed

### 1. Added POST_NOTIFICATIONS Permission

**File**: `app.json`

Added the required notification permission to the Android permissions array:

```json
"android": {
  "permissions": [
    "POST_NOTIFICATIONS",
    "android.permission.POST_NOTIFICATIONS",
    // ... other permissions
  ]
}
```

This permission is mandatory for Android 13 (API 33) and above. Without it:
- Push notifications are silently blocked by the OS
- No error is thrown
- Token registration appears to work but notifications never arrive

## Why It Worked on iOS But Not Android

- **iOS**: Notifications require runtime permission but no manifest changes
- **Android 12 and below**: Notifications granted automatically
- **Android 13+**: Requires explicit `POST_NOTIFICATIONS` permission in manifest AND runtime request

Your code already handles the runtime permission request via `expo-notifications`, but it was missing from the manifest.

## Verification

### Configuration Check

1. **google-services.json**: ✅ Properly configured with `com.greenloop.greenhaus` package
2. **Firebase Project**: ✅ Correct project ID: `greenhaus-app`
3. **Backend Endpoint**: ✅ Working at `https://greenhaus-admin.vercel.app/api/push/register`
4. **Payload Format**: ✅ Sending correct fields: `token`, `deviceOS`, `storeId`, `env`

### Test Script

A test script has been created: `scripts/testAndroidPushNotifications.ts`

Usage:
```bash
npx ts-node scripts/testAndroidPushNotifications.ts "ExponentPushToken[YOUR_TOKEN]" "STORE_ID"
```

This script:
1. Tests backend token registration
2. Validates Firebase configuration
3. Checks app.json permissions
4. Sends a test push notification via Expo API

## How to Build and Deploy

### Option 1: EAS Build (Recommended for Production)

```bash
# Increment version
# Edit app.json: "versionCode": 4

# Build for Google Play
eas build --platform android --profile production

# Once build completes, download and install OR submit to Play Store
eas submit --platform android
```

### Option 2: Local Build (For Testing)

```bash
# Clean previous build
cd android && ./gradlew clean && cd ..

# Build locally
npx expo run:android --variant release

# Or build APK for distribution
cd android && ./gradlew assembleRelease
```

### Option 3: Quick Local Test Build

```bash
# Development build with notification support
npx expo run:android
```

## Testing the Fix

1. **Install the new build** on a physical Android device (Android 13+ recommended)

2. **Check logs** for push token registration:
   ```
   📱 [registerPushToken] Obtained token: ExponentPushToken[...]
   ✅ [registerPushToken] Successfully registered!
   ```

3. **Send a test notification** from the admin dashboard:
   - Go to https://greenhaus-admin.vercel.app/dashboard/broadcast
   - Enter your token (from logs)
   - Send test notification

4. **Verify notification appears** on device lock screen and notification tray

## Common Issues After Fix

### Issue: "No permission to post notifications"
**Solution**: The app needs to request runtime permission. This should happen automatically via the code in `registerPushToken.ts`. If not, check Android settings → Apps → GreenHaus → Notifications are enabled.

### Issue: Token registered but still no notifications
**Possible causes**:
1. Battery optimization killing the app - Disable for GreenHaus
2. Do Not Disturb mode enabled
3. Notification channel disabled - Check Android notification settings
4. Wrong token being used - Use the token from device logs, not an old one

### Issue: "DeviceNotRegistered" error
**Solution**: The token is old/invalid. Uninstall and reinstall the app to generate a fresh token.

## Changes Made

### Files Modified:
1. ✅ `app.json` - Added POST_NOTIFICATIONS permission

### Files Created:
1. ✅ `scripts/testAndroidPushNotifications.ts` - Test script for validation
2. ✅ `ANDROID_PUSH_NOTIFICATION_FIX.md` - This documentation

### Architecture Notes

- **Client**: Uses `expo-notifications` to request permissions and get push tokens
- **Backend**: Deployed at `greenhaus-admin.vercel.app/api` (different from local `backend/hono.ts`)
- **Notification Channel**: Created programmatically with importance MAX in `registerPushToken.ts:116-119`
- **Firebase**: Using Firebase Cloud Messaging (FCM) via Expo's push notification service

## Next Steps

1. **Commit these changes**:
   ```bash
   git add app.json scripts/testAndroidPushNotifications.ts ANDROID_PUSH_NOTIFICATION_FIX.md
   git commit -m "fix(android): add POST_NOTIFICATIONS permission for Android 13+"
   ```

2. **Increment version code** in both:
   - `app.json`: Change `"versionCode": 3` to `"versionCode": 4`
   - `android/app/build.gradle`: Change `versionCode 3` to `versionCode 4`

3. **Build new version**: `eas build --platform android --profile production`

4. **Test on device** before submitting to Play Store

5. **Submit update**: `eas submit --platform android`

## Why This Wasn't Caught Earlier

- The permission requirement is relatively new (Android 13, released 2022)
- Expo handles most permissions automatically, but this one must be explicitly declared
- iOS works differently, so testing only on iOS wouldn't catch this
- The error is silent - notifications just don't arrive with no console errors

## Related Documentation

- [Android 13 notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Expo notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

**Summary**: The fix was simple - add `POST_NOTIFICATIONS` permission to `app.json`. The complexity was in diagnosing why notifications weren't working when everything else looked correct. Android 13+ silently blocks notifications without this permission, even when tokens are registered and the backend is functioning properly.
