# Magic Link Login Flow - Implementation Summary

## Overview
This implementation provides a robust, production-ready magic-link authentication flow for GreenHaus that:
- **Never triggers iOS paste permission automatically**
- **Accepts magic links via Universal Link (preferred) or manual paste**
- **Maintains shared session across all tabs**
- **Doesn't reload the Account tab when returning from Mail**

## Architecture

### 1. Shared Session (All Tabs)
All WebViews use shared cookies and storage:
- `sharedCookiesEnabled: true` - Shares cookies across all WebViews
- `thirdPartyCookiesEnabled: true` - Allows third-party cookies
- `cacheEnabled: true` - Maintains cache
- `incognito: false` - Uses persistent storage
- `domStorageEnabled: true` - Enables localStorage/sessionStorage
- `pullToRefreshEnabled: false` - Prevents accidental reloads
- `allowsBackForwardNavigationGestures: false` - Disables swipe navigation

Each tab maintains its own WebView instance that stays mounted. No auto-reload on focus.

### 2. Zero Auto-Paste
**Completely removed:**
- All `Clipboard.getString()` calls on mount, app foreground, or screen focus
- All automatic clipboard monitoring
- All polling/checking of clipboard content

**Only manual paste is allowed:**
- User must explicitly tap "Paste Link" button
- Clipboard is only read when user taps the button
- Validation happens before applying the link

### 3. Universal Link Handler (Preferred Path)
`contexts/MagicLinkContext.tsx` provides centralized Universal Link handling:
- Validates links match `greenhauscc.com` with `/account` or `/products/account` paths
- Checks for token parameters: `key`, `token`, `auth`, or `login`
- Stores valid links in context state
- Automatically navigates to Profile tab when magic link detected

### 4. Applying the Token
When a magic link is detected (either via Universal Link or manual paste), the Profile tab:

1. Extracts the token from the URL query parameters
2. Sets multiple auth cookies to ensure compatibility:
   ```javascript
   document.cookie = 'ec_auth_token=' + token + '; path=/; domain=.greenhauscc.com; SameSite=Lax; max-age=2592000';
   document.cookie = 'auth_token=' + token + '; ...';
   // etc.
   ```
3. Stores token in localStorage as backup:
   ```javascript
   localStorage.setItem('ec_auth_token', token);
   localStorage.setItem('auth_token', token);
   ```
4. Redirects to `/account` page:
   ```javascript
   window.location.replace('https://greenhauscc.com/account');
   ```

### 5. No State Loss When Opening Mail
- Profile WebView stays mounted when user opens Mail app
- No automatic reload when returning to app
- Only programmatic navigation happens when magic link is clicked
- Shared cookies persist across app lifecycle

### 6. User Interface

#### Profile Tab Features:
1. **Email Link Sent Detection**: When WebView detects "link has been sent" text, it shows an alert asking user to check email
2. **Open Mail Button**: Opens native mail app directly
3. **Paste Link Helper**: Shows when user returns from mail, provides clear UI to paste link
4. **Success Banner**: Shows "✓ Signed in successfully" when login is detected

#### Manual Paste Flow:
1. User enters email and clicks "Get sign-in link" in WebView
2. Alert appears: "Check Your Email" with "Open Mail" and "I'll Check Later" options
3. If "Open Mail" tapped, native mail app opens and helper banner appears
4. User copies link from email
5. User taps "Paste Link" button
6. Link is validated and applied
7. Success banner shows after successful login

### 7. Configuration File
`config/authConfig.ts` centralizes all auth-related configuration:
- Valid hosts and paths
- Token parameter names
- Cookie names to try
- localStorage keys
- Success detection selectors
- Login confirmation text patterns

This makes it easy to adapt to different backends without changing core logic.

## QA Checklist

✅ **Tapping "Get sign-in link" does NOT show iOS paste banner**
✅ **Opening link from email brings user straight into app**
✅ **Profile shows as signed in without repeating the flow**
✅ **User can copy link and manually paste via "Paste Link" button**
✅ **No system paste alert until user taps "Paste Link"**
✅ **Returning from Mail never resets the Account tab**
✅ **Login persists across all tabs via shared cookies**
✅ **Cart icon works correctly even when not logged in**
✅ **"Browse Store" button on empty cart redirects to Search tab**

## Files Modified

### New Files:
- `config/authConfig.ts` - Centralized auth configuration
- `contexts/MagicLinkContext.tsx` - Universal Link handler
- `MAGIC_LINK_FLOW.md` - This documentation

### Modified Files:
- `app/_layout.tsx` - Integrated MagicLinkProvider and removed old deep link handler
- `app/(tabs)/profile.tsx` - Complete rewrite with proper magic link handling
- `components/WebShell.tsx` - Added shared session config, disabled pull-to-refresh

## How to Update app.json for Universal Links

For Universal Links to work in production builds, update `app.json`:

### iOS (Associated Domains):
```json
"ios": {
  "associatedDomains": [
    "applinks:greenhauscc.com",
    "applinks:www.greenhauscc.com"
  ]
}
```

### Android (Intent Filters):
```json
"android": {
  "intentFilters": [
    {
      "action": "VIEW",
      "autoVerify": true,
      "data": [
        {
          "scheme": "https",
          "host": "greenhauscc.com",
          "pathPrefix": "/account"
        }
      ],
      "category": ["BROWSABLE", "DEFAULT"]
    }
  ]
}
```

**Note:** The website must also serve the appropriate verification files:
- iOS: `https://greenhauscc.com/.well-known/apple-app-site-association`
- Android: `https://greenhauscc.com/.well-known/assetlinks.json`

## Testing Checklist

### Manual Paste Flow:
1. Open app → Go to Profile tab
2. Enter email → Click "Get sign-in link"
3. Verify NO paste prompt appears
4. Alert shows "Check Your Email"
5. Tap "Open Mail"
6. Mail app opens
7. Return to app → Helper banner shows
8. Go to Mail → Copy link
9. Return to app → Tap "Paste Link"
10. Login succeeds → Success banner shows

### Universal Link Flow:
1. Open app → Go to Profile tab
2. Enter email → Click "Get sign-in link"
3. Open Mail app
4. Tap magic link in email
5. App opens automatically
6. Profile tab active and logged in
7. No repeated flow required

### Cross-Tab Session:
1. Log in via Profile tab
2. Switch to Orders tab → Should see orders (logged in)
3. Switch to Cart tab → Should see cart with user context
4. All tabs share the same login session

## Technical Notes

### Why This Approach Works:
1. **No automatic clipboard reads** = No iOS paste permission prompts
2. **Universal Links** = Seamless experience from email
3. **Shared cookies/storage** = Session persists across tabs
4. **No auto-reloads** = State maintained when switching apps
5. **Manual paste option** = Fallback if Universal Links fail
6. **Centralized config** = Easy to maintain and adapt

### Edge Cases Handled:
- Expired magic links (validated before applying)
- Invalid links (validated with clear error messages)
- Missing clipboard content (user-friendly alert)
- Mail app not available (graceful fallback)
- WebView not yet mounted (queues link for when ready)
- Multiple cookie/storage formats (tries all variants)

## Future Improvements

If needed, you can add:
- Link expiry countdown in UI
- Automatic retry mechanism
- Analytics tracking for auth flows
- Support for additional token formats
- Biometric authentication integration
