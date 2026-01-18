# Testing Guide - After Fixes

## Quick Test Checklist

### 🔄 Reload the App First
```bash
# In your Metro terminal, press:
r
```

---

## Test 1: Login Detection (MOST IMPORTANT)

**What to do:**
1. Open the app
2. Go to **Account** tab (bottom right icon)
3. You should see "Welcome, kdcxmusic@gmail.com!" on the page

**What to look for:**
- **🚨 ALERT POPUP should appear** saying:
  ```
  Login Detected!
  Signed in as: kdcxmusic@gmail.com
  ```

**Results:**
- ✅ **Alert appears** → Login detection is working! Analytics should now show your email.
- ❌ **No alert** → WebView messages aren't reaching React Native. Need further debugging.

---

## Test 2: Cart Count Accuracy

**What to do:**
1. Go to **Browse** tab
2. Add **1 item** to cart
3. Look at **Cart** tab badge (bottom middle icon)

**What to look for:**
- Badge should show **"1"** not "3"

**Then:**
1. Go to **Cart** tab
2. Item should be there (not disappeared)
3. Badge should still show **"1"**

**Add another item:**
1. Go back to **Browse** tab
2. Add a second item
3. Badge should update to **"2"**

**Results:**
- ✅ **Badge matches item count** → Cart count detection is working!
- ❌ **Badge shows wrong number** → Cart count detection needs adjustment.

---

## Test 3: Cart Persistence (Cookie Sharing)

**What to do:**
1. Go to **Browse** tab
2. Add item to cart
3. Switch to **Home** tab
4. Switch to **Cart** tab

**What to look for:**
- Item should **still be in cart** (not disappeared)
- Your email should appear in the checkout form (kdcxmusic@gmail.com)

**Results:**
- ✅ **Items persist** → Cookie sharing is working!
- ❌ **Items disappear** → Cookie sharing issue (but this should be fixed now).

---

## Test 4: Checkout Button Tracking

**What to do:**
1. Add item to cart
2. Go to **Cart** tab
3. Click **checkout button** (or "Proceed to Checkout")

**What happens:**
- Should navigate to checkout page
- Analytics should track `START_ORDER_CLICK` event

**Now test with empty cart:**
1. Remove all items from cart
2. If there's a checkout button on empty cart page, click it

**What should happen:**
- Should NOT track `START_ORDER_CLICK` (only tracks when cart has items)

**Results:**
- ✅ **Only tracks when cart has items** → Checkout tracking is working!
- ❌ **Tracks on empty cart** → Checkout tracking needs fixing.

---

## Test 5: Analytics Dashboard

**What to do:**
1. After seeing the "Login Detected!" alert
2. Navigate between tabs (Home → Browse → Cart → Account)
3. Open analytics dashboard: https://app.greenloop.dev/dashboard/analytics
4. Look at **Recent Events** table

**What to look for:**
- **USER column** should show **"kdcxmusic@gmail.com"** not "Anonymous"
- Recent events (VIEW_TAB, SCREEN_VIEW, TIME_ON_SCREEN) should have your email

**Results:**
- ✅ **Shows email** → User identification is working!
- ❌ **Still shows "Anonymous"** → Login detection didn't update analytics properly.

---

## Expected Timeline

### Immediate (after reload):
1. Account tab loads → **Alert popup appears** (within 2-3 seconds)
2. Cart badge shows correct count

### After navigating:
1. Switch between tabs → items persist
2. Analytics events → show email instead of "Anonymous"

---

## If Alert Doesn't Appear

**Possible issues:**
1. **Script not injecting** - WebView might have security restrictions
2. **Messages not reaching React Native** - iOS WebView bridge issue
3. **Email not being found** - Page layout changed

**Debug steps:**
1. Check if page says "Welcome, kdcxmusic@gmail.com!" (if yes, email is there)
2. Try physical device instead of simulator
3. Check React Native WebView version: `npm list react-native-webview`

**Report back with:**
- Does page show "Welcome, [email]"? Yes/No
- Does alert appear? Yes/No
- What's in Metro terminal after reload?

---

## Success Criteria

All these should be true:
- ✅ Alert popup appears with your email
- ✅ Cart badge shows correct count (1 item = "1", not "3")
- ✅ Items persist when switching tabs
- ✅ Analytics dashboard shows email instead of "Anonymous"
- ✅ Checkout tracking only happens when cart has items

If all ✅ → **Everything is working!**

If any ❌ → Share screenshots and I'll investigate further.

---

## Screenshots to Share

If something isn't working, share:
1. **Account tab** - showing "Welcome, [email]"
2. **Cart tab** - showing items and badge count
3. **Analytics dashboard** - showing recent events
4. **Metro terminal** - showing any errors or messages
5. **Alert popup** - if it appears (or note that it doesn't)
