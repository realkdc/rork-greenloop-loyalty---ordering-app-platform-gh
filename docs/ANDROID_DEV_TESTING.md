# Testing Android on a Physical Device (android-googleplay branch)

## The issue

The **Google Play / production** build does **not** include the Expo dev client. It only runs the JS bundle that was built into the app when you submitted it.

When you run `npx expo start` and press **a** (Open on Android), it tries to open:

```
exp+greenloop-loyalty-ordering-platform://expo-development-client/?url=http://192.168.x.x:8081
```

- **Production (Play Store) app:** May open, but it will **ignore** that URL and just show the built‑in bundle. You won’t see changes from Metro.
- **Development build:** Handles that URL, connects to Metro, and loads your latest JS.

So if the Play Store version is the one installed, you are not running your current dev code.

---

## How to test your latest code on a physical Android device

You need a **development build** (with `expo-dev-client`) on the device instead of (or after removing) the Play Store build. Both use the same package `com.greenloop.greenhaus`, so only one can be installed at a time.

### 1. Uninstall the app on the device

If you have the Play Store build or any other build with the same package:

```bash
adb uninstall com.greenloop.greenhaus
```

Or: Android **Settings → Apps → GreenHaus → Uninstall**.

### 2. Build and install a development build

From the project root, with the device connected and **USB debugging** enabled:

```bash
npx expo run:android
```

This will:

- Build a **debug** Android app that includes `expo-dev-client`
- Install it on the connected device (or emulator)

When it finishes, the app will launch; it may show a dev-client UI or connect to Metro if a server is already running.

### 3. Start Metro and open on Android

In a separate terminal:

```bash
npx expo start
```

Then press **a** to open on Android.

The **development build** you just installed will:

- Open
- Connect to Metro at `http://<your-ip>:8081`
- Run your **current** JS from the `android-googleplay` branch

You should see your latest changes, and they’ll reload as you save.

---

## Summary

| Build type        | How you install it              | Connects to Metro? | Sees latest code? |
|-------------------|----------------------------------|--------------------|-------------------|
| Play Store build  | Installed from Google Play       | No                 | No                |
| Development build | `npx expo run:android`           | Yes                | Yes               |

For day‑to‑day development, keep the **development build** installed. Use the Play Store build only to verify the production experience (e.g. before submitting).

---

## If `npx expo run:android` fails to install

If you get `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signatures don’t match), the old app is still installed. Uninstall it first:

```bash
adb uninstall com.greenloop.greenhaus
```

Then run `npx expo run:android` again.
