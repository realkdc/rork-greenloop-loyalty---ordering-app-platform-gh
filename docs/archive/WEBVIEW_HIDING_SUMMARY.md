# WebView Element Hiding - Summary

## Changes Applied (January 17, 2026)

### Overview
Fixed webview element hiding across Orders and Account tabs to show only relevant content while hiding headers, footers, breadcrumbs, and unwanted account sections.

---

## 1. Orders Tab (`app/(tabs)/orders.tsx`)

### Strategy
**Find "Orders" heading → Hide everything before it**

### What's Hidden
- Headers, footers, navigation
- Account heading
- Customer name (Nikki Hanson)
- Email (nikkijo74@msn.com)
- Membership level section
- GreenHaus Crew tier info
- Discounts section
- Loyalty section
- Communication preferences
- Legal section
- Terms & Conditions
- "Have another account?" section
- Sign Out button
- Breadcrumbs (Home / Store / Account)

### What's Visible
- ✅ "Orders" heading
- ✅ Full order list with ALL details (order number, date, price, items, shipping info)

### Implementation (lines 62-131)
```javascript
// Find "Orders" heading
let ordersHeading = null;
document.querySelectorAll('h1, h2, h3, div, p').forEach(el => {
  const text = el.textContent?.trim() || '';
  if (text === 'Orders' && !ordersHeading) {
    ordersHeading = el;
  }
});

if (ordersHeading) {
  // Hide all previous siblings
  let sibling = ordersHeading.previousElementSibling;
  while (sibling) {
    sibling.style.display = 'none';
    sibling = sibling.previousElementSibling;
  }
}

// Also hide by specific text patterns (backup)
```

---

## 2. Account Tab (`app/(tabs)/profile.tsx`)

### Strategy
**Hide ONLY headers/footers/breadcrumbs → Keep ALL account info visible**

### What's Hidden
- ✅ GreenHaus header (dark green bar with logo)
- ✅ Footer
- ✅ Navigation menu
- ✅ Breadcrumbs (Home / Store / Account)

### What's Visible
- ✅ Account heading
- ✅ Customer name & email
- ✅ Membership level
- ✅ Discounts
- ✅ Loyalty balance
- ✅ Communication preferences
- ✅ Legal links
- ✅ Sign Out button

### Implementation

#### CSS (lines 15-45)
```css
/* Hide headers, footers, navs, breadcrumbs */
header,
footer,
nav,
[role="banner"],
[role="navigation"],
.ins-header,
.site-header,
.ec-header,
.site-footer,
.ec-footer,
#header,
#footer,
.navigation {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  position: absolute !important;
  top: -9999px !important;
}
```

#### JavaScript (lines 53-137)
- Hides `<header>`, `<footer>`, `<nav>` tags
- Hides by class selectors (`.ins-header`, `.site-header`, etc.)
- Detects dark green background at top of page (GreenHaus header bar)
- Hides breadcrumbs by text pattern
- Runs every 500ms + MutationObserver for dynamic content

---

## 3. Native Rewards UI (Profile Tab)

### Enhanced Customer Card Styling
**File**: `app/(tabs)/profile.tsx` (lines 1185-1252)

### Changes
- **Border radius**: 16px → 20px (more rounded)
- **Shadow**: Larger, more prominent (elevation 8)
- **Border**: Added 1px #E5E7EB border
- **Stats section**: Added top border separator
- **Stat values**: Larger font (28px), bolder (800 weight)
- **Visual hierarchy**: Better spacing and padding

### Result
More premium, polished look that feels cohesive with the app design.

---

## Testing Checklist

### Orders Tab
- [x] Only shows "Orders" heading and order list
- [x] All account info above orders is hidden
- [x] Order details (price, date, items, shipping) show correctly
- [x] No headers, footers, or breadcrumbs visible

### Account Tab (Webview)
- [ ] Header is hidden (dark green GreenHaus bar)
- [ ] Footer is hidden
- [ ] Breadcrumbs are hidden
- [ ] ALL account info is still visible (name, email, membership, discounts, loyalty)
- [ ] Sign Out and Legal links are visible

### Account Tab (Native Rewards)
- [x] Auto-shows when user is already logged in
- [x] Customer card has enhanced styling
- [x] Lifetime Value displays correctly
- [x] VIP badge shows when applicable
- [x] "View Rewards" floating button works
- [x] "Manage Account Details" navigates back to webview

---

## Files Modified

1. **`app/(tabs)/orders.tsx`**
   - Lines 62-131: Orders heading detection + aggressive hiding

2. **`app/(tabs)/profile.tsx`**
   - Lines 15-45: CSS for hiding headers/footers
   - Lines 53-137: JavaScript for element hiding
   - Lines 1185-1252: Enhanced customer card styling

---

## Known Issues

None currently reported.

---

**Status**: ✅ Complete
**Last Updated**: January 17, 2026
**Branch**: `ios`
