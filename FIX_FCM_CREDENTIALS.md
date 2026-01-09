# Fix: Upload FCM Credentials to Expo

## The Problem

Your push tokens are being generated, but Expo says "DeviceNotRegistered" when you try to send notifications. This is because **Expo doesn't have your Firebase Cloud Messaging (FCM) credentials**.

Without FCM credentials, Expo can't send push notifications to Android devices.

## The Solution

You need to upload your FCM credentials to your Expo/EAS project.

### Step 1: Get Your FCM Server Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **greenhaus-app**
3. Click the gear icon → **Project Settings**
4. Go to the **Cloud Messaging** tab
5. Scroll down to **Cloud Messaging API (Legacy)**
6. Copy your **Server Key**

**Note:** If you see "Cloud Messaging API (Legacy) is disabled", you need to enable it:
- Click the ⋮ menu → **Manage API in Google Cloud Console**
- Enable **Cloud Messaging API**

### Step 2: Upload to Expo

Run this command:

```bash
npx eas-cli credentials
```

When prompted:
1. Select **Android**
2. Select your build profile (probably **production**)
3. Select **Push Notifications: Manage your FCM key**
4. Choose **Add a new FCM server key**
5. Paste your Server Key from Step 1

### Alternative: Use FCM v1 (Recommended for new projects)

Instead of the legacy server key, you can use the newer FCM v1:

1. In Firebase Console → Project Settings → Service Accounts
2. Click **Generate New Private Key**
3. Download the JSON file
4. Run: `npx eas-cli credentials`
5. Select **Push Notifications: Manage your FCM V1 service account key**
6. Upload the JSON file

## After Upload

Once you've uploaded the FCM credentials:

1. **Wait a few minutes** for Expo to sync
2. **Get a fresh token** by restarting your app
3. **Test the notification** again:

```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{
    "to": "ExponentPushToken[YOUR_NEW_TOKEN]",
    "title": "Test After FCM Upload",
    "body": "This should work now!",
    "sound": "default",
    "priority": "high",
    "channelId": "default"
  }' \
  https://exp.host/--/api/v2/push/send
```

## Verify FCM Credentials Are Uploaded

Run this to check:

```bash
npx eas-cli credentials -p android
```

You should see something like:
```
FCM Server Key: *********abc (set)
```

or

```
FCM V1 Service Account Key: Yes (set)
```

## Why This Fixes It

- **Before:** Your app generates a token, but Expo has no way to send notifications to it
- **After:** Expo can use your FCM credentials to send notifications via Firebase

## Quick Test Script

After uploading credentials, use this to test:

```bash
# Get fresh token from device
adb logcat -c
adb shell am force-stop com.greenloop.greenhaus
adb shell am start -n com.greenloop.greenhaus/.MainActivity
sleep 5
TOKEN=$(adb logcat -d | grep -oE "ExponentPushToken\[[^\]]+\]" | tail -1)

echo "Found token: $TOKEN"

# Send test
curl -H "Content-Type: application/json" -X POST \
  -d "{
    \"to\": \"$TOKEN\",
    \"title\": \"FCM Test\",
    \"body\": \"Testing with FCM credentials!\",
    \"sound\": \"default\",
    \"priority\": \"high\",
    \"channelId\": \"default\"
  }" \
  https://exp.host/--/api/v2/push/send
```

---

**This is the missing piece!** Once FCM credentials are uploaded to Expo, notifications will work.
