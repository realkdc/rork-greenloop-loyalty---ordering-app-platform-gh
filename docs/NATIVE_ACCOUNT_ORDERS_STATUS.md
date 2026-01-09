# Native Account & Orders Implementation - Status Summary

**Date:** January 6, 2026  
**Branch:** `dev`  
**Status:** In Progress - Multiple Issues to Resolve

## Overview

We've implemented native Account and Orders tabs that integrate with the Lightspeed API. The app uses a hybrid approach: WebView for login (magic link), then native UI for account management and order history.

## What's Working ✅

1. **Lightspeed API Integration**
   - Direct API client (`lib/lightspeedClient.ts`) bypassing tRPC
   - Customer search by email using `/search?type=customers&q=` endpoint
   - Customer data fetching (name, email, loyalty_balance)
   - Order history fetching

2. **Email Extraction**
   - WebView JavaScript injection extracts email from account page
   - Email cleaning (removes "Edit" suffix and other artifacts)
   - Email stored in AuthContext and used for API calls

3. **Customer Data Display**
   - Account header shows customer name and email from Lightspeed
   - Loyalty card displays points and tier
   - Points calculated from `loyalty_balance` (dollars to points conversion)

4. **Customer Lookup**
   - Successfully finding customers in Lightspeed by email
   - Example: Found `nikkijo74@msn.com` → Customer ID `02269032-111f-11f0-fa97-ae13eaec05b9`

## Current Issues 🔴

### 1. WebView Display Issues
**Problem:** WebView showing half-screen and scrollable instead of full screen
- **Location:** `app/(tabs)/profile.tsx` - WebView rendering
- **Status:** Partially fixed (changed to `StyleSheet.absoluteFillObject` but may need more work)
- **Impact:** Poor UX when not authenticated

### 2. Premature Auto-Login
**Problem:** App switches to native UI before user completes magic link login
- **Location:** `INJECT_SCRIPT` - `checkLoginStatus` function
- **Status:** Partially fixed (added 3-second delay, stricter detection)
- **Impact:** Users see native UI before they're actually logged in

### 3. Email Extraction on Account Switch
**Problem:** When switching accounts, app still uses old email for API calls
- **Location:** `handleMessage` - `USER_INFO_EXTRACTED` handler
- **Status:** Partially fixed (email update logic exists but may not be triggering)
- **Impact:** Wrong customer data displayed when switching accounts

### 4. Loyalty Balance Showing 0
**Problem:** Loyalty balance always shows 0, even when customer has points
- **Location:** `useCustomerData` hook - points calculation
- **Status:** Unknown - API returns `loyalty_balance: 0` from Lightspeed
- **Impact:** Users see 0 points even if they have loyalty balance
- **Note:** CSV shows `loyalty_balance: 0` for test customers - may be accurate data

### 5. Order History Not Loading
**Problem:** Orders page shows "No orders yet" or errors
- **Location:** `useOrderHistory` hook
- **Status:** Unknown - need to verify API calls are working
- **Impact:** Users can't see their order history

### 6. Sign Out Not Clearing WebView Session
**Problem:** After sign out, user is still logged in on WebView
- **Location:** `handleSignOut` function
- **Status:** Partially fixed (added cookie clearing, but may not be working)
- **Impact:** Users can't fully sign out

## Technical Details

### File Structure
```
app/(tabs)/
  ├── profile.tsx          # Native Account tab (1762 lines - TOO LARGE)
  └── orders.tsx           # Native Orders tab

hooks/
  ├── useCustomerData.ts   # Fetches customer data from Lightspeed
  └── useOrderHistory.ts   # Fetches order history from Lightspeed

lib/
  └── lightspeedClient.ts  # Direct Lightspeed API client

components/
  ├── AccountHeader.tsx    # Account header with name/email
  ├── LoyaltyCard.tsx      # Loyalty points display
  └── OrderCard.tsx        # Individual order display
```

### Key Functions

**Email Extraction Flow:**
1. WebView detects login (`USER_LOGGED_IN` message)
2. JavaScript injected to extract email from page
3. Email sent to native via `USER_INFO_EXTRACTED` message
4. Native app updates `AuthContext` with email
5. `useCustomerData` hook uses email to fetch customer from Lightspeed

**Customer Data Flow:**
1. `useCustomerData` hook gets email from `AuthContext`
2. Cleans email (removes "Edit", validates format)
3. Calls `searchCustomersByEmail(cleanedEmail)`
4. Uses `/search?type=customers&q=` endpoint
5. Filters to exact email matches
6. Returns customer data (name, email, loyalty_balance)
7. Converts `loyalty_balance` (dollars) to points (multiply by 100)

## Known Issues Breakdown

### Issue 1: WebView Half-Screen
**Symptoms:**
- WebView only takes up half the screen
- Can scroll within that half-screen area
- Should be full screen when not authenticated

**Attempted Fixes:**
- Changed `style={styles.webview}` to `StyleSheet.absoluteFillObject`
- Changed to `{ flex: 1, width: '100%', height: '100%' }`
- Conditional rendering: `{!isAuthenticated && (<WebView .../>)}`

**Next Steps:**
- Verify WebView is not being constrained by parent View
- Check if ScrollView or other container is affecting layout
- Ensure WebView is only rendered when `!isAuthenticated`

### Issue 2: Premature Auto-Login
**Symptoms:**
- App switches to native UI immediately
- User hasn't completed magic link login yet
- WebView login page still visible but native UI shows

**Attempted Fixes:**
- Added 3-second delay before login check
- Made login detection stricter (requires auth cookie AND account elements)
- Added `magicLinkRequested` flag to prevent early detection

**Next Steps:**
- Increase delay to 5-10 seconds
- Make detection even stricter (require actual account dashboard, not just email on page)
- Only trigger after magic link is processed (detect URL change with `key=` parameter)

### Issue 3: Email Extraction on Account Switch
**Symptoms:**
- When logging in with different account, app still uses old email
- Example: Logged in as `nikkijo74@msn.com` but app still searches for `kdcxmusic@gmail.com`

**Attempted Fixes:**
- Added email update logic in `handleMessage`
- Always update email if different, even when authenticated
- Force refetch customer data after email update

**Next Steps:**
- Verify email extraction is triggering on account switch
- Add logging to see if `USER_INFO_EXTRACTED` is received
- Ensure `updateUser` is actually updating the email in storage
- Clear React Query cache when email changes

### Issue 4: Loyalty Balance 0
**Symptoms:**
- Loyalty balance always shows 0
- Even for customers who should have points

**Investigation:**
- API returns `loyalty_balance: 0` from Lightspeed
- CSV export also shows `loyalty_balance: 0` for test customers
- May be accurate data (customers haven't earned points yet)

**Next Steps:**
- Verify with Lightspeed admin if loyalty balance is actually 0
- Check if there's a different field for loyalty points
- Test with a customer who definitely has points
- Verify the conversion formula (dollars to points)

### Issue 5: Order History Not Loading
**Symptoms:**
- Orders page shows "No orders yet"
- Or shows error messages
- No terminal logs showing API calls

**Investigation:**
- `useOrderHistory` hook exists and should fetch orders
- Uses `getCustomerSales(email, limit)` from `lightspeedClient`
- May not be finding orders for the customer

**Next Steps:**
- Add more logging to `useOrderHistory`
- Verify `getCustomerSales` is working correctly
- Check if customer has orders in Lightspeed
- Test API directly with customer email

### Issue 6: Sign Out Not Working
**Symptoms:**
- After sign out, user is still logged in on WebView
- WebView shows account page instead of login page

**Attempted Fixes:**
- Added cookie clearing in `handleSignOut`
- Added hidden WebView for cookie clearing
- Clears localStorage and sessionStorage

**Next Steps:**
- Verify cookies are actually being cleared
- Check if WebView needs to be reloaded after cookie clear
- May need to use React Native WebView's cookie manager
- Consider clearing all WebView instances, not just profile tab

## Code Quality Issues

### 1. File Size
- `app/(tabs)/profile.tsx` is **1762 lines** - TOO LARGE
- Should be split into smaller components
- Makes debugging and maintenance difficult

### 2. Duplicate Code
- Email cleaning logic duplicated in multiple places
- Should be centralized in a utility function

### 3. Complex State Management
- Multiple WebView refs (main, hidden, manage account, sign out)
- Multiple useEffect hooks with complex dependencies
- Hard to track state changes

## Recommended Next Steps

### Priority 1: Fix Critical UX Issues
1. **WebView Full Screen** - Ensure WebView takes full screen when not authenticated
2. **Prevent Premature Login** - Make login detection stricter and add longer delay
3. **Email Extraction** - Ensure email updates correctly when switching accounts

### Priority 2: Verify Data Accuracy
1. **Loyalty Balance** - Verify if 0 is correct or if there's a data issue
2. **Order History** - Test with customer who has orders, verify API calls
3. **Customer Lookup** - Verify all customers are being found correctly

### Priority 3: Code Refactoring
1. **Split profile.tsx** - Break into smaller components
2. **Centralize Email Cleaning** - Create utility function
3. **Simplify State** - Reduce number of WebView refs and effects

## Testing Checklist

- [ ] WebView shows full screen when not authenticated
- [ ] WebView doesn't show when authenticated
- [ ] Login detection waits for magic link completion
- [ ] Email extraction works when switching accounts
- [ ] Customer data loads correctly for different accounts
- [ ] Loyalty balance displays correctly (if > 0)
- [ ] Order history loads for customers with orders
- [ ] Sign out clears WebView session completely
- [ ] No "Edit" suffix in email display
- [ ] Account header shows correct name and email

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_token_here  # ⚠️ Never commit real tokens to git!
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://greenhauscannabisco.retail.lightspeed.app/api/2.0
```

## API Endpoints Used

- `/search?type=customers&q={email}` - Search customers by email
- `/customers?email={email}` - Fallback customer search
- `/search?type=sales&page_size={limit}` - Get recent sales
- `/sales/{saleId}` - Get sale details
- `/outlets` - Get outlet/location info

## Key Learnings

1. **Lightspeed API**: The `/search` endpoint is more reliable than `/customers?email=` for email searches
2. **Email Cleaning**: Need to remove "Edit" suffix and validate email format
3. **React Query**: Using cleaned email in `queryKey` ensures automatic refetch when email changes
4. **WebView Login**: Magic link system requires WebView for login, then native UI for account management
5. **Customer Data**: Only customers who have made purchases are in the Lightspeed POS system

## Files Modified

- `app/(tabs)/profile.tsx` - Native Account tab implementation
- `app/(tabs)/orders.tsx` - Native Orders tab implementation
- `hooks/useCustomerData.ts` - Customer data fetching hook
- `hooks/useOrderHistory.ts` - Order history fetching hook
- `lib/lightspeedClient.ts` - Direct Lightspeed API client
- `components/AccountHeader.tsx` - Account header component
- `components/LoyaltyCard.tsx` - Loyalty points display
- `components/OrderCard.tsx` - Order card component
- `contexts/AuthContext.tsx` - Email cleaning in signIn/updateUser

## Notes for Tomorrow

1. Start with WebView full-screen issue - most visible problem
2. Then fix premature login detection - critical for UX
3. Verify loyalty balance data - may need to check Lightspeed admin
4. Test order history with customer who has orders
5. Consider splitting profile.tsx into smaller files

---

**Last Updated:** January 6, 2026  
**Next Session:** Focus on one issue at a time, starting with WebView display
