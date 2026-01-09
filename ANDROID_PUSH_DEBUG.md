# Android Push Notification Debug Guide
**Date:** January 9, 2026
**Status:** Investigating why notifications still don't work after adding POST_NOTIFICATIONS permission

## Current Status

### What We've Fixed:
1. ✅ **POST_NOTIFICATIONS permission** added to AndroidManifest.xml (via `npx expo prebuild --clean`)
2. ✅ **Firebase Messaging** dependency confirmed (v24.0.1 via expo-notifications)
3. ✅ **google-services.json** properly configured with package `com.greenloop.greenhaus`
4. ✅ **Google Services plugin** applied in build.gradle

### The Problem:
- iOS notifications work fine
- Push tokens are being generated on Android
- Notifications are NOT being received on your physical Android test device (no SIM, WiFi only, downloaded from Google Play Store)

## Possible Root Causes

### 1. **App Downloaded from Play Store is an Old Build**
The most likely issue is that your current Play Store build was created BEFORE we ran `npx expo prebuild --clean` to add the POST_NOTIFICATIONS permission to AndroidManifest.xml.

**Solution:** Build and install a NEW version locally or submit a new build to Play Store.

### 2. **Runtime Permission Not Granted**
Even with the manifest permission, Android 13+ requires explicit runtime permission from the user.

**Check:**
- Go to Android Settings → Apps → GreenHaus → Notifications
- Ensure "All GreenHaus notifications" is turned ON
- Check that individual notification categories are enabled

### 3. **Battery Optimization Killing Background Process**
Android may be killing the app's background process, preventing FCM from delivering notifications.

**Solution:**
- Go to Android Settings → Apps → GreenHaus → Battery
- Select "Unrestricted" battery usage

### 4. **Google Play Services Issues**
FCM requires Google Play Services to be installed and up-to-date.

**Check:**
- Ensure Google Play Services is installed and updated
- Check if Play Services is restricted for the app

### 5. **Wrong Token Being Used**
The token registered might be from an old build or different environment.

**Solution:**
- Completely uninstall the app
- Reinstall fresh build
- Copy the NEW token from device logs
- Use that exact token to send test notification

## Testing Steps

### Step 1: Build Fresh APK with Latest Changes

```bash
# Option A: Local debug build (fastest for testing)
npx expo run:android

# Option B: Local release build
cd android && ./gradlew assembleRelease && cd ..
# APK will be at: android/app/build/outputs/apk/release/app-release.apk

# Option C: EAS build for Play Store
eas build --platform android --profile production
```

### Step 2: Install Fresh Build on Device

```bash
# If using local build, install via ADB
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Or download from EAS build and install manually
```

### Step 3: Enable All Permissions

1. Open the app
2. When prompted for notification permission, tap "Allow"
3. Go to Android Settings → Apps → GreenHaus
4. Verify:
   - ✅ Notifications: ON
   - ✅ Battery: Unrestricted
   - ✅ All permissions granted

### Step 4: Get Fresh Token

```bash
# Connect device via USB
adb logcat | grep "registerPushToken"

# Look for logs like:
# 📱 [registerPushToken] Obtained token: ExponentPushToken[xxxxxx]
# ✅ [registerPushToken] Successfully registered!
```

### Step 5: Send Test Notification

Go to your admin dashboard:
https://app.greenloop.dev/dashboard/broadcast

OR use the test script:
```bash
npx ts-node scripts/testAndroidPushNotifications.ts "ExponentPushToken[YOUR_TOKEN_HERE]" "greenhaus-tn-crossville"
```

### Step 6: Check Device Logs

```bash
# Watch for notification-related logs
adb logcat | grep -E "Notifications|FCM|Expo|GCM"

# Look for errors like:
# - "NotificationManager: notify: id corrupted"
# - "FirebaseMessaging: Missing notification permission"
# - "ExpoNotifications: Failed to show notification"
```

## Common Issues & Solutions

### Issue: Permission popup never appears
**Cause:** App might not be requesting permission properly
**Solution:** Check that `Notifications.requestPermissionsAsync()` is being called in your code (it is in registerPushToken.ts:92)

### Issue: "No such module: expo-notifications"
**Cause:** Using Expo Go instead of a development build
**Solution:** Build a custom development client with `npx expo run:android`

### Issue: Token generates but notifications never arrive
**Causes:**
1. ❌ Using old token from previous build
2. ❌ Battery optimization enabled
3. ❌ Do Not Disturb mode active
4. ❌ Notification channel disabled
5. ❌ Google Play Services not working

**Solutions:**
1. Uninstall and reinstall to get fresh token
2. Disable battery optimization for GreenHaus
3. Turn off Do Not Disturb
4. Check notification channel settings
5. Update Google Play Services

### Issue: Works in debug but not release
**Cause:** Different signing certificates or Firebase configuration
**Solution:** Ensure google-services.json matches the package name and signing certificate

## Verification Checklist

Before sending test notifications, verify:

- [ ] Fresh build installed (versionCode 5 or higher)
- [ ] POST_NOTIFICATIONS in AndroidManifest.xml (line 6)
- [ ] Runtime notification permission granted (Android Settings → Apps → GreenHaus → Notifications: ON)
- [ ] Battery optimization disabled (Android Settings → Apps → GreenHaus → Battery: Unrestricted)
- [ ] Fresh push token obtained from device logs
- [ ] Token successfully registered with backend
- [ ] google-services.json package matches app package: `com.greenloop.greenhaus`
- [ ] Device has internet connectivity (WiFi is fine, no SIM needed)
- [ ] Google Play Services installed and updated

## Debug Commands

```bash
# Check if app is installed
adb shell pm list packages | grep greenloop

# Check app permissions
adb shell dumpsys package com.greenloop.greenhaus | grep permission

# Check if POST_NOTIFICATIONS is granted
adb shell dumpsys package com.greenloop.greenhaus | grep POST_NOTIFICATIONS

# Check notification settings
adb shell dumpsys notification | grep com.greenloop.greenhaus

# View live logs
adb logcat -c && adb logcat | grep -E "registerPushToken|Notifications|FCM"

# Check Google Play Services
adb shell dumpsys package com.google.android.gms | grep version
```

## Next Steps

1. **Build a fresh APK** with the updated AndroidManifest.xml
2. **Completely uninstall** the Play Store version from your device
3. **Install the fresh APK** via ADB or manual installation
4. **Grant all permissions** when prompted
5. **Get the fresh token** from device logs
6. **Send a test notification** using that token
7. **Check device logs** for any errors

## Files to Check

- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) - Line 6 should have POST_NOTIFICATIONS
- [app.json](app.json) - Lines 42, 47 have POST_NOTIFICATIONS in permissions array
- [android/app/build.gradle](android/app/build.gradle) - Line 179 applies google-services plugin
- [android/app/google-services.json](android/app/google-services.json) - Package name should match
- [src/lib/push/registerPushToken.ts](src/lib/push/registerPushToken.ts) - Handles permission request and token registration

## Expected Logs (Success)

```
📱 [registerPushToken] Called with params: {...}
📱 [registerPushToken] Device.isDevice: true
✅ [registerPushToken] expo-notifications loaded successfully
🔐 [registerPushToken] Current permission status: undetermined
🔐 [registerPushToken] Requesting permissions...
🔐 [registerPushToken] Permission request result: granted
🎫 [registerPushToken] Getting push token with projectId: 975fd9b2-7c47-43a4-ac9b-da49f6d201fd
🎫 [registerPushToken] Obtained token: ExponentPushToken[xxx...]
🌐 [registerPushToken] Registering with backend: https://greenhaus-admin.vercel.app/api/push/register
🌐 [registerPushToken] Backend response status: 200 OK
✅ [registerPushToken] Successfully registered! Response: {...}
```

## Expected Logs (Permission Denied)

```
🔐 [registerPushToken] Current permission status: denied
🔐 [registerPushToken] Requesting permissions...
🔐 [registerPushToken] Permission request result: denied
❌ [registerPushToken] Push notification permission not granted
```

If you see "denied", the user manually rejected the permission or Android is blocking it due to missing manifest permission.

---

**Most Likely Solution:** The Play Store build doesn't have the updated AndroidManifest.xml. Build and install a fresh version with `npx expo run:android` or create a new EAS build.
