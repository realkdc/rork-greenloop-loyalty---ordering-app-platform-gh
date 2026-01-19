# Analytics Implementation Guide

## Overview
This document describes the current analytics implementation in the GreenHaus mobile app, what events are being tracked, and how they map to the admin dashboard.

## Current Analytics Events

### High-Value Consumer Behavior Events

#### 1. **APP_OPEN** (Session Tracking)
- **Fires**: Once per session when app is opened (30min timeout)
- **Location**: Handled by `sessionService.initializeSessionWithTracking()`
- **Metadata**: `sessionId`
- **Dashboard Mapping**: `APP_OPEN` → `APP_OPENS_PER_DAY` chart
- **User ID**: Tracked (anonymous or logged-in user)
- **Status**: ✅ **Implemented and working**

#### 2. **SESSION_START** (New Session)
- **Fires**: Once when a new session begins (after 30min timeout)
- **Location**: Handled by `sessionService.initializeSessionWithTracking()`
- **Metadata**: `sessionId`
- **Dashboard Mapping**: `APP_SESSIONS` count
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

#### 3. **TAB_SWITCH** (Navigation Tracking)
- **Fires**: When user switches between tabs (Home, Browse, Cart, Orders, Account)
- **Location**: `app/(tabs)/_layout.tsx:119-126`
- **Metadata**:
  - `from: string` - Previous tab name
  - `to: string` - New tab name
  - `duration: number` - Time spent on previous tab (seconds)
  - `sessionId: string`
- **Dashboard Mapping**: Can be used to analyze user navigation patterns
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

#### 4. **CHECKOUT_START** (Order Intent)
- **Fires**: When user clicks "Checkout" button from cart or product pages
- **Location**:
  - `app/(tabs)/cart.tsx:379`
  - `app/(tabs)/search.tsx:252`
  - `app/(tabs)/home.tsx:382`
  - `app/store-picker.tsx:42`
- **Metadata**: `sessionId`
- **Debouncing**: 2-second debounce via `shouldTrackStartOrder()` to prevent duplicates
- **Dashboard Mapping**: `START_ORDER_CLICK` → `ORDER_CLICKS_PER_DAY` chart
- **User ID**: Tracked
- **Status**: ✅ **Implemented with debouncing**
- **⚠️ Dashboard Issue**: Dashboard expects `START_ORDER_CLICK` but we're sending `CHECKOUT_START`

#### 5. **ORDER_COMPLETE** (Revenue Conversion)
- **Fires**: When user reaches thank you/confirmation page after completing order
- **Location**: `app/(tabs)/cart.tsx:356`
- **Metadata**:
  - `url: string` - Confirmation page URL
  - `sessionId: string`
- **Dashboard Mapping**: Order completion tracking
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

#### 6. **ADD_TO_CART** (Product Interest)
- **Fires**: When user adds product to cart
- **Location**: `app/(tabs)/search.tsx:256`
- **Metadata**: `sessionId`
- **Debouncing**: 2-second debounce via `window.__ghLastAddToCart` to prevent duplicate firing
- **Dashboard Mapping**: Can track add-to-cart rate
- **User ID**: Tracked
- **Status**: ✅ **Implemented with debouncing**

#### 7. **PRODUCT_VIEW** (Product Interest)
- **Fires**: When user views a product detail page
- **Location**: `app/(tabs)/search.tsx:189`
- **Metadata**:
  - `product: string` - Product slug/identifier
  - `url: string` - Product page URL
  - `sessionId: string`
- **Dashboard Mapping**: Product engagement tracking
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

#### 8. **LOGIN** (User Authentication)
- **Fires**: When user successfully logs in
- **Location**: `contexts/AuthContext.tsx:96` (email) and `:139` (phone)
- **Metadata**:
  - `method: 'email' | 'phone'`
  - `sessionId: string`
- **Dashboard Mapping**: User authentication tracking
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

#### 9. **PUSH_OPEN** (Notification Engagement)
- **Fires**: When user taps a push notification to open the app
- **Location**: `app/_layout.tsx:244`
- **Metadata**:
  - Push notification metadata
  - `sessionId: string`
- **Dashboard Mapping**: Push notification effectiveness
- **User ID**: Tracked
- **Status**: ✅ **Implemented and working**

---

### Legacy/Low-Priority Events (To Be Deprecated)

#### **VIEW_TAB** / **TAB_VIEW**
- **Status**: ⚠️ **Deprecated** - Replaced by `TAB_SWITCH`
- **Location**: `services/userBehavior.ts:91`
- **Issue**: Less informative than `TAB_SWITCH` (doesn't track duration or from/to)
- **Recommendation**: Remove from codebase

#### **START_ORDER_CLICK**
- **Status**: ⚠️ **Deprecated** - Replaced by `CHECKOUT_START`
- **Location**: Only in backup file `cart.tsx.backup:292`
- **Issue**: Name is inconsistent with other event names
- **Recommendation**: Update dashboard to use `CHECKOUT_START` instead

#### **JOIN_CREW_CLICK**
- **Status**: ⚠️ **Not implemented** - Dashboard expects this but it's not tracked
- **Location**: N/A
- **Dashboard Mapping**: `JOIN_CREW_CLICK` → `CREW_CLICKS_PER_DAY` chart
- **Recommendation**: Either implement or remove from dashboard

#### **REFERRAL_LINK_CLICK**
- **Status**: ⚠️ **Deprecated** - Listed in types but not implemented
- **Recommendation**: Remove from event types

#### **SCREEN_VIEW** / **TIME_ON_SCREEN**
- **Status**: ⚠️ **Implemented but not used** - Only in `useScreenTime` hook
- **Location**: `hooks/useScreenTime.ts`
- **Issue**: Hook is defined but not imported/used anywhere
- **Recommendation**: Either use it on key screens or remove it

#### **PROMO_VIEW** / **PROMO_CLICK**
- **Status**: ⚠️ **Implemented but not used** - Only in `services/userBehavior.ts`
- **Issue**: Functions exist but are never called
- **Recommendation**: Either implement promo tracking or remove functions

#### **FEATURE_USE**
- **Status**: ⚠️ **Implemented but not used** - Only in `services/userBehavior.ts`
- **Issue**: Functions exist but are never called
- **Recommendation**: Either implement feature tracking or remove functions

---

## Dashboard Fixes Needed

### Issue 1: Event Name Mismatch
**Problem**: Dashboard expects `START_ORDER_CLICK` but app sends `CHECKOUT_START`

**Solution**: Update dashboard to map `CHECKOUT_START` events to "Order Clicks"

**Dashboard Change**:
```javascript
// In dashboard analytics query
WHERE event_type = 'CHECKOUT_START' // Changed from 'START_ORDER_CLICK'
```

### Issue 2: JOIN_CREW_CLICK Not Tracked
**Problem**: Dashboard shows "Crew Clicks" but app doesn't track this event

**Solution Option A**: Implement JOIN_CREW_CLICK tracking
- Add tracking when user clicks "Join Crew" or referral program buttons
- Location: Add to relevant UI components

**Solution Option B**: Remove from dashboard
- If crew/referral program isn't a priority metric

### Issue 3: Event Type Naming Inconsistency
**Problem**: Mix of naming patterns (snake_case vs SCREAMING_CASE with underscores)

**Solution**: Standardize all event types to `SCREAMING_SNAKE_CASE`
- Examples: `APP_OPEN`, `TAB_SWITCH`, `ORDER_COMPLETE`
- This is already the pattern - just need to update legacy dashboard queries

---

## Recommended Analytics Implementation

### Priority 1: Core E-Commerce Funnel (✅ Complete)
1. ✅ `APP_OPEN` - Session starts
2. ✅ `TAB_SWITCH` - User navigation
3. ✅ `PRODUCT_VIEW` - Product interest
4. ✅ `ADD_TO_CART` - Cart additions
5. ✅ `CHECKOUT_START` - Checkout intent
6. ✅ `ORDER_COMPLETE` - Revenue conversion

### Priority 2: User Engagement (✅ Complete)
1. ✅ `LOGIN` - Authentication
2. ✅ `SESSION_START` - New session tracking
3. ✅ `PUSH_OPEN` - Notification engagement

### Priority 3: To Implement (Optional)
1. ❌ `SCREEN_VIEW` / `TIME_ON_SCREEN` - Screen-level engagement
   - Use `useScreenTime` hook on key screens
   - Example: Product detail screens, checkout flow
2. ❌ `PROMO_VIEW` / `PROMO_CLICK` - Promotional campaign tracking
   - Implement when running promotions
3. ❌ `JOIN_CREW_CLICK` - Referral program tracking
   - Implement if crew/referral program is active

---

## Clean-Up Tasks

### 1. Remove Unused Code
```bash
# Files to clean up:
- services/userBehavior.ts (unused tracking functions)
- hooks/useScreenTime.ts (not imported anywhere)
- cart.tsx.backup (contains legacy START_ORDER_CLICK)
```

### 2. Update Event Types
File: `services/analytics.ts:10-31`

Remove deprecated event types:
```typescript
// Remove these:
| 'VIEW_TAB'
| 'TAB_VIEW'
| 'START_ORDER_CLICK'
| 'JOIN_CREW_CLICK'
| 'REFERRAL_LINK_CLICK'
| 'SCREEN_VIEW'
| 'TIME_ON_SCREEN'
```

Keep only implemented events:
```typescript
export type AnalyticsEventType =
  | 'APP_OPEN'
  | 'SESSION_START'
  | 'TAB_SWITCH'
  | 'CHECKOUT_START'
  | 'ORDER_COMPLETE'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'LOGIN'
  | 'SIGNUP'
  | 'PUSH_OPEN';
```

### 3. Update Dashboard Queries

**File**: `greenhaus-admin/app/api/analytics/events/route.ts` (or similar)

Update event type mappings:
```typescript
// Change:
WHERE event_type = 'START_ORDER_CLICK'
// To:
WHERE event_type = 'CHECKOUT_START'

// Change:
WHERE event_type = 'TAB_VIEW'
// To:
WHERE event_type = 'TAB_SWITCH'
```

Remove or hide unused metrics:
- `JOIN_CREW_CLICK` (not implemented)
- Any other deprecated events

---

## Key Metrics to Track in Dashboard

### 1. **Daily Active Users (DAU)**
- Query: Count unique `userId` with `APP_OPEN` events per day
- Chart: Line chart showing daily trend

### 2. **Session Count**
- Query: Count `SESSION_START` events per day
- Chart: Line chart showing sessions over time

### 3. **Conversion Funnel**
- Steps:
  1. `APP_OPEN` (100%)
  2. `PRODUCT_VIEW` (% of sessions)
  3. `ADD_TO_CART` (% of product views)
  4. `CHECKOUT_START` (% of add to cart)
  5. `ORDER_COMPLETE` (% of checkouts)
- Chart: Funnel visualization

### 4. **Average Session Duration**
- Calculate: Time between `APP_OPEN` and last event in session
- Chart: Average per day

### 5. **Navigation Patterns**
- Query: Analyze `TAB_SWITCH` events
- Chart: Sankey diagram or flow visualization showing tab transitions

### 6. **Top Products**
- Query: Count `PRODUCT_VIEW` events grouped by product
- Chart: Bar chart of most viewed products

### 7. **Cart Abandonment Rate**
- Calculate: (`ADD_TO_CART` - `CHECKOUT_START`) / `ADD_TO_CART`
- Chart: Percentage per day

### 8. **Checkout Abandonment Rate**
- Calculate: (`CHECKOUT_START` - `ORDER_COMPLETE`) / `CHECKOUT_START`
- Chart: Percentage per day

---

## Technical Implementation Details

### Session Management
- **Service**: `services/session.ts`
- **Timeout**: 30 minutes of inactivity
- **Storage**: AsyncStorage (persisted across app restarts)
- **Tracking**:
  - `APP_OPEN` fired once per session
  - `SESSION_START` fired only for new sessions (after timeout)

### Debouncing
- **ADD_TO_CART**: 2-second debounce via `window.__ghLastAddToCart`
- **CHECKOUT_START**: 2-second debounce via `shouldTrackStartOrder()` in `lib/trackingDebounce.ts`
- **Purpose**: Prevent duplicate events from rapid clicks or tab switches

### User Identification
- **Anonymous**: Events tracked with `userId: null` before login
- **Authenticated**: Events tracked with `user.uid` (email or phone) after login
- **Transition**: Session updated with `userId` when user logs in

### API Endpoint
- **URL**: `${APP_CONFIG.apiBaseUrl}/api/analytics/events`
- **Method**: POST
- **Timeout**: 5 seconds (fire-and-forget)
- **Error Handling**: Silent failure (never blocks app)

---

## Implementation Checklist for Dashboard

### Immediate (Critical)
- [ ] Update `START_ORDER_CLICK` queries to use `CHECKOUT_START`
- [ ] Update `TAB_VIEW` queries to use `TAB_SWITCH`
- [ ] Verify `APP_OPEN` is properly aggregated for DAU
- [ ] Add conversion funnel visualization

### Short-term (Nice to have)
- [ ] Remove `JOIN_CREW_CLICK` from dashboard (or implement tracking)
- [ ] Add navigation flow visualization from `TAB_SWITCH` events
- [ ] Add cart abandonment rate metric
- [ ] Add checkout abandonment rate metric

### Long-term (Future)
- [ ] Decide if `SCREEN_VIEW`/`TIME_ON_SCREEN` tracking is needed
- [ ] Decide if `PROMO_VIEW`/`PROMO_CLICK` tracking is needed
- [ ] Implement revenue tracking (requires order value in `ORDER_COMPLETE`)
- [ ] Add cohort analysis (user retention over time)

---

## Example Dashboard Queries

### Daily Active Users
```sql
SELECT
  DATE(timestamp) as date,
  COUNT(DISTINCT userId) as dau
FROM analytics_events
WHERE eventType = 'APP_OPEN'
GROUP BY DATE(timestamp)
ORDER BY date DESC
```

### Conversion Funnel
```sql
WITH sessions AS (
  SELECT sessionId, userId, MIN(timestamp) as session_start
  FROM analytics_events
  WHERE eventType = 'APP_OPEN'
  GROUP BY sessionId, userId
)
SELECT
  COUNT(DISTINCT s.sessionId) as total_sessions,
  COUNT(DISTINCT CASE WHEN e1.eventType = 'PRODUCT_VIEW' THEN s.sessionId END) as product_views,
  COUNT(DISTINCT CASE WHEN e2.eventType = 'ADD_TO_CART' THEN s.sessionId END) as add_to_carts,
  COUNT(DISTINCT CASE WHEN e3.eventType = 'CHECKOUT_START' THEN s.sessionId END) as checkouts,
  COUNT(DISTINCT CASE WHEN e4.eventType = 'ORDER_COMPLETE' THEN s.sessionId END) as orders
FROM sessions s
LEFT JOIN analytics_events e1 ON s.sessionId = e1.sessionId AND e1.eventType = 'PRODUCT_VIEW'
LEFT JOIN analytics_events e2 ON s.sessionId = e2.sessionId AND e2.eventType = 'ADD_TO_CART'
LEFT JOIN analytics_events e3 ON s.sessionId = e3.sessionId AND e3.eventType = 'CHECKOUT_START'
LEFT JOIN analytics_events e4 ON s.sessionId = e4.sessionId AND e4.eventType = 'ORDER_COMPLETE'
```

### Top Products
```sql
SELECT
  JSON_EXTRACT(metadata, '$.product') as product,
  COUNT(*) as view_count
FROM analytics_events
WHERE eventType = 'PRODUCT_VIEW'
  AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY product
ORDER BY view_count DESC
LIMIT 10
```

---

## Summary

**Current Status**:
- ✅ Core e-commerce funnel is fully implemented and working
- ✅ Session tracking is implemented with proper debouncing
- ⚠️ Dashboard needs updates to use correct event names
- ❌ Some legacy code and unused tracking functions need cleanup

**Next Steps**:
1. Update dashboard to use `CHECKOUT_START` instead of `START_ORDER_CLICK`
2. Update dashboard to use `TAB_SWITCH` instead of `TAB_VIEW`
3. Remove unused event types from `services/analytics.ts`
4. Delete or use `services/userBehavior.ts` and `hooks/useScreenTime.ts`
5. Build conversion funnel visualization in dashboard

**High-Value Metrics to Focus On**:
1. Daily Active Users (DAU)
2. Conversion Funnel (App Open → Product View → Add to Cart → Checkout → Order)
3. Cart Abandonment Rate
4. Checkout Abandonment Rate
5. Average Session Duration
6. Top Products

This implementation provides clean, focused analytics without unnecessary complexity.
