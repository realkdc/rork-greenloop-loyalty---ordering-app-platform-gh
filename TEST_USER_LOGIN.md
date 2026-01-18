# Testing User Login Detection

## Current Status
- Cart bug: FIXED (changed from CART_COUNT_CONFIRMED to CART_COUNT)
- User login: NOT WORKING (still showing Anonymous)

## Why It's Not Working

The WebView console.log statements aren't visible in Metro terminal by default. The login detection script IS running inside the WebView, but we can't see if it's finding the email.

## Quick Test to Verify

Open Safari on your Mac and enable WebView debugging:

1. **On Simulator:**
   - In Simulator, go to Settings > Safari > Advanced > Enable "Web Inspector"

2. **On Mac:**
   - Open Safari
   - Go to Safari > Settings > Advanced
   - Enable "Show features for web developers"

3. **Debug the WebView:**
   - With the iOS simulator running and app on Profile tab
   - In Safari menu: Develop > Simulator > greenhauscc.com
   - This opens Web Inspector for the Profile WebView

4. **Check Console:**
   - Look for these logs:
     ```
     [Auth] Starting login detection...
     [Auth] Login detected! Welcome: true SignedIn: true AccountPage: true
     [Auth] Found email in Welcome text: kdcxmusic@gmail.com
     [Auth] USER_LOGGED_IN message sent with email: kdcxmusic@gmail.com
     ```

## Alternative: Add Debug Button

If Safari debugging is too complex, I can add a test button to the app that:
1. Manually triggers the email extraction
2. Shows an alert with the extracted email
3. Manually calls signIn()

Would you like me to add this debug button?

## Expected Behavior

Once working:
1. You're logged in on Profile tab (shows "Welcome, kdcxmusic@gmail.com!")
2. WebView detects the "Welcome," text
3. Extracts email: `kdcxmusic@gmail.com`
4. Sends `USER_LOGGED_IN` message to React Native
5. React Native calls `signIn(kdcxmusic@gmail.com)`
6. AuthContext sets `user.uid = "kdcxmusic@gmail.com"`
7. All future analytics events use `userId: "kdcxmusic@gmail.com"`

## Current Analytics Flow

Right now:
- `user.uid` is probably `undefined` (guest user)
- Analytics shows `userId: null` → displays as "Anonymous"
- Need to trigger the `signIn()` call to set `user.uid = email`

## Next Steps

Choose one:
1. **Enable Safari Web Inspector** (recommended for debugging)
2. **Add debug button to app** (easier, shows email extraction in UI)
3. **Check if signIn is being called** - add more React Native console logs
