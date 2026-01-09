# Build Android App - Quick Reference

## Current Version
- **versionCode**: 4
- **versionName**: 1.0.14

## Recent Fix
Added `POST_NOTIFICATIONS` permission for Android 13+ push notifications.

---

## Build for Production (Google Play Store)

### Step 1: Build with EAS
```bash
eas build --platform android --profile production
```

This creates an `.aab` (Android App Bundle) file optimized for Google Play Store.

**Build time**: ~15-20 minutes
**Output**: Download link in terminal and EAS dashboard

### Step 2: Submit to Google Play
```bash
eas submit --platform android
```

Or manually upload the `.aab` file to [Google Play Console](https://play.google.com/console).

---

## Build for Testing (APK)

### Quick Test Build (Development)
```bash
npx expo run:android
```
Builds and installs on connected device/emulator.

### Release APK (For Manual Distribution)
```bash
cd android
./gradlew assembleRelease
cd ..
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

---

## Before Building Checklist

- [ ] Increment `versionCode` in `app.json` and `android/app/build.gradle` ✅ (Now at 4)
- [ ] Test locally if possible: `npx expo run:android`
- [ ] Commit changes to git
- [ ] Verify `google-services.json` exists and is correct
- [ ] Check `app.json` has all required permissions ✅

---

## Testing Push Notifications

### Get Push Token from Device
1. Install the app
2. Open the app
3. Check device logs for:
   ```
   📱 [registerPushToken] Obtained token: ExponentPushToken[...]
   ```

### Test with Script
```bash
npx ts-node scripts/testAndroidPushNotifications.ts "ExponentPushToken[YOUR_TOKEN]" "2"
```

### Test from Admin Dashboard
1. Go to https://greenhaus-admin.vercel.app/dashboard/broadcast
2. Paste the Expo push token
3. Send test notification
4. Check your device

---

## Common Build Issues

### "Execution failed for task ':app:mergeReleaseResources'"
**Solution**: Clean and rebuild
```bash
cd android && ./gradlew clean && cd ..
npx expo run:android
```

### "No connected devices"
**Solution**:
- Connect Android device via USB
- Enable USB debugging
- Run `adb devices` to verify connection

### "Failed to install APK"
**Solution**: Uninstall old version first
```bash
adb uninstall com.greenloop.greenhaus
npx expo run:android
```

---

## Build Profiles (eas.json)

- **development**: Dev client with debugging
- **preview**: Internal testing, APK output
- **production**: Google Play Store, AAB output

To use different profile:
```bash
eas build --platform android --profile preview
```

---

## Next Version Increment

When ready for next version:

1. Update version in `app.json`:
   ```json
   "versionCode": 5
   ```

2. Update version in `android/app/build.gradle`:
   ```gradle
   versionCode 5
   ```

3. Optionally update `versionName` for user-facing version

---

## Useful Commands

```bash
# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]

# Cancel running build
eas build:cancel

# Check Android device connection
adb devices

# View device logs
adb logcat | grep -i "expo\|greenhaus\|push"

# Clear app data on device
adb shell pm clear com.greenloop.greenhaus
```

---

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android Build Process](https://docs.expo.dev/build-reference/android-builds/)
- [Google Play Console](https://play.google.com/console)
- [Firebase Console](https://console.firebase.google.com/project/greenhaus-app)
