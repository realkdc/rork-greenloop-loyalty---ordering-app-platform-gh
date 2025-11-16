# Testing Notes - Latest Fixes

## How to Run on Your Phone

1. Make sure your phone and computer are on the same WiFi network
2. Run: `npx expo start --dev-client`
3. Scan the QR code with your phone camera (iOS) or Expo Go app (Android)
4. The app should install and run

## What Was Fixed

### 1. Native Spinner Blocking Content (app/index.tsx)
**Problem**: White screen with spinner blocking the home page content
**Fix**: Added `navigating` state that hides the splash screen as soon as navigation starts
**Test**: App should load directly to home page without white screen blocking content

### 2. Enhanced Image Quality (components/WebShell.tsx)
**Problem**: Product images loading blurry
**Fix**:
- Removes Ecwid size constraints from image URLs
- Forces higher resolution images (1200x1200)
- Removes blur filters from images
- Runs aggressively every 200ms to catch lazy-loaded images

**Test**: Product images should load clearer/sharper (though Ecwid's lazy loading may still cause brief blur)

### 3. Tab Navigation Simplified
**Problem**: Tab switching was unreliable, causing white screens
**Fix**: Removed all forced navigation logic - each tab maintains its own WebView state
**Test**:
- Switching between tabs should work smoothly
- Each tab remembers where you were (e.g., if you navigate to a product in Home tab, switch to Cart, then back to Home, you'll still be on that product page)
- This is normal tab behavior - tabs don't "reset" when you switch away and back

## Known Issues (iOS Simulator)

The iOS Simulator is known to be:
- Slow with WebViews
- Glitchy with touch interactions
- Unreliable for testing real performance

**These issues should NOT occur on a real device.**

## What to Test on Real Device

1. **App Launch**: Should go straight to home page in DEMO_MODE, no blocking spinner
2. **Home Page**: Should load greenhauscc.com homepage with reasonably clear images
3. **Tab Switching**: Tap between Home, Browse, Cart, Orders, Account tabs - should switch smoothly
4. **Product Browsing**: Navigate to products, add to cart, view cart
5. **Image Quality**: Check if product images are clearer than before (they may still start blurry briefly due to Ecwid's lazy loading)

## Console Logs

When running with `npx expo start --dev-client`, logs will appear in the terminal automatically.

Look for these log patterns:
- `[Index] 🎬 RENDERING` - App initialization
- `[HomeTab] 🏠 Tab focused` - Tab switching
- `[WebShell:home]` - WebView events
- `[ImageFix]` - Image quality improvements

## If Things Still Don't Work

The most common issues:
1. **Metro bundler cache**: Run `npx expo start --clear` to clear cache
2. **Node modules**: Run `npm install` to ensure dependencies are up to date
3. **iOS build cache**: Run `npx expo run:ios --clean` to rebuild from scratch

## Files Modified in This Session

- `app/index.tsx` - Fixed splash screen blocking issue
- `app/(tabs)/home.tsx` - Simplified tab focus handling
- `app/(tabs)/cart.tsx` - Simplified tab focus handling
- `app/(tabs)/search.tsx` - Simplified tab focus handling
- `components/WebShell.tsx` - Enhanced image quality fixer

All changes are committed and ready for testing on real device.
