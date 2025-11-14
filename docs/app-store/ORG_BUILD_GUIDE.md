# Organization Build & Submission Guide

## ✅ Configuration Complete

### Updated Files:
1. **`eas.json`** - Added organization team ID `P99524QAS9` for iOS production builds
2. **`app.json`** - Build number incremented to `15`
3. **`ios/GreenHaus/Info.plist`** - Build version updated to `15`
4. **Bundle ID**: `com.greenhauscc.customer` (already configured)

---

## 🔐 Step 1: Login to EAS with Organization Account

**IMPORTANT:** Make sure you're logged into EAS with your organization account (not personal):

```bash
# Logout from personal account (if needed)
npx eas logout

# Login with organization account
npx eas login
```

Enter your organization Apple Developer account credentials when prompted.

---

## 🏗️ Step 2: Build the App

### Option A: Build Only (Recommended first time)
```bash
eas build --platform ios --profile production
```

This will:
- Use team ID: `P99524QAS9` (GREENHAUS JS LLC)
- Use bundle ID: `com.greenhauscc.customer`
- Build number: `15`
- Create an App Store build

### Option B: Build & Auto-Submit (After first build)
```bash
eas build --platform ios --profile production --auto-submit
```

**Note:** First time you may need to:
1. Select credentials management (choose "Let EAS manage credentials")
2. Provide Apple ID credentials for your organization account
3. EAS will create certificates and provisioning profiles automatically

---

## ⏳ Step 3: Wait for Build to Complete

- Builds typically take **15-20 minutes**
- You'll get a URL to track progress
- Check status: `eas build:list`

---

## 📤 Step 4: Submit to TestFlight / App Store Connect

### Option A: Manual Submit (After build completes)
```bash
eas submit --platform ios --profile production
```

### Option B: If build already completed
```bash
# List recent builds
eas build:list

# Submit a specific build
eas submit --platform ios --latest
```

**Note:** First submission may ask for:
- Apple ID (your organization account email)
- App Store Connect app ID (found in App Store Connect after creating the app)

---

## 🔍 Step 5: Verify in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app (GreenHaus)
3. Go to **TestFlight** tab
4. The build should appear under "Builds" section
5. Click **+** to add it to TestFlight testing
6. Select internal or external testing group

---

## 📝 After First Submission

Once you've submitted once, EAS will remember your App Store Connect app ID. You can optionally update `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-org-email@example.com",
      "ascAppId": "1234567890",  // ← Get this from App Store Connect
      "appleTeamId": "P99524QAS9"
    }
  }
}
```

---

## 🐛 Troubleshooting

### "No credentials found"
- EAS will prompt you to create credentials
- Choose "Let EAS manage credentials"
- Provide your organization Apple Developer account credentials

### "Bundle ID not found"
- Make sure `com.greenhauscc.customer` is registered in Apple Developer
- Go to: https://developer.apple.com/account/resources/identifiers/list
- Verify it exists and is under your organization account

### "Team ID mismatch"
- Verify you're logged into EAS with the organization account
- Check `eas.json` has correct `appleTeamId: "P99524QAS9"`

### "Wrong Apple ID"
- Make sure you're using the organization account Apple ID
- Not your personal account

---

## 📊 Current Build Configuration

- **Bundle ID**: `com.greenhauscc.customer`
- **Team ID**: `P99524QAS9` (GREENHAUS JS LLC)
- **Build Number**: `15`
- **Version**: `1.0.4`
- **Distribution**: App Store

---

## ✅ Quick Checklist

Before building:
- [ ] Logged into EAS with organization account (`npx eas login`)
- [ ] Bundle ID `com.greenhauscc.customer` registered in Apple Developer
- [ ] App created in App Store Connect
- [ ] Demo mode enabled (`DEMO_MODE: true` in `constants/config.ts`)
- [ ] Review build enabled (`REVIEW_BUILD: true` in `constants/config.ts`)

After build:
- [ ] Build completed successfully
- [ ] Submitted to App Store Connect
- [ ] Build appears in TestFlight
- [ ] Added to internal testing group

---

**Ready to build?** Run: `eas build --platform ios --profile production`











