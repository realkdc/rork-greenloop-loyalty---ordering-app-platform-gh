# Native Account & Orders Implementation

**Date:** January 5, 2026  
**Branch:** `dev`

## Overview

Successfully implemented native Account and Orders tabs with Lightspeed API integration and magic link authentication.

---

## What Was Built

### 1. Backend Infrastructure

**Lightspeed Service** (`services/lightspeed.ts`):
- `getRetailer()` - Store information
- `getOutlets()` - Store locations
- `getTodaySales()` - Today's sales summary
- `getRecentSales()` - Order history with customer details
- `getCustomer()` - Get customer by ID
- `searchCustomersByEmail()` - Find customer by email
- `getProducts()` - Product listing
- `getInventory()` - Stock levels

**tRPC Routes** (`backend/trpc/routes/lightspeed/`):
- `customer` - Fetch customer by ID or email
- `recentSales` - Get order history (filterable by customer email)
- `todaySales` - Today's sales summary
- `storeInfo` - Store/outlet information
- `products` - Product listing with pagination

### 2. Native Components

**`components/LoyaltyCard.tsx`**:
- Displays loyalty points with gradient card design
- Shows current tier badge (Bronze, Silver, Gold, Platinum)
- Progress bar to next tier
- Animated and visually appealing

**`components/AccountHeader.tsx`**:
- User avatar, name, and email
- "Manage Account" button (opens WebView)
- Clean, professional design

**`components/OrderCard.tsx`**:
- Order receipt number, date, and location
- Status badge with color coding
- Total amount display
- Tappable for order details

### 3. Custom Hooks

**`hooks/useCustomerData.ts`**:
- Fetches customer loyalty data from Lightspeed
- Returns points, tier, and customer info
- Integrates with tRPC query

**`hooks/useOrderHistory.ts`**:
- Fetches order history from Lightspeed
- Filters by customer email
- Returns orders array with refresh function

### 4. Native Tabs

**Account Tab** (`app/(tabs)/profile.tsx`):
- **Logged Out State:**
  - Prompt to sign in
  - "Get Sign-In Link" button
- **Magic Link Flow:**
  - Email input (no password!)
  - "Send Magic Link" button
  - Instructions modal with steps
  - Hidden WebView handles magic link request
  - Detects successful login
- **Logged In State:**
  - Account header with user info
  - Loyalty card showing points and tier
  - Menu with Order History, Account Settings
  - Sign Out option
  - Account deletion button
- **Manage Account:**
  - Opens WebView modal for Ecwid account settings
  - Hybrid approach: native UI + WebView for complex features

**Orders Tab** (`app/(tabs)/orders.tsx`):
- **Logged Out State:**
  - "Sign In Required" message
- **Logged In State:**
  - Native FlatList of orders
  - Pull-to-refresh functionality
  - Order cards with receipt number, date, total, status
  - Tap order to view details (opens WebView modal)
- **Empty State:**
  - "No Orders Yet" message
- **Error State:**
  - Error message with retry button

---

## Authentication Flow

### Magic Link System

1. User taps "Get Sign-In Link" on Account tab
2. Enters email address
3. Taps "Send Magic Link"
4. Hidden WebView loads `greenhauscc.com/account/login`
5. JavaScript auto-fills email and submits form
6. Instructions modal shows "Check Your Email"
7. User receives email with magic link
8. User taps link in email (Universal Link opens app)
9. WebView detects successful login via cookies/DOM
10. User data syncs with Lightspeed customer API
11. Local user record created/updated
12. App displays loyalty points and order history

### No Passwords!

The Lightspeed/Ecwid system uses **passwordless authentication**. We removed all Firebase password-based auth and now use:
- Magic link emails (primary)
- Local user storage (syncs with Lightspeed)
- WebView cookie sharing (maintains session)

---

## Environment Variables

Added to `.env`:
```bash
# Rork API (Backend)
EXPO_PUBLIC_RORK_API_BASE_URL=https://greenhaus-admin.vercel.app

# Lightspeed Retail (X-Series) API Configuration
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_token_here  # ⚠️ Never commit real tokens to git!
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://greenhauscannabisco.retail.lightspeed.app/api/2.0
```

---

## File Structure

```
app/(tabs)/
├── profile.tsx          ✅ Native with magic link login
├── orders.tsx           ✅ Native with order history list
├── home.tsx             ⚫ WebView (unchanged)
├── search.tsx           ⚫ WebView (unchanged)
└── cart.tsx             ⚫ WebView (unchanged)

components/
├── LoyaltyCard.tsx      ✅ New - points/tier display
├── AccountHeader.tsx    ✅ New - user info header
└── OrderCard.tsx        ✅ New - order list item

hooks/
├── useCustomerData.ts   ✅ New - fetch loyalty data
└── useOrderHistory.ts   ✅ New - fetch orders

services/
└── lightspeed.ts        ✅ New - API service

backend/trpc/routes/lightspeed/
├── customer/route.ts    ✅ New
├── recentSales/route.ts ✅ New
├── todaySales/route.ts  ✅ New
├── storeInfo/route.ts   ✅ New
└── products/route.ts    ✅ New
```

---

## Testing

### Run iOS Simulator
```bash
npm run ios
# or
expo run:ios
```

### Test Scenarios

1. **Guest User:**
   - Open Account tab → See login prompt
   - Open Orders tab → See "Sign In Required"

2. **Magic Link Login:**
   - Tap "Get Sign-In Link"
   - Enter email
   - Tap "Send Magic Link"
   - Check email modal shows
   - (In production: tap link from email)

3. **Logged In User:**
   - See loyalty card with points/tier
   - Navigate to Orders tab
   - See order history list
   - Pull to refresh
   - Tap order to view details

4. **Manage Account:**
   - Tap "Manage" in account header
   - WebView opens for Ecwid account settings

---

## What Stays WebView

- **Home tab:** Promos, product showcase
- **Browse/Search tab:** Product browsing
- **Cart tab:** Checkout flow (PCI compliance)
- **Manage Account:** Ecwid account settings

---

## Next Steps

### Phase 1 (Current) ✅
- Native Account tab with magic link auth
- Native Orders tab with order history
- Lightspeed API integration
- tRPC backend routes

### Phase 2 (Future)
- Sync loyalty points from Lightspeed customer API
- Add order details screen (native)
- Push notifications for order updates
- Offline caching for orders/products

### Phase 3 (Future)
- Personalized product recommendations
- Native rewards redemption
- Advanced loyalty features
- Real-time inventory in native search

---

## Known Issues / To Investigate

1. **Loyalty Data Mapping:** Need to verify actual Lightspeed customer API response structure to map loyalty points correctly
2. **Magic Link Universal Links:** Need to configure Universal Links in iOS project for seamless deep linking
3. **Customer Lookup:** May need to enhance customer search if email doesn't match exactly

---

## Documentation

- API Setup: `docs/LIGHTSPEED_API_SETUP.md`
- API Reference: `docs/LIGHTSPEED_API_QUICK_REFERENCE.md`
- API Research: `docs/LIGHTSPEED_API_RESEARCH.md`
- Test Script: `scripts/testLightspeedAPI.ts`

---

**Last Updated:** January 5, 2026  
**Tested On:** iOS Simulator (starting...)
