# TestFlight Push Token Fix - Complete Summary

## 🔍 Root Cause Identified

**The environment variables from `.env` were NOT being included in EAS builds.**

In TestFlight builds, `process.env.EXPO_PUBLIC_API_URL` returned `undefined`, causing the push token registration to silently fail at this check:

```typescript
if (!backendBaseUrl) {
  console.warn("Skipping push registration: backend base URL is undefined");
  return null;
}
```

## ✅ Solution Implemented

### 1. Added Environment Variables to `app.json`

**File:** `app.json`

Added all environment variables to the `extra` section so they're available at runtime in EAS builds:

```json
"extra": {
  "router": {
    "origin": "https://rork.com/"
  },
  "eas": {
    "projectId": "975fd9b2-7c47-43a4-ac9b-da49f6d201fd"
  },
  "EXPO_PUBLIC_API_URL": "https://greenhaus-admin.vercel.app/api",
  "EXPO_PUBLIC_FIREBASE_API_KEY": "AIzaSyC30WkAUhWaAGDK8-hhm70ajVrGPXRKZB",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "greenhaus-app.firebaseapp.com",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "greenhaus-app",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "greenhaus-app.firebasestorage.app",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "253214988919",
  "EXPO_PUBLIC_FIREBASE_APP_ID": "1:253214988919:web:c8ddb5fdea61bb197bc4"
}
```

**Also bumped iOS build number from `9` to `10`.**

### 2. Enhanced Debug Logging

**File:** `src/lib/push/registerPushToken.ts`

Added comprehensive logging using `console.error()` for visibility in release builds:

- 🔔 Function entry with all parameters and device status
- ❌ Critical error if API URL is missing (shows `process.env.EXPO_PUBLIC_API_URL`)
- 📍 Full registration URL
- 📦 Complete payload details (with token preview for security)
- ✅ Success response with server data
- ❌ Detailed error responses with status and body
- 💥 Exception handling with full error objects

**File:** `app/_layout.tsx` → `PushTokenRegistrar`

Added logging to track component lifecycle:

- 🎯 Effect trigger
- 🎯 Current `selectedStoreId`
- 🎯 Current `backendBaseUrl`
- 🎯 Raw `process.env.EXPO_PUBLIC_API_URL`
- ⏸️ Reason for skipping (no store selected)
- ▶️ Confirmation when calling registration

## 📋 Files Modified

1. ✅ `app.json` - Added env vars to `extra`, bumped build to #10
2. ✅ `src/lib/push/registerPushToken.ts` - Enhanced debug logging
3. ✅ `app/_layout.tsx` - Enhanced debug logging in `PushTokenRegistrar`
4. 📝 `PUSH_TOKEN_DEBUG.md` - Detailed debugging guide
5. 📝 `TESTFLIGHT_DEPLOY.md` - Quick deployment reference
6. 📝 `TESTFLIGHT_FIX_SUMMARY.md` - This file

## 🚀 Next Steps

### 1. Build for TestFlight

```bash
eas build --platform ios --profile production --auto-submit
```

Or separately:
```bash
eas build --platform ios --profile production
# Wait for build to complete, then:
eas submit --platform ios
```

### 2. Install on Device

- Open TestFlight app
- Install build #10
- Open GreenHaus app
- Allow notifications when prompted
- Select a store

### 3. Check Device Logs

**Via Xcode:**
1. Connect iPhone to Mac
2. Xcode → Window → Devices and Simulators
3. Select your device
4. Click "Open Console"
5. Filter by: `[PUSH]`

**Expected output:**
```
🎯 [PushTokenRegistrar] Effect triggered
🎯 [PushTokenRegistrar] selectedStoreId: greenhaus-tn-crossville
🎯 [PushTokenRegistrar] backendBaseUrl: https://greenhaus-admin.vercel.app/api
▶️ [PushTokenRegistrar] Calling registerPushToken...
🔔 [PUSH] registerPushToken called with: { storeId: "greenhaus-tn-crossville", ... }
🚀 [PUSH] Registering token...
📍 [PUSH] URL: https://greenhaus-admin.vercel.app/api/push/register
📦 [PUSH] Payload: { env: "prod", storeId: "greenhaus-tn-crossville", ... }
✅ [PUSH] Registration SUCCESS!
```

### 4. Verify in Firestore

Check the `pushTokens` collection for a new document with:
- `storeId`: Your selected store
- `env`: "prod"
- `deviceOS`: "ios"
- `token`: "ExponentPushToken[...]"
- `timestamp`: Recent date

### 5. Verify Backend

```bash
curl https://greenhaus-admin.vercel.app/api/dev/push
```

Should show increased token count for the registered store.

## 🎯 Success Criteria

✅ Logs appear in Xcode console showing registration flow  
✅ `backendBaseUrl` is NOT undefined  
✅ POST request goes to `https://greenhaus-admin.vercel.app/api/push/register`  
✅ Payload includes: `{ env: "prod", storeId: "...", token: "...", deviceOS: "ios", optedIn: true }`  
✅ Server responds with success (2xx status)  
✅ New token document appears in Firestore  
✅ Backend `/dev/push` shows increased count  

## 🔧 How It Works

### Registration Flow

1. **App Launches** → `RootLayout` renders
2. **Providers Mount** → `AppProvider` loads selected store from storage
3. **PushTokenRegistrar Effect** → Triggers when `selectedStoreId` is available
4. **Environment Check** → Reads `process.env.EXPO_PUBLIC_API_URL` (now available!)
5. **Registration Call** → `registerPushToken()` with store ID, API URL, env="prod"
6. **Permission Check** → Requests notification permission if needed
7. **Token Generation** → Gets Expo push token from Expo services
8. **HTTP POST** → Sends to `${EXPO_PUBLIC_API_URL}/push/register`
9. **Server Saves** → Backend stores token in Firestore
10. **Success** → Token registered and ready for push notifications

### Key Points

- **Environment Variables:** Now baked into the build via `app.json` extra
- **Throttling:** 20-second cooldown prevents duplicate registrations
- **Device Only:** Only runs on physical devices (not simulators)
- **Automatic:** Registers automatically when store is selected
- **Debug Logging:** All critical logs use `console.error()` for visibility

## 💡 Why This Works

**Before:** 
- Environment variables were only in `.env`
- EAS builds don't automatically include `.env` variables
- `process.env.EXPO_PUBLIC_API_URL` was `undefined` in TestFlight
- Registration silently failed

**After:**
- Environment variables are in `app.json` → `extra`
- EAS builds include these in the compiled app
- `process.env.EXPO_PUBLIC_API_URL` is available at runtime
- Registration succeeds with proper URL
- Comprehensive logging shows exactly what's happening

## 📱 Testing Checklist

- [ ] Build #10 deployed to TestFlight
- [ ] Installed on physical device
- [ ] Notifications permission granted
- [ ] Store selected
- [ ] Xcode console shows registration logs
- [ ] `backendBaseUrl` is NOT undefined in logs
- [ ] POST URL is correct
- [ ] Payload shows correct `storeId` and `env: "prod"`
- [ ] Server returns success
- [ ] Token appears in Firestore
- [ ] Backend `/dev/push` shows token

## 🐛 Troubleshooting

**If `backendBaseUrl` is still undefined:**
```bash
eas build:inspect --platform ios --profile production
```
Look for `extra.EXPO_PUBLIC_API_URL` in the output.

**If registration fails:**
- Check the full error in Xcode console (now logged in detail)
- Verify backend is accessible: `curl https://greenhaus-admin.vercel.app/api/health`
- Check Firestore rules allow writes to `pushTokens`

**If throttled:**
- Wait 20 seconds
- Restart app or trigger registration again

**If no logs appear:**
- Make sure you're filtering for `[PUSH]` in Xcode console
- Logs use `console.error()` so they should always be visible
- Check that app is actually running (not backgrounded)

---

## 🎉 Expected Outcome

After deploying build #10 and installing on a TestFlight device:

1. Open app
2. Allow notifications
3. Select store
4. **Push token automatically registers** with backend
5. **Token appears in Firestore** under `pushTokens` collection
6. **Backend count increases** for that store
7. **Ready to receive push notifications!**

All of this is now **visible in the logs** so you can see exactly what's happening at every step.

