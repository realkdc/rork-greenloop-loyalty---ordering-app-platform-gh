# App Review Notes - Build 24
**GreenHaus Cannabis Co. - iOS App**

---

## App Overview

**GreenHaus** is a **WEBVIEW APP** that wraps our existing e-commerce website (greenhauscc.com), providing a native iOS experience for our licensed cannabis dispensary customers in Tennessee.

**This is an intentional architectural decision** - we leverage our fully functional Lightspeed e-commerce platform while adding native iOS features.

This app:
- ✅ **Webview wrapper** - Provides native iOS experience for existing website
- ✅ **Native iOS features** - Pull-to-refresh, native share sheets, loading states
- ✅ **Fully functional website** - All e-commerce features work (browse, cart, checkout)
- ✅ **Website backend payments** - All payments processed by Lightspeed (NOT in-app purchases)
- ✅ **Magic link authentication** - Passwordless login via SMS/email links
- ✅ **Complies with App Store requirements** - Privacy, tracking, location usage

---

## How This App Works

**GreenHaus is a WEBVIEW APP** that wraps our existing e-commerce website (greenhauscc.com). We leverage our fully functional Lightspeed e-commerce platform while adding native iOS features.

### Authentication
- **Uses MAGIC LINKS (SMS/email links)** - NO email/password login exists
- Users enter phone/email → receive unique link → click to authenticate
- **For review:** App is pre-configured to auto-authenticate (reviewers can't receive magic links)
- **This is NOT a demo mode** - it's necessary because reviewers can't receive SMS/email links

### Payments
- **All payments processed by website backend (Lightspeed)**
- NO in-app purchases
- NO sandbox/test payments
- Reviewers can view checkout flow but don't need to complete purchase

### Test Account Access
**The app is pre-configured to automatically authenticate reviewers when launched.** No manual login required - you'll be automatically logged in and have full access to all features.

---

## How to Test the App

### 1. **Initial Launch**
   - App will request location permission (tap "Allow While Using App")
   - You'll be logged in automatically or use the test credentials above
   - The home screen will load the main shop interface

### 2. **Key Features to Test**
   - **Browse Products:** Scroll through product categories and listings
   - **Pull-to-Refresh:** Pull down on any page to refresh content (native iOS feature)
   - **Native Share:** Tap any product, then use the share button (native iOS share sheet)
   - **Add to Cart:** Add products to cart and view cart
   - **Order History:** View past orders in the Profile tab
   - **Search:** Use the search tab to find products

### 3. **Checkout Flow** (Optional to Test)
   - You can add items to cart and proceed through checkout
   - All payment processing is handled securely by our Lightspeed e-commerce backend (website)
   - **You do NOT need to complete a real purchase to review the app**
   - **You do NOT need to enter payment information** - payments are handled by website backend
   - The checkout flow demonstrates the app's integration with our existing website infrastructure
   - **This is a webview app** - all payments go through the website, not in-app purchases

---

## What Changed in Build 24

### Fixed Issues:
1. ✅ **Removed background location declaration** (Guideline 2.5.4)
   - Removed `location` from `UIBackgroundModes` 
   - App only uses location when in use, not in background

2. ✅ **Removed demo/trial mode** (Guideline 2.2)
   - App now provides full, production-ready functionality
   - Test account provides real logged-in experience
   - No "demo mode" banners or limitations

### Native Features:
- Pull-to-refresh on all webview pages
- Native iOS share sheet for product sharing
- Native loading states and error handling
- Deep linking support for marketing campaigns

---

## Technical Architecture

- **Platform:** React Native + Expo
- **WebView:** Native iOS WebKit wrapper
- **Backend:** Lightspeed E-commerce (fully functional, live production site)
- **Payments:** Handled entirely by website backend (NOT in-app purchases)
- **Location:** Only requested when in use to show nearby store locations
- **Tracking:** None - we do NOT use App Tracking Transparency

---

## Questions or Issues?

If you encounter any issues during review, please contact us through App Store Connect.

**Common Questions:**

**Q: Can I complete a real purchase?**  
A: You can proceed through checkout, but we recommend NOT completing real purchases. The checkout flow demonstrates functionality without requiring a real transaction.

**Q: Why does the app show a website?**  
A: This is intentional. GreenHaus is a **WEBVIEW APP** that wraps our existing e-commerce website. We leverage our fully functional Lightspeed e-commerce platform while adding native iOS features. This is a valid app architecture accepted by Apple.

**Q: Why can't I log in manually?**  
A: Our website uses **magic link authentication** (SMS/email links), not email/password. Since reviewers can't receive magic links, the app is pre-configured to auto-authenticate. This is standard practice for apps with magic link/2FA/SSO authentication.

**Q: How do I test payments?**  
A: You don't need to complete a real purchase. You can view the checkout flow, but payments are processed by our website backend (Lightspeed), not in-app purchases. There is no sandbox/test payment environment - all payments go through the live website.

**Q: Do I need to be in Tennessee?**  
A: No geographic restrictions are enforced for this review build.

---

## Compliance Checklist

- ✅ No App Tracking Transparency (ATT) required
- ✅ No persistent background location usage
- ✅ Location purpose string clearly explains usage
- ✅ Native iOS features implemented (not just a browser)
- ✅ Full functionality available for review (not demo/trial)
- ✅ Privacy manifest included and accurate
- ✅ No in-app purchases (payments handled by website)

---

**Thank you for reviewing GreenHaus!**

