# Google Play Store Submission Guide - GreenHaus

## ✅ COMPLETED

### App Configuration
- **Package Name**: `com.greenloop.greenhaus`
- **Version Code**: `1`
- **Version Name**: `1.0.0`
- **Minimum SDK**: 24 (Android 7.0)
- **Target SDK**: 35 (Android 14+)

### Signing Key
- **Keystore**: `android/app/greenhaus-upload-key.keystore`
- **Alias**: `greenhaus-key`
- **Password**: `greenhaus2024!`
- **Validity**: 10,000 days (~27 years)

⚠️ **CRITICAL**: Backup this keystore file! If you lose it, you can NEVER update your app on Google Play.

### Build Files
After the build completes, you'll find:
- **AAB (required for Google Play)**: `android/app/build/outputs/bundle/release/app-release.aab`

### Permissions (No Background Location!)
The app only requests:
- `ACCESS_COARSE_LOCATION` - For store selection (foreground only)
- `ACCESS_FINE_LOCATION` - For geo-gating (foreground only)
- `CAMERA` - For QR code scanning
- `RECORD_AUDIO` - Camera module requirement
- `INTERNET` - Network access

✅ Background location is **DISABLED** in app.json (lines 74-75)

## 📋 GOOGLE PLAY CONSOLE CHECKLIST

### 1. App Bundle Upload
1. Go to Google Play Console → Your App → Production
2. Click "Create new release"
3. Upload: `android/app/build/outputs/bundle/release/app-release.aab`
4. Fill in release notes

### 2. Store Listing (Required)

**App Name**: GreenHaus

**Short Description** (80 chars max):
```
Cannabis dispensary info app for Tennessee - Store locations & hours
```

**Full Description** (4000 chars max):
```
GreenHaus is your informational companion for Tennessee's premier cannabis dispensaries. This educational app provides:

📍 Store Locations & Hours
- Cookeville: 851 S Willow Ave Suite 115
- Crossville: 750 US-70 E Suite 106

📢 Announcements
Stay informed about store updates and news

ℹ️ Educational Information
Learn about our stores and services

🔒 Account Management
Manage your GreenHaus account preferences

IMPORTANT: This is an informational and educational app only. No purchases can be made through this application. All transactions must be completed in-person at our physical store locations in compliance with Tennessee state law.

GreenHaus serves customers who are 21 years of age or older. By using this app, you confirm that you are of legal age in accordance with Tennessee state regulations.
```

**App Category**: Lifestyle (or Shopping > Other)

**Content Rating**: Mature 17+ (due to cannabis content)

### 3. Graphics Requirements

You'll need to create/provide:

**App Icon** (already have):
- 512x512 PNG
- Located at: `assets/images/icon.png`

**Feature Graphic** (REQUIRED - need to create):
- 1024x500 PNG
- Displayed at top of store listing
- Should show GreenHaus branding

**Screenshots** (REQUIRED - need to capture):
- Minimum: 2 screenshots
- Recommended: 4-8 screenshots
- Dimensions: At least 320px on shortest side, max 3840px
- Screenshot suggestions:
  1. Home screen with store locations
  2. Store locations with directions
  3. Announcements section
  4. Account page

**Phone Screenshots**:
- Capture from Android device
- Show key features

### 4. Privacy Policy (REQUIRED)

You MUST provide a Privacy Policy URL. The policy should cover:
- Location data collection (for store selection and geo-verification)
- Email collection (for magic link authentication)
- Push notification tokens
- User preferences storage
- State that NO purchase data is collected (app is informational only)

Example URL structure: `https://greenhauscc.com/privacy-policy`

### 5. Data Safety Form

**Location**:
- ✅ Approximate location collected
- ✅ Precise location collected
- Purpose: App functionality (store selection)
- ❌ Not shared with third parties
- ❌ User can request deletion

**Personal Info**:
- ✅ Email address collected
- Purpose: Account management (magic link auth)
- ❌ Not shared with third parties
- ✅ User can request deletion

**App Activity**:
- ✅ App interactions collected
- Purpose: Analytics (store selection, announcements viewed)
- ❌ Not shared with third parties

### 6. Content Rating Questionnaire

**Cannabis Content**: YES
- Educational/informational content about cannabis dispensaries
- No sales or transactions
- Age-gated (21+)

**Violence**: NO
**Nudity/Sexual Content**: NO
**Profanity**: NO
**User-Generated Content**: NO
**Location Sharing**: YES (for store selection only)

Expected Rating: **Mature 17+** or **Adults Only 18+**

### 7. Target Audience & Content

**Target Age Group**: Adults (18+ or 21+)

**Ads**: No ads in the app

**In-App Purchases**: None

### 8. Countries/Regions

**Availability**:
- United States only (specifically Tennessee)
- OR: Just Tennessee if that option exists

### 9. App Access

**Restricted Access**: NO
- App is free and available to all users 21+
- Just requires age verification during onboarding

## 🚨 COMPLIANCE NOTES

### Cannabis Policy Compliance
This app complies with Google Play's marijuana policy because:
1. ✅ **No transactions** - Cannot purchase through the app
2. ✅ **Informational only** - Just shows store info, hours, announcements
3. ✅ **No product catalog** - Blocked from viewing products on Google Play version
4. ✅ **Age-gated** - Requires age verification
5. ✅ **Geo-restricted** - Only for Tennessee users

### What the App Does NOT Do (Compliance):
- ❌ No product browsing
- ❌ No cart functionality
- ❌ No checkout process
- ❌ No payment processing
- ❌ No direct links to e-commerce site
- ❌ No "shop now" buttons

### What the App DOES (Allowed):
- ✅ Shows store locations and hours
- ✅ Provides directions to stores
- ✅ Displays announcements/news
- ✅ Account management
- ✅ Educational content

## 📝 SUBMISSION STEPS

1. **Build Complete** - Wait for `bundleRelease` to finish
2. **Upload AAB** - To Google Play Console
3. **Complete Store Listing** - All text and graphics
4. **Set Up Pricing** - Free
5. **Content Rating** - Complete questionnaire
6. **Data Safety** - Fill out form
7. **Privacy Policy** - Add URL
8. **Countries** - Select US/Tennessee
9. **Submit for Review** - Can take 1-7 days

## 🔑 CREDENTIALS TO SAVE

**Keystore Password**: `greenhaus2024!`
**Key Alias**: `greenhaus-key`
**Key Password**: `greenhaus2024!`

**⚠️ BACKUP KEYSTORE FILE TO MULTIPLE SECURE LOCATIONS:**
- File: `android/app/greenhaus-upload-key.keystore`
- Google Drive
- External hard drive
- Password manager

## 🎯 NEXT VERSION INCREMENTS

For future updates:
1. Increment `versionCode` in `android/app/build.gradle` (currently 1)
2. Update `versionName` (currently 1.0.0 → 1.0.1, 1.1.0, etc.)
3. Rebuild AAB: `cd android && ./gradlew bundleRelease`
4. Upload new AAB to Google Play Console

## 📞 SUPPORT

If rejected, common reasons:
1. **Cannabis sales** - Emphasize informational-only nature
2. **Location permissions** - Explain foreground-only usage for store selection
3. **Age verification** - Confirm 21+ gate is working

Appeal template if needed:
```
Dear Google Play Review Team,

This app is strictly informational and educational. It does NOT facilitate
the sale or delivery of marijuana products. Users cannot browse products,
add items to cart, or complete purchases within the app.

The app only provides:
- Store location information
- Store hours
- Educational announcements
- Account management

All transactions must occur in-person at our licensed Tennessee dispensaries.
The app complies with Tennessee state law and Google Play's marijuana policy.

Thank you for your consideration.
```

## 🎉 READY TO SUBMIT!

Once the AAB build completes, you're ready to submit to Google Play Store!
