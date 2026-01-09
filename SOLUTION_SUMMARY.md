# Android Push Notifications - Solution Summary

## Investigation Results

### What I Found:

1. ✅ **POST_NOTIFICATIONS permission IS present** in AndroidManifest.xml (line 6)
2. ✅ **Permission IS granted** on your device (verified via `adb shell dumpsys`)
3. ✅ **Firebase Messaging dependency** is included (v24.0.1 via expo-notifications)
4. ✅ **Notification channel** is configured correctly with MAX importance
5. ✅ **Your device is Android 14 (API 34)** - definitely needs the permission
6. ✅ **App version is 4** - the version with POST_NOTIFICATIONS

### The REAL Problem:

Based on the investigation, the permissions and configuration are all correct. The issue is likely ONE of these:

## Most Likely Causes (In Order):

### 1. **Token Mismatch** 🎯 MOST LIKELY
The token you're sending to in the admin dashboard might be:
- An old token from a previous app version
- A token from a different device
- An expired/invalidated token

**Solution:**
```bash
# Get the ACTUAL current token from your connected device
adb logcat -c && echo "Opening app now..." && sleep 3 && adb logcat -d | grep "Obtained token"
```

Copy the exact token from the logs and use THAT in your admin dashboard.

### 2. **App in Foreground**
When the app is in the foreground, Android may not show notifications in the notification tray (by design).

**Solution:**
- Close the app completely (swipe it away from recent apps)
- Send the notification
- Check if it appears

### 3. **Battery Optimization**
Android's aggressive battery optimization can kill FCM background processes.

**Solution:**
```bash
# Disable battery optimization via ADB
adb shell dumpsys deviceidle whitelist +com.greenloop.greenhaus
```

Or manually:
1. Settings → Apps → GreenHaus → Battery
2. Select "Unrestricted"

### 4. **Google Play Services Issue**
FCM requires Google Play Services to be working properly.

**Solution:**
```bash
# Check Google Play Services status
adb shell dumpsys package com.google.android.gms | grep version

# Reinstall if needed via Play Store
```

### 5. **Notification Handler Not Implemented**
The app might not have a listener for when notifications arrive while the app is in foreground.

**Solution:**
Check if you have notification handlers in your app:
```typescript
// In app/_layout.tsx or similar
import * as Notifications from 'expo-notifications';

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Listen for received notifications
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('📬 Notification received:', notification);
  });

  return () => subscription.remove();
}, []);
```

## Quick Debugging Steps

### Step 1: Get Fresh Token
```bash
# Connect device and run:
./scripts/watchAndroidLogs.sh
```

Open the app, look for a line like:
```
🎫 [registerPushToken] Obtained token: ExponentPushToken[xxxxxx]
```

### Step 2: Test with Expo API directly
```bash
# Use the script I created:
npx ts-node scripts/testNotificationDelivery.ts
```

### Step 3: Test with curl
```bash
curl -H "Content-Type: application/json" -X POST -d '{
  "to": "ExponentPushToken[YOUR_TOKEN_HERE]",
  "title": "Test from curl",
  "body": "Did this work?",
  "sound": "default",
  "priority": "high",
  "channelId": "default"
}' https://exp.host/--/api/v2/push/send
```

### Step 4: Check Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select "greenhaus-app" project
3. Go to Cloud Messaging
4. Send a test notification directly from Firebase
5. If Firebase notifications work but Expo doesn't, it's an Expo/token issue

## Files Created for You:

1. **[ANDROID_PUSH_DEBUG.md](ANDROID_PUSH_DEBUG.md)** - Comprehensive debugging guide
2. **[scripts/watchAndroidLogs.sh](scripts/watchAndroidLogs.sh)** - Live log watcher
3. **[scripts/testNotificationDelivery.ts](scripts/testNotificationDelivery.ts)** - Automated test script
4. **This file** - Quick solution summary

## What to Do Next:

1. **Run the log watcher:**
   ```bash
   ./scripts/watchAndroidLogs.sh
   ```

2. **Open the app and look for the token** in the logs

3. **Copy that EXACT token** to your admin dashboard

4. **Completely close the app** (swipe away from recent apps)

5. **Send test notification** from admin dashboard

6. **Check the device** - notification should appear

## If Still Not Working:

Run this command and send me the output:
```bash
adb shell dumpsys notification | grep -A 30 "com.greenloop.greenhaus"
```

Also check:
```bash
adb logcat | grep -E "FCM|firebase|GCM" | tail -20
```

## The Bottom Line:

Your app is configured correctly! The permission is there, it's granted, and the notification system is set up properly. The issue is likely:

1. **Using an old/wrong token** (most likely)
2. **App is in foreground** when notification arrives
3. **Battery optimization** killing the FCM service
4. **Notification handler** not showing foreground notifications

Start with Step 1 above (get the fresh token) and test again!
