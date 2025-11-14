# TestFlight Deployment - Quick Reference

## Current Build: #10

### What Was Fixed

1. ✅ **Environment variables now available in EAS builds**
   - Added `EXPO_PUBLIC_API_URL` and Firebase config to `app.json` → `extra`
   - Previously these were only in `.env` which doesn't work for EAS builds

2. ✅ **Comprehensive debug logging added**
   - All critical logs use `console.error()` for visibility in release builds
   - Logs show: URL, payload, storeId, env, and full response/errors

3. ✅ **Build number bumped** to `10`

### Quick Deploy to TestFlight

```bash
# 1. Build for iOS
eas build --platform ios --profile production

# 2. Wait for build to complete (~15-20 minutes)
# You'll get a URL to track progress

# 3. Submit to TestFlight (after build completes)
eas submit --platform ios
```

### Alternative: Build & Auto-Submit

```bash
eas build --platform ios --profile production --auto-submit
```

### Check Build Status

```bash
eas build:list
```

### Test Locally First (Optional)

```bash
# Clear cache and start fresh
npm start -- --clear

# Or run on iOS simulator
npm run ios
```

### Viewing Logs on Device

1. **Connect device to Mac**
2. **Open Xcode** → Window → Devices and Simulators
3. **Select your device**
4. **Click "Open Console"**
5. **Filter by:** `[PUSH]` or `PUSH` or `PushTokenRegistrar`

### Expected Log Sequence

```
🎯 [PushTokenRegistrar] Effect triggered
🎯 [PushTokenRegistrar] selectedStoreId: greenhaus-tn-crossville
🎯 [PushTokenRegistrar] backendBaseUrl: https://greenhaus-admin.vercel.app/api
▶️ [PushTokenRegistrar] Calling registerPushToken...
🔔 [PUSH] registerPushToken called with: { ... }
🚀 [PUSH] Registering token...
📍 [PUSH] URL: https://greenhaus-admin.vercel.app/api/push/register
📦 [PUSH] Payload: { env: 'prod', storeId: '...', ... }
✅ [PUSH] Registration SUCCESS!
```

### If Something Goes Wrong

**API URL still undefined:**
```bash
# Inspect the build configuration
eas build:inspect --platform ios --profile production
```

Look for `extra.EXPO_PUBLIC_API_URL` in the output.

**Permission issues:**
- Delete app from device
- Reinstall from TestFlight
- Allow notifications when prompted

**Registration fails:**
- Check Xcode console for the exact error
- The logs will show the full URL, payload, and server response
- Check if the backend endpoint is accessible:
  ```bash
  curl https://greenhaus-admin.vercel.app/api/health
  ```

### Verify Success

1. **In Xcode Console:** Look for `✅ [PUSH] Registration SUCCESS!`

2. **In Firestore:**
   - Collection: `pushTokens`
   - Document should have:
     - `storeId`: (your store)
     - `env`: "prod"
     - `deviceOS`: "ios"
     - `token`: "ExponentPushToken[...]"

3. **Backend Summary:**
   ```bash
   curl https://greenhaus-admin.vercel.app/api/dev/push
   ```
   Should show increased token count for your store.

### Build Configuration

The EAS build uses the `production` profile from `eas.json`:

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "ios": {
        "resourceClass": "medium"
      }
    }
  }
}
```

### After Deployment

1. Install from TestFlight on a physical device
2. Open the app
3. Allow notifications
4. Select a store
5. Check Xcode console for push registration logs
6. Verify in Firestore that the token was saved

### Important Notes

- Push tokens only work on **physical devices** (not simulators)
- Registration has a **20-second throttle** to prevent spam
- The `PushTokenRegistrar` runs automatically when a store is selected
- All environment variables are now baked into the build via `app.json`

### EAS CLI Commands Cheat Sheet

```bash
# Login to EAS
eas login

# Check current builds
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Check credentials
eas credentials

# View current project info
eas project:info

# Build and submit in one command
eas build --platform ios --profile production --auto-submit
```

