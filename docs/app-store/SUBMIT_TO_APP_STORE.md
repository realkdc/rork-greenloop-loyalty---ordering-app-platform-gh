# How to Submit Build 24 to App Store/TestFlight

## Option 1: Submit via EAS CLI (Easiest)

### Step 1: Submit the build
```bash
npx eas submit --platform ios --latest
```

**What this does:**
- Takes your latest iOS build
- Uploads it to App Store Connect
- Automatically adds it to TestFlight

**You'll be prompted:**
- Apple ID login (if not already logged in)
- App-specific password (if 2FA enabled)
- Team selection (choose your organization account)
- App selection (choose GreenHaus)

### Step 2: Wait for processing
- App Store Connect will process the build (5-30 minutes)
- Check status: https://appstoreconnect.apple.com → Your App → TestFlight → iOS Builds

---

## Option 2: Submit Manually via App Store Connect

### Step 1: Download the build
1. Go to https://appstoreconnect.apple.com
2. Log in with your **organization** Apple Developer account
3. Go to **Apps** → **GreenHaus** → **TestFlight** → **iOS Builds**
4. Find your build (Build 24)
5. If not there, go to **EAS Builds** → Download the `.ipa` file

### Step 2: Upload via Transporter (if needed)
1. Download **Transporter** app from Mac App Store
2. Open Transporter
3. Drag and drop your `.ipa` file
4. Click **Deliver**
5. Wait for upload to complete

### Step 3: Add to TestFlight
1. Go to App Store Connect → **Your App** → **TestFlight** → **iOS Builds**
2. Find Build 24
3. Click **Add to TestFlight** (or it may auto-add)
4. Wait for processing (5-30 minutes)

---

## Step 3: Add Review Notes (IMPORTANT!)

### Via App Store Connect:
1. Go to **App Store Connect** → **Your App** → **App Store** → **App Review Information**
2. Scroll to **Notes** section
3. Copy and paste the content from `APP_STORE_REVIEW_NOTES.txt`
4. Click **Save**

### What to paste:
```
App Review Notes - GreenHaus Build 24
==========================================

IMPORTANT: How This App Works
------------------------------

This is a WEBVIEW APP that wraps our existing e-commerce website (greenhauscc.com). We leverage our fully functional Lightspeed e-commerce platform while adding native iOS features.

AUTHENTICATION:
- Uses MAGIC LINKS (SMS/email links) - NO email/password login
- Users enter phone/email → receive link → click to authenticate
- For review: App is pre-configured to auto-authenticate (reviewers can't receive magic links)
- This is NOT a demo mode - it's necessary because reviewers can't receive SMS/email links

PAYMENTS:
- All payments processed by website backend (Lightspeed)
- NO in-app purchases
- NO sandbox/test payments
- Reviewers can view checkout flow but don't need to complete purchase

FULL FUNCTIONALITY:
- Browse products ✅
- Add to cart ✅
- View cart ✅
- Checkout flow ✅
- Order history ✅
- Native iOS features (pull-to-refresh, share, loading states) ✅

WHAT REVIEWERS CAN TEST:
- Open app → Automatically logged in
- Browse products and categories
- Add items to cart
- View checkout flow (no purchase required)
- See order history
- Use native iOS features

WHAT REVIEWERS DON'T NEED:
- Complete real purchase (checkout visible without purchase)
- Enter payment info (payments handled by website)
- Receive magic links (auto-login handles auth)

TECHNICAL DETAILS:
- Platform: React Native + Expo
- WebView: Native iOS WebKit wrapper
- Backend: Lightspeed E-commerce (live production site)
- Payments: Website backend (NOT in-app purchases)
- Authentication: Magic links (passwordless)
- Location: Only when in use (not background)
- Tracking: None (no ATT)

COMPLIANCE:
- ✅ No background location usage
- ✅ No demo/trial messaging
- ✅ Native iOS features implemented
- ✅ Full functionality available
- ✅ Privacy manifest accurate
- ✅ No in-app purchases

This is a production-ready webview app with full e-commerce functionality. The auto-login is a review accommodation for magic link authentication, not a feature limitation.
```

---

## Step 4: Submit for Review

### Via App Store Connect:
1. Go to **App Store Connect** → **Your App** → **App Store** → **1.0.4 Prepare for Submission**
2. Select **Build 24** from the dropdown
3. Fill out any required metadata (if not already filled)
4. Scroll to **App Review Information**
5. Make sure review notes are added (from Step 3)
6. Click **Submit for Review**

### What happens next:
- Apple will review your app (usually 24-48 hours)
- They may accept it, request changes, or reject it
- Check status in **App Store Connect** → **App Review** → **Status**

---

## Step 5: Reply to Previous Rejection (Optional but Recommended)

If you want to proactively address their concerns:

1. Go to **App Store Connect** → **App Review** → **Messages**
2. Find the latest rejection message
3. Click **Contact App Review** or **Reply**
4. Copy and paste the message from `APPLE_REVIEW_RESPONSE_MESSAGE.md`
5. Click **Send**

This explains how your app works and addresses their concerns.

---

## Quick Command Summary

```bash
# Submit latest build to App Store Connect
npx eas submit --platform ios --latest

# Check build status
npx eas build:list

# View build details
npx eas build:view [BUILD_ID]
```

---

## Troubleshooting

### "Build not found"
- Make sure build completed successfully
- Check: `npx eas build:list`
- Make sure you're logged into the correct Apple account

### "App not found in App Store Connect"
- Make sure you created the app in App Store Connect
- Make sure you're using the organization account (not personal)
- Check bundle ID matches: `com.greenhauscc.customer`

### "Build processing failed"
- Check App Store Connect for error messages
- Make sure build number is unique (Build 24)
- Check version number matches: 1.0.4

### "Can't submit for review"
- Make sure build is processed (green checkmark in TestFlight)
- Make sure all required metadata is filled
- Make sure review notes are added

---

## What to Expect

### Timeline:
1. **Build upload:** 5-10 minutes
2. **App Store Connect processing:** 5-30 minutes
3. **TestFlight processing:** Usually automatic
4. **App Review:** 24-48 hours (sometimes faster)

### Status Updates:
- Check **App Store Connect** → **App Review** → **Status**
- You'll get email notifications when status changes
- Reviewers may contact you via App Store Connect messages

---

## Next Steps After Submission

1. **Wait for processing** - Build needs to be processed by Apple
2. **Check TestFlight** - Build should appear in TestFlight
3. **Add review notes** - Make sure review notes are in App Store Connect
4. **Submit for review** - Submit Build 24 for review
5. **Reply to rejection** (optional) - Proactively address their concerns
6. **Wait for review** - Usually 24-48 hours

---

## Good Luck! 🚀

This build addresses both rejection reasons:
- ✅ Background location removed
- ✅ Demo banner removed (auto-login still works for magic links)

The review notes clearly explain how the app works, so Apple should understand it's a webview app with magic link authentication.

**You got this!** 💪

