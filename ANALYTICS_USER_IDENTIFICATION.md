# Analytics User Identification - Complete Solution

## Overview

This document explains how user identification works for analytics in the iOS app, linking together the magic link login flow, Lightspeed customer data, and analytics tracking.

## The Flow

### 1. User Logs In via Magic Link (Existing)
- User enters email on Lightspeed Retail account page (in webview)
- Receives magic link via email
- Taps link or pastes it in app
- Webview becomes authenticated with Lightspeed session

### 2. Email Extraction from Webview (NEW)
After successful login, JavaScript in the profile webview:
- Detects login (auth cookies + account page elements)
- Extracts customer email from the page
- Sends to React Native: `{type: 'USER_LOGGED_IN', email: 'customer@example.com'}`

**Location:** [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) (lines 119-175)

### 3. User Sign-In & Lightspeed Lookup (NEW)
When email is received from webview:
1. Calls `signIn(email)` in AuthContext
2. Creates user with `uid: email`
3. Looks up customer in Lightspeed by email
4. Fetches customer segments (VIP, tier, LTV, etc.)
5. Stores everything in user object

**Location:** [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) message handler
**Location:** [contexts/AuthContext.tsx](contexts/AuthContext.tsx) signIn function

### 4. All Analytics Include User Email
Now all analytics events include the email as `userId`:
```typescript
trackAnalyticsEvent('TAB_VIEW', {tab: 'Home'}, user?.uid)
// userId = "john@example.com"
```

## Data Structure

### User Object
```typescript
{
  id: "usr_123456789",
  uid: "john@example.com",  // ← Used for analytics
  name: "John Doe",
  email: "john@example.com",
  phone: "",
  segments: {
    lightspeedCustomerId: "02269032-111f-11f0-fa97-a2344749380d",
    isVIP: true,
    tier: "Bloom",
    lifetimeValue: 844.14,
    orderCount: 7,
    inactiveSegment: "active"
  }
}
```

### Analytics Event
```typescript
{
  eventType: "SESSION_START",
  userId: "john@example.com",  // ← Real customer email!
  metadata: {
    sessionId: "session_1768509137129_6fq1xwvv8",
    // User segments available via userId lookup
  }
}
```

## Linking Data Together

### In Your Analytics Dashboard
1. **Analytics events** contain `userId: "john@example.com"`
2. **Lightspeed customer CSV** contains email → segments
3. **Join them** to see: "John Doe (VIP, $844 LTV) viewed Browse for 51s"

### Query Example
```sql
SELECT
  e.eventType,
  e.userId as email,
  c.Name,
  c.IsVIP,
  c.Tier,
  c.LifetimeValue,
  e.metadata->>'duration' as duration
FROM analytics_events e
LEFT JOIN customer_analytics_master c ON c.Email = e.userId
WHERE e.eventType = 'TAB_VIEW'
ORDER BY e.timestamp DESC;
```

## Implementation Files

### New Files Created
- [services/session.ts](services/session.ts) - Session tracking
- [services/lightspeedCustomerLookup.ts](services/lightspeedCustomerLookup.ts) - Customer lookup
- [services/userBehavior.ts](services/userBehavior.ts) - Behavior tracking helpers
- [hooks/useScreenTime.ts](hooks/useScreenTime.ts) - Screen time tracking
- This file

### Modified Files
- [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) - Email extraction + user signin
- [contexts/AuthContext.tsx](contexts/AuthContext.tsx) - Set `uid: email` on signin
- [app/_layout.tsx](app/_layout.tsx) - Session-based SESSION_START events
- [services/analytics.ts](services/analytics.ts) - New event types + sessionId
- [types/index.ts](types/index.ts) - Added `uid` and `segments` to User type
- All tab files - Added screen time tracking

## Testing

### 1. Test Login Flow
```bash
npx expo start
# Press 'i' for iOS simulator
```

1. Go to Profile tab
2. Enter email → Get magic link
3. Copy link and paste
4. Check console logs:
   - `[Auth] Extracted customer email: john@example.com`
   - `✅ User signed in with email: john@example.com`
   - `✅ Customer found in Lightspeed, adding segments:`

### 2. Test Analytics
1. Navigate between tabs
2. Check analytics dashboard
3. Should see events with `userId: "email@example.com"` instead of "Anonymous"

### 3. Verify Lightspeed Link
In your analytics dashboard:
- Find event with userId email
- Look up that email in `customer_analytics_master.csv`
- Should see matching customer with tier, LTV, etc.

## How It All Connects

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User logs in via magic link (webview)                   │
│    ↓                                                        │
│ 2. Webview extracts email: john@example.com                │
│    ↓                                                        │
│ 3. App calls signIn(email)                                 │
│    ↓                                                        │
│ 4. Lookup in Lightspeed → Get segments (VIP, tier, LTV)    │
│    ↓                                                        │
│ 5. Store in user.uid = email                               │
│    ↓                                                        │
│ 6. All analytics use user.uid as userId                    │
│    ↓                                                        │
│ 7. Dashboard joins analytics.userId ← customer.email       │
│    ↓                                                        │
│ 8. See: "John Doe (VIP, $844 LTV) used Browse for 51s"     │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

✅ **No Firebase Auth needed** - Uses existing magic link login
✅ **Real user identification** - Email from Lightspeed account
✅ **Automatic Lightspeed lookup** - Gets VIP status, tier, LTV
✅ **Session tracking** - No more duplicate APP_OPEN events
✅ **Screen time tracking** - How long users spend in app
✅ **Promo engagement** - Track promo views and clicks
✅ **All linked together** - Analytics → Email → Lightspeed customer data

## Next Steps

1. **Test the flow** - Login via magic link and verify email extraction
2. **Check analytics** - See if userId shows real emails
3. **Join the data** - Connect analytics events to customer CSV
4. **Build dashboards** - Visualize user behavior with customer segments
5. **Segment campaigns** - Target VIPs, inactive users, etc.

## Analytics Dashboard Setup

### Understanding "Anonymous" Users

When you see "Anonymous" in your analytics dashboard, it means:
1. **User hasn't logged in yet** - They're browsing as a guest
2. **Login hasn't been detected** - The webview script hasn't detected the auth cookies yet
3. **Email extraction failed** - The email couldn't be found on the Lightspeed account page

### How to See Real User Data

The analytics system is **already working correctly** - you just need to understand how to interpret the data:

**Current Flow:**
1. User opens app → Analytics shows `userId: null` or `userId: "Anonymous"`
2. User logs in via magic link → App extracts email from Lightspeed page
3. App calls `signIn(email)` → Sets `user.uid = email`
4. **All future analytics events** use `userId: "customer@example.com"`

**To verify it's working:**
1. Look at the **Recent Events** table in your analytics dashboard
2. Find events with `eventType: "USER_LOGGED_IN"` or `eventType: "signup"`
3. Check the `metadata` column for `"email": "customer@example.com"`
4. Look for subsequent events (TAB_VIEW, SCREEN_VIEW, etc.) with that same email as `userId`

### Joining Analytics with Customer Data

You don't need to make any changes to your analytics platform. The data is already linked via email:

**Step 1: Export Analytics Events**
- Download all events from your analytics dashboard as CSV

**Step 2: Join with Customer CSV**
```sql
-- Example SQL query if using a database
SELECT
  e.eventType,
  e.userId as email,
  e.metadata,
  e.timestamp,
  c.Name,
  c."Is VIP",
  c.Tier,
  c."Lifetime Value",
  c."Order Count"
FROM analytics_events e
LEFT JOIN customer_analytics_master c ON c.Email = e.userId
WHERE e.userId IS NOT NULL
ORDER BY e.timestamp DESC;
```

**Step 3: Or use Excel/Google Sheets**
1. Import analytics events CSV
2. Import customer_analytics_master.csv
3. Use VLOOKUP to match email columns:
   ```
   =VLOOKUP(A2, CustomerData!A:Z, 4, FALSE)
   ```

## Troubleshooting

### "Anonymous" Still Showing After Login

**Check these in order:**

1. **Did the user actually log in?**
   - Go to Profile tab in the app
   - Check if you see "Welcome, [email]!" message
   - If not, the magic link login failed

2. **Is email being extracted?**
   - Check Metro bundler console (terminal running expo)
   - Look for: `[Auth] Extracted customer email: xxx@xxx.com`
   - If you don't see this, email extraction failed

3. **Is the signup event being sent?**
   - Check console for: `✅ User signed in with email: xxx@xxx.com`
   - Check analytics dashboard for `eventType: "signup"` event
   - Check metadata for the email

4. **Are subsequent events using the email?**
   - Navigate between tabs after logging in
   - Check for `eventType: "VIEW_TAB"` events
   - Verify `userId` field shows email instead of "Anonymous"

### Email Not Extracted

**Solution:** The webview script now scans the entire page for email addresses.

If still failing:
1. Open Safari/Chrome developer tools
2. Navigate to the Lightspeed account page manually
3. Inspect the page source
4. Find where the email appears
5. Add that selector to `extractCustomerEmail()` function in [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx#L120-L165)

Example selectors already included:
- `.customer-email`
- `input[type="email"]`
- `.account-email`
- Body text scan (catches any email in text)

### Lightspeed Lookup Fails

If customer segments aren't being added:
1. Check that customer exists in [customer_analytics_master.csv](customer_analytics_master.csv)
2. Verify email in CSV matches exactly (case-insensitive)
3. Check phone number as backup lookup method
4. Update Lightspeed API credentials if using real-time API

### Cart Badge Shows Wrong Count

**Fixed:** Cart tab now skips navigation on tab press to preserve cart state.

The badge is now persistent across:
- Tab switches
- App backgrounding
- WebView navigation

### Analytics Not Including SessionId

- Session service auto-initializes in [app/_layout.tsx](app/_layout.tsx)
- Check console for session logs
- Verify 30-minute session timeout working
- Sessions persist across app restarts via AsyncStorage
