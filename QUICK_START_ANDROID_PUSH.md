# Android Push Notifications - Quick Start

## ✅ Status: FIXED AND WORKING

Android push notifications are now fully functional!

---

## What Was Wrong

**FCM Service Account wasn't linked to the Android app at the project level in Expo.**

---

## How It Was Fixed

1. Went to: https://expo.dev/accounts/indieplant/projects/greenloop-loyalty-ordering-platform/credentials/android/com.greenloop.greenhaus
2. Clicked "Add a Service Account Key" under FCM V1
3. Selected: `firebase-adminsdk-fbsvc@greenhaus-app.iam.gserviceaccount.com`
4. Saved

**That's it!** No code changes needed.

---

## Testing Push Notifications

### Quick Test from Terminal:
```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{
    "to": "ExponentPushToken[YOUR_TOKEN_FROM_FIREBASE]",
    "title": "Test",
    "body": "Hello from GreenHaus!",
    "sound": "default",
    "priority": "high",
    "channelId": "default"
  }' \
  https://exp.host/--/api/v2/push/send
```

### Get Token from Firebase:
1. Go to Firebase Console → Firestore
2. Open `pushTokens` collection
3. Find most recent Android token
4. Copy the token value

### Expected Response:
```json
{"data":{"status":"ok","id":"..."}}
```

---

## Do Existing Users Need to Reinstall?

**NO!** Tokens auto-refresh when users open the app.

---

## Next Android Builds

### Current State:
- ✅ Browse/search tab reintroduced
- ✅ Push notifications working
- ✅ Prices hidden on product pages

### Upcoming Builds:
1. **Next**: Prices visible, no checkout
2. **After approval**: External browser checkout flow

---

## Full Documentation

See [ANDROID_PUSH_NOTIFICATIONS_FINAL_FIX.md](ANDROID_PUSH_NOTIFICATIONS_FINAL_FIX.md) for complete details.

---

**Last Updated**: January 9, 2026
