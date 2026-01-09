# Android Push Notifications - Final Fix Documentation

**Date:** January 9, 2026
**Branch:** android-googleplay
**Status:** ✅ FIXED AND WORKING

---

## The Problem

Android push notifications were not working even though:
- iOS push notifications worked perfectly
- POST_NOTIFICATIONS permission was in AndroidManifest.xml
- Permission was granted on device
- Push tokens were being generated and saved to Firebase
- Firebase Cloud Messaging was configured

**Symptom:** When sending test notifications via Expo Push API, received error:
```
"DeviceNotRegistered" - Token is not a registered push notification recipient
```

---

## Root Cause

**The FCM V1 Service Account Key was uploaded to Expo at the ACCOUNT level, but was NOT linked to the specific Android app identifier (`com.greenloop.greenhaus`) at the PROJECT level.**

Without this link:
- Expo couldn't validate push tokens with Firebase Cloud Messaging
- Tokens were generated but "orphaned" - they existed in our database but Expo couldn't use them
- All 101 iOS notifications sent successfully, but 0 Android notifications were ever sent

---

## The Fix

### Step 1: Navigate to Project Credentials
Go to: https://expo.dev/accounts/indieplant/projects/greenloop-loyalty-ordering-platform/credentials/android/com.greenloop.greenhaus

### Step 2: Link FCM Service Account
1. Under "Service Credentials" section
2. Find "FCM V1 service account key"
3. Click **"Add a Service Account Key"**
4. Select existing service account: `firebase-adminsdk-fbsvc@greenhaus-app.iam.gserviceaccount.com`
5. Click **Save**

### Step 3: Test with Fresh Token
After linking FCM credentials:
1. Uninstall app from device (to get fresh token)
2. Reinstall from Google Play Store
3. Open app and select a store
4. Get new token from Firebase Firestore (`pushTokens` collection)
5. Send test notification:

```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{
    "to": "ExponentPushToken[YOUR_NEW_TOKEN]",
    "title": "Test",
    "body": "It works!",
    "sound": "default",
    "priority": "high",
    "channelId": "default"
  }' \
  https://exp.host/--/api/v2/push/send
```

**Result:** `{"data":{"status":"ok","id":"..."}}` ✅

---

## What About Existing Users?

### Do they need to uninstall/reinstall?
**NO!** Here's what happens:

1. **Active users** - Next time they open the app:
   - `registerPushToken()` is called automatically
   - `getExpoPushTokenAsync()` generates new token OR refreshes existing
   - New/refreshed token is saved to Firebase
   - Token is now valid because FCM is linked

2. **Inactive users** - If they haven't opened app:
   - Old tokens remain in Firebase database
   - These are just historical records
   - If user never opens app again, can't send notifications anyway
   - When they DO open app, token auto-refreshes

### Token Refresh Triggers
Tokens automatically refresh when:
- App is updated to new version
- User reinstalls app
- App opens after being closed for a while
- FCM token expires (rare)
- App calls `getExpoPushTokenAsync()` again

Your code in `src/lib/push/registerPushToken.ts` already handles this!

---

## Verification Steps

### 1. Check Expo Push Notifications Dashboard
https://expo.dev/accounts/indieplant/projects/greenloop-loyalty-ordering-platform/push-notifications

Should show:
- Android notifications increasing (no longer stuck at 0)
- iOS continuing to work (101+)

### 2. Check FCM Credentials
https://expo.dev/accounts/indieplant/projects/greenloop-loyalty-ordering-platform/credentials/android/com.greenloop.greenhaus

Should show:
```
FCM V1 service account key
Project ID: greenhaus-app
Client: firebase-adminsdk-fbsvc@greenhaus-app.iam.gserviceaccount.com
Uploaded at: Jan 7, 2026 1:15 PM
```

### 3. Test Notification from Admin Dashboard
1. Go to https://greenhaus-admin.vercel.app/dashboard/broadcast
2. Send test notification to Android device
3. Should receive notification immediately

---

## Files Changed in This Fix

### Configuration Files
- `android/app/src/main/AndroidManifest.xml` - Regenerated via `expo prebuild --clean` to ensure POST_NOTIFICATIONS permission
- `app.json` - Already had POST_NOTIFICATIONS in permissions array

### No Code Changes Required
The app code was already correct. The issue was purely Expo project configuration.

### Documentation Created
1. `ANDROID_PUSH_DEBUG.md` - Comprehensive debugging guide
2. `ANDROID_PUSH_NOTIFICATION_FIX.md` - Initial fix attempt documentation
3. `SOLUTION_SUMMARY.md` - Quick troubleshooting reference
4. `FIX_FCM_CREDENTIALS.md` - FCM credential setup guide
5. `NOTIFICATION_FIX_COMPLETE.md` - Complete fix documentation
6. `ANDROID_PUSH_NOTIFICATIONS_FINAL_FIX.md` - This file

### Scripts Created
1. `scripts/watchAndroidLogs.sh` - Live log monitoring
2. `scripts/testNotificationDelivery.ts` - Automated testing
3. `src/components/NotificationDebugPanel.tsx` - In-app debug UI

---

## Timeline of Investigation

1. **Initial Assumption**: Missing POST_NOTIFICATIONS permission
   - Verified: Permission was already in app.json
   - Ran `expo prebuild --clean` to regenerate AndroidManifest.xml
   - Result: Permission confirmed present, but notifications still failed

2. **Second Assumption**: Firebase dependencies missing
   - Verified: `expo-notifications` includes `firebase-messaging:24.0.1`
   - Verified: `google-services.json` properly configured
   - Verified: `com.google.gms.google-services` plugin applied
   - Result: All dependencies correct, but notifications still failed

3. **Third Assumption**: Token mismatch
   - Tested multiple tokens from Firebase
   - All returned "DeviceNotRegistered"
   - Result: Not a token issue, but configuration issue

4. **Root Cause Discovery**:
   - Checked Expo Push Notifications dashboard
   - Found: 0 Android notifications ever sent (vs 101 iOS)
   - Checked FCM credentials at PROJECT level
   - Found: **FCM Service Account NOT linked to app identifier**
   - Linked service account → FIXED!

---

## Key Learnings

### 1. Expo Has Two Credential Levels
- **Account Level**: Service accounts uploaded here
- **Project Level**: Service accounts must be LINKED to specific app identifiers

Just uploading to account level is not enough!

### 2. Push Notification Dashboard Shows the Truth
The dashboard at `/push-notifications` immediately showed 0 Android notifications sent, which was the key diagnostic clue.

### 3. "DeviceNotRegistered" Error is Misleading
This error doesn't mean the device isn't registered. It means:
- Expo doesn't recognize the token
- Usually due to missing FCM credentials
- OR token was generated before FCM was configured

### 4. Tokens Auto-Refresh
No need to force users to reinstall. Tokens refresh automatically when:
- App updates
- App reopens after being closed
- FCM token expires

---

## Next Steps for Future Builds

### For Next Android Release:
1. FCM is now properly configured ✅
2. Push notifications will work for all new installs ✅
3. Existing users will get new tokens when they open the app ✅

### For Testing:
1. Use `scripts/watchAndroidLogs.sh` to monitor token registration
2. Use `scripts/testNotificationDelivery.ts` to test from command line
3. Or add `<NotificationDebugPanel />` to any screen for in-app testing

### For Production:
1. Send notifications via admin dashboard or backend API
2. Monitor Expo dashboard for delivery stats
3. Handle "DeviceNotRegistered" errors by removing old tokens from database

---

## Commands Reference

### Test Push Notification
```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN]",
    "title": "Test",
    "body": "Message",
    "sound": "default",
    "priority": "high",
    "channelId": "default"
  }' \
  https://exp.host/--/api/v2/push/send
```

### Watch Device Logs
```bash
./scripts/watchAndroidLogs.sh
```

### Check Installed App Permissions
```bash
adb shell dumpsys package com.greenloop.greenhaus | grep POST_NOTIFICATIONS
```

### Get Fresh Token from Device
```bash
adb logcat -c
adb shell am force-stop com.greenloop.greenhaus
adb shell am start -n com.greenloop.greenhaus/.MainActivity
sleep 10
adb logcat -d | grep -E "Obtained token|ExponentPushToken"
```

---

## Related Issues

### Google Play Browse/Search Tab
- **Latest update**: Reintroduced browse/search tab in Android app
- **Next steps**:
  1. Build with prices visible but NO checkout
  2. Submit to Google Play for approval
  3. If approved, push version with external browser checkout flow

### Checkout Flow Branch
There may already be a branch with external browser checkout implemented. Need to verify which branch has this work.

---

## Summary

**Problem**: Android push notifications didn't work because FCM Service Account wasn't linked to the Android app identifier at the Expo project level.

**Solution**: Linked existing FCM Service Account (`firebase-adminsdk-fbsvc@greenhaus-app`) to `com.greenloop.greenhaus` in Expo project credentials.

**Result**: Android push notifications now work. Existing users will automatically get new valid tokens when they open the app.

**Status**: ✅ FIXED - Ready for production use

---

**Documentation Complete** - January 9, 2026
