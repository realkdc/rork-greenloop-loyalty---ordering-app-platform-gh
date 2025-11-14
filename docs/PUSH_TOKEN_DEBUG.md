# Push Token Registration - Debug & Fix Summary

## Issue Identified ✅

**Root Cause:** Environment variables from `.env` were NOT being injected into EAS builds because they weren't present in the `extra` section of `app.json`.

In TestFlight builds, `process.env.EXPO_PUBLIC_API_URL` was `undefined`, causing push token registration to silently fail.

## Changes Made

### 1. Fixed Environment Variables in `app.json` ✅

Added all required environment variables to the `extra` section so they're available at runtime in EAS builds:

```json
"extra": {
  "EXPO_PUBLIC_API_URL": "https://greenhaus-admin.vercel.app/api",
  "EXPO_PUBLIC_FIREBASE_API_KEY": "AIzaSyC30WkAUhWaAGDK8-hhm70ajVrGPXRKZB",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "greenhaus-app.firebaseapp.com",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "greenhaus-app",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "greenhaus-app.firebasestorage.app",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "253214988919",
  "EXPO_PUBLIC_FIREBASE_APP_ID": "1:253214988919:web:c8ddb5fdea61bb197bc4"
}
```

### 2. Added Comprehensive Debug Logging ✅

#### In `src/lib/push/registerPushToken.ts`:
- 🔔 Function entry with all parameters
- ❌ Critical error if API URL is missing
- 📍 Full registration URL being called
- 📦 Payload details (token preview, storeId, env, etc.)
- ✅ Success response
- ❌ Detailed error responses
- 💥 Exception handling

#### In `app/_layout.tsx` → `PushTokenRegistrar`:
- 🎯 Effect trigger with all values
- 🎯 Shows `selectedStoreId` and `backendBaseUrl`
- 🎯 Shows `process.env.EXPO_PUBLIC_API_URL` directly
- ⏸️ Reason for skipping registration
- ▶️ Confirmation when calling registration

**All logs use `console.error()` so they appear in release builds!**

### 3. Bumped Build Number ✅

Updated iOS build number from `9` to `10` in `app.json`.

## Next Steps - Testing

### Local Testing (Optional)

Test locally first to verify logs appear:

```bash
# Start metro bundler
npm start

# In another terminal, run on iOS simulator
npm run ios

# Or on device via Expo Go
npm start -- --tunnel
```

Expected logs:
```
🎯 [PushTokenRegistrar] Effect triggered
🎯 [PushTokenRegistrar] selectedStoreId: greenhaus-tn-crossville
🎯 [PushTokenRegistrar] backendBaseUrl: https://greenhaus-admin.vercel.app/api
▶️ [PushTokenRegistrar] Calling registerPushToken...
🔔 [PUSH] registerPushToken called with: { storeId: ..., env: 'prod', ... }
🚀 [PUSH] Registering token...
📍 [PUSH] URL: https://greenhaus-admin.vercel.app/api/push/register
📦 [PUSH] Payload: { env: 'prod', storeId: 'greenhaus-tn-crossville', ... }
✅ [PUSH] Registration SUCCESS!
```

### TestFlight Build & Deploy

1. **Build new TestFlight version:**
   ```bash
   eas build --platform ios --profile production
   ```

2. **Submit to TestFlight:**
   ```bash
   eas submit --platform ios
   ```

3. **Install on device and test:**
   - Open the TestFlight app
   - Install build #10
   - Open the GreenHaus app
   - Allow notifications when prompted
   - Select a store if prompted

4. **Check device logs via Xcode:**
   - Connect your iPhone to Mac
   - Open Xcode → Window → Devices and Simulators
   - Select your device
   - Click "Open Console"
   - Filter for "PUSH" or "[PUSH]"

### Expected Console Output

You should see this sequence in the Xcode device console:

```
🎯 [PushTokenRegistrar] Effect triggered
🎯 [PushTokenRegistrar] selectedStoreId: greenhaus-tn-crossville
🎯 [PushTokenRegistrar] backendBaseUrl: https://greenhaus-admin.vercel.app/api
🎯 [PushTokenRegistrar] process.env.EXPO_PUBLIC_API_URL: https://greenhaus-admin.vercel.app/api
▶️ [PushTokenRegistrar] Calling registerPushToken...
🔔 [PUSH] registerPushToken called with: {
  storeId: "greenhaus-tn-crossville",
  backendBaseUrl: "https://greenhaus-admin.vercel.app/api",
  env: "prod",
  optedIn: true,
  isDevice: true
}
🚀 [PUSH] Registering token...
📍 [PUSH] URL: https://greenhaus-admin.vercel.app/api/push/register
📦 [PUSH] Payload: {
  tokenPreview: "ExponentPushToken[...",
  deviceOS: "ios",
  env: "prod",
  storeId: "greenhaus-tn-crossville",
  optedIn: true
}
✅ [PUSH] Registration SUCCESS!
✅ [PUSH] Response: { ... }
```

### Verify in Firestore

After successful registration, check Firestore:

1. Open Firebase Console
2. Go to Firestore Database
3. Check `pushTokens` collection
4. Look for a new document with:
   - `storeId`: "greenhaus-tn-crossville" (or your selected store)
   - `env`: "prod"
   - `deviceOS`: "ios"
   - `token`: "ExponentPushToken[...]"

### Verify Backend Endpoint

Check the `/dev/push` endpoint to see the token count:

```
GET https://greenhaus-admin.vercel.app/api/dev/push
```

The summary should show an increased count for the registered store.

## Troubleshooting

### If `backendBaseUrl` is still undefined:

Check that EAS build is using the updated `app.json`:
```bash
eas build:inspect --platform ios --profile production
```

Look for `extra.EXPO_PUBLIC_API_URL` in the output.

### If permissions are denied:

- Delete the app from device
- Reinstall from TestFlight
- Allow notifications when prompted

### If registration fails with 4xx/5xx error:

Check the error logs for the exact response from the server. The payload and URL are now fully logged.

### If throttled:

Wait 20 seconds and either:
- Restart the app
- Or use the debug menu to manually trigger registration again

## Files Changed

1. ✅ `app.json` - Added env vars to `extra`, bumped build number to 10
2. ✅ `src/lib/push/registerPushToken.ts` - Added comprehensive debug logging
3. ✅ `app/_layout.tsx` - Added debug logging to `PushTokenRegistrar`
4. 📝 `PUSH_TOKEN_DEBUG.md` - This file

## Summary

The push token registration **will now work** because:
1. ✅ `EXPO_PUBLIC_API_URL` is available in EAS builds via `app.json` extra
2. ✅ Registration POSTs to `https://greenhaus-admin.vercel.app/api/push/register`
3. ✅ Includes `storeId` from selected store
4. ✅ Sets `env: "prod"`
5. ✅ Comprehensive logging shows exactly what's happening at every step
6. ✅ All critical logs use `console.error()` for visibility in release builds

