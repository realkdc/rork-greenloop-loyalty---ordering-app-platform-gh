# Profile Tab Fixes Needed

## Issue 1: Auto-login happening too quickly
**Location:** `INJECT_SCRIPT` - `checkLoginStatus` function
**Fix:** Add a delay after `MAGIC_LINK_REQUESTED` before allowing auto-login detection

## Issue 2: Email extraction using wrong email
**Location:** `handleMessage` - `USER_INFO_EXTRACTED` handler
**Fix:** Always update email if different, even when already authenticated. Clear old customer data before updating.

## Issue 3: Loyalty balance showing 0
**Location:** `useCustomerData` hook
**Fix:** Verify customer is being found correctly. The CSV shows `nikkijo74@msn.com` exists with customer ID `02269032-111f-11f0-fa97-ae13eaec05b9`

## Issue 4: WebView showing half screen
**Location:** WebView rendering logic
**Fix:** Ensure `{!isAuthenticated && (` condition properly hides WebView when authenticated
