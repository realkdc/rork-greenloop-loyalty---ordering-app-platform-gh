# Quick Issue Reference - Native Account & Orders

## 🔴 Critical Issues (Fix First)

### 1. WebView Half-Screen
**File:** `app/(tabs)/profile.tsx` line ~830
**Problem:** WebView only shows half-screen, scrollable
**Fix Attempted:** Changed to `StyleSheet.absoluteFillObject`
**Status:** Needs verification

### 2. Premature Auto-Login
**File:** `app/(tabs)/profile.tsx` - `INJECT_SCRIPT` - `checkLoginStatus`
**Problem:** Switches to native UI before magic link completed
**Fix Attempted:** Added 3-second delay, stricter detection
**Status:** May need longer delay (5-10 seconds)

### 3. Email Not Updating on Account Switch
**File:** `app/(tabs)/profile.tsx` - `handleMessage` - `USER_INFO_EXTRACTED`
**Problem:** Still uses old email when switching accounts
**Fix Attempted:** Added email update logic
**Status:** May not be triggering correctly

## ⚠️ Data Issues (Verify)

### 4. Loyalty Balance Always 0
**File:** `hooks/useCustomerData.ts`
**Problem:** Shows 0 points even when customer has balance
**Status:** API returns `loyalty_balance: 0` - may be accurate
**Action:** Verify with Lightspeed admin if balance is actually 0

### 5. Order History Not Loading
**File:** `hooks/useOrderHistory.ts`
**Problem:** Shows "No orders yet" or errors
**Status:** Need to test with customer who has orders
**Action:** Add more logging, verify API calls

## 🛠️ Code Quality

### 6. File Too Large
**File:** `app/(tabs)/profile.tsx` - **1762 lines**
**Action:** Split into smaller components

### 7. Sign Out Not Clearing Cookies
**File:** `app/(tabs)/profile.tsx` - `handleSignOut`
**Status:** Cookie clearing added but may not be working
**Action:** Verify cookies are actually cleared

## 📝 Quick Fixes to Try Tomorrow

1. **WebView Full Screen:**
   - Check parent View styles
   - Ensure no ScrollView wrapping WebView
   - Verify `!isAuthenticated` condition

2. **Login Detection:**
   - Increase delay to 5-10 seconds
   - Require actual account dashboard, not just email
   - Only trigger after URL change with `key=` parameter

3. **Email Update:**
   - Add logging to see if `USER_INFO_EXTRACTED` is received
   - Verify `updateUser` is saving to storage
   - Clear React Query cache on email change

4. **Loyalty Balance:**
   - Check Lightspeed admin for actual balance
   - Test with customer who definitely has points
   - Verify conversion formula

5. **Order History:**
   - Add detailed logging to `useOrderHistory`
   - Test with customer who has orders
   - Verify `getCustomerSales` API call

## 🔍 Debug Commands

Check if customer exists:
```bash
grep -i "email@example.com" all_customers_2026-01-06.csv
```

Check terminal logs for:
- `[useCustomerData]` - Customer lookup
- `[useOrderHistory]` - Order fetching
- `[ProfileTab]` - Component state
- `[LightspeedClient]` - API calls

## 📁 Key Files

- `app/(tabs)/profile.tsx` - Main Account tab (1762 lines)
- `hooks/useCustomerData.ts` - Customer data hook
- `hooks/useOrderHistory.ts` - Order history hook
- `lib/lightspeedClient.ts` - API client
- `contexts/AuthContext.tsx` - User state management

---

**See full details:** `docs/NATIVE_ACCOUNT_ORDERS_STATUS.md`
