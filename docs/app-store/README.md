# App Store Submission Documentation

This folder contains all documentation related to Apple App Store submission and review.

## Current Submission: Build 24

### Files:
- **APP_STORE_REVIEW_NOTES.txt** - Review notes to paste into App Store Connect
- **APPLE_REVIEW_NOTES_BUILD_24.md** - Detailed review notes and FAQ
- **APPLE_REVIEW_RESPONSE_MESSAGE.md** - Response message for rejection appeals
- **BUILD_24_SUMMARY.md** - Summary of changes in Build 24
- **SUBMIT_TO_APP_STORE.md** - Step-by-step submission guide
- **MAGIC_LINK_AUTH_EXPLANATION.md** - Explanation of magic link authentication
- **DEMO_MODE_TOGGLE.md** - Demo mode configuration guide
- **ORG_BUILD_GUIDE.md** - Organization account build guide
- **APPLE_APP_STORE_FIX.md** - Previous fixes documentation

## Quick Reference

### To Submit Build 24:
1. Build: `npx eas build --platform ios --profile production`
2. Submit: `npx eas submit --platform ios --latest`
3. Add review notes from `APP_STORE_REVIEW_NOTES.txt` to App Store Connect
4. Submit for review in App Store Connect

### To Reply to Rejection:
1. Go to App Store Connect → App Review → Messages
2. Copy message from `APPLE_REVIEW_RESPONSE_MESSAGE.md`
3. Paste and send

## Build 24 Changes

- ✅ Removed background location declaration (Guideline 2.5.4)
- ✅ Removed demo banner (Guideline 2.2)
- ✅ Kept auto-login (necessary for magic link authentication)
- ✅ Build number: 24
- ✅ Version: 1.0.4

## Key Points for Reviewers

1. **Webview App** - Wraps existing e-commerce website (intentional architecture)
2. **Magic Link Auth** - No email/password, auto-login required for review
3. **Website Payments** - All payments processed by Lightspeed backend (not in-app purchases)
4. **Full Functionality** - Not a demo, provides complete e-commerce experience
5. **Native Features** - Pull-to-refresh, share sheet, loading states

## Links

- App Store Connect: https://appstoreconnect.apple.com/apps/6754898523
- TestFlight: https://appstoreconnect.apple.com/apps/6754898523/testflight/ios
- Review Messages: https://appstoreconnect.apple.com/apps/6754898523/appstore/review/messages

