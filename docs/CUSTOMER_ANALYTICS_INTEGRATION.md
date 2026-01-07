# Customer Analytics & GreenLoop Integration Guide

## Overview

We now have a complete customer database with analytics capabilities. This document explains how everything connects and how to use it for GreenLoop.

## What We Have

### 1. Customer Database (`all_customers_2026-01-06.csv`)
- **9,328 total customers** (April 2023 - January 2026)
- Basic customer info: ID, Code, Name, Email, Phone
- Purchase status (9,062 with purchases, 263 without)

### 2. Customer Analytics (`customer_analytics_YYYY-MM-DD.csv`)
- **Per-customer metrics:**
  - Lifetime Value (LTV)
  - Order Count
  - Average Order Value (AOV)
  - First/Last Order Dates
  - Days Since Last Order

- **Segments:**
  - **VIP**: $1,000+ lifetime spend
  - **High Value**: $500-$999 lifetime spend
  - **Active**: Purchased in last 30 days
  - **Inactive 30d**: 30-59 days since last purchase
  - **Inactive 60d**: 60-89 days since last purchase
  - **Inactive 90d**: 90+ days since last purchase

- **Tiers** (currently based on spend, will be referral-based later):
  - **Evergreen**: $1,500+ spend
  - **Bloom**: $750-$1,499 spend
  - **Sprout**: $250-$749 spend
  - **Seed**: Has made purchase
  - **None**: No purchases

## How It Works

### Data Flow

```
Lightspeed API
    ↓
Customer Export Script → all_customers.csv
    ↓
Customer Analytics Script → customer_analytics.csv
    ↓
GreenLoop App / Backend
```

### Per-Customer Data Access

**Yes, we can get per-customer order history!** The Lightspeed API supports:

1. **Get customer by ID/Email:**
   ```typescript
   GET /customers/{customerId}
   GET /search?type=customers&q={email}
   ```

2. **Get customer's sales:**
   ```typescript
   GET /search?type=sales&customer_id={customerId}
   ```

3. **We already have this in the codebase:**
   - `services/lightspeed.ts` - `getCustomer()`, `getRecentSales()`
   - `lib/lightspeedClient.ts` - `getCustomerSales()`
   - `hooks/useOrderHistory.ts` - React hook for order history

## Integration with GreenLoop

### 1. Customer Segmentation for SMS/Promos

Use the segments from `customer_analytics.csv`:

```typescript
// Example: Send promo to inactive customers
const inactive90 = customers.filter(c => c.inactiveSegment === '90d');
// Send "We miss you!" promo

// Example: VIP exclusive offer
const vipCustomers = customers.filter(c => c.isVIP);
// Send exclusive VIP promotion
```

### 2. Ambassador Program

**Current State:**
- Tiers are based on **spend** (temporary)
- Referred sales = 0 (tracking not implemented yet)

**Future State:**
- Tiers based on **referred sales**:
  - Seed: Join + first purchase
  - Sprout: 3 referred sales
  - Bloom: 10 referred sales
  - Evergreen: 25+ referred sales

**Hybrid Approach (Your Idea):**
- Keep referral tiers for true ambassadors/influencers
- Add **spend-based VIP tiers** for high-value customers
- Example: Customer with $3,000 spend = VIP, gets special treatment regardless of referrals

### 3. Repeat Order Tracking

The analytics script calculates:
- `orderCount`: Total number of orders
- `averageOrderValue`: Average spend per order
- `daysSinceLastOrder`: For re-engagement campaigns

**Use Cases:**
- Identify customers who haven't ordered in 30/60/90 days → send re-engagement SMS
- Track repeat purchase rate
- Calculate customer lifetime value for marketing ROI

### 4. Average Order Value (AOV)

**Per Customer:**
- Individual AOV in `customer_analytics.csv`

**System-Wide:**
- Calculated in analytics summary
- Use for:
  - Setting minimum order thresholds for free shipping
  - Upsell campaigns ("Add $X more for free shipping!")
  - Understanding customer behavior

## Next Steps

### Phase 1: Basic Integration ✅
- [x] Export all customers
- [x] Calculate customer metrics
- [x] Create segments

### Phase 2: GreenLoop App Integration
- [ ] Import customer data to Firebase/Firestore
- [ ] Create customer lookup by email/phone
- [ ] Display customer metrics in app (profile screen)
- [ ] Show order history per customer

### Phase 3: Segmentation & Campaigns
- [ ] Build SMS campaign system using segments
- [ ] Create automated campaigns:
  - Welcome series (new customers)
  - Re-engagement (inactive 30/60/90 days)
  - VIP exclusive offers
- [ ] Track campaign performance

### Phase 4: Ambassador Program
- [ ] Implement referral tracking
- [ ] Update tiers based on referrals
- [ ] Add spend-based VIP tiers
- [ ] Create ambassador dashboard

### Phase 5: Advanced Analytics
- [ ] Cohort analysis (customer retention)
- [ ] Product recommendations based on purchase history
- [ ] Predictive analytics (churn prediction)

## Scripts Available

### `scripts/analyzeCustomerTiers.ts`
- Exports all customers with basic info
- Run: `npx tsx scripts/analyzeCustomerTiers.ts`
- Output: `all_customers_YYYY-MM-DD.csv`

### `scripts/analyzeCustomerMetrics.ts`
- Calculates metrics and segments per customer
- Run: `npx tsx scripts/analyzeCustomerMetrics.ts`
- Output: `customer_analytics_YYYY-MM-DD.csv`

### `scripts/lightspeed-cli.ts`
- Interactive CLI for quick data access
- Run: `npx tsx scripts/lightspeed-cli.ts`

## API Endpoints (Already Built)

### Backend (tRPC)
- `lightspeed.todaySales` - Today's sales total
- `lightspeed.recentSales` - Recent sales with details
- `lightspeed.customer` - Get customer by ID or email
- `lightspeed.products` - Product catalog
- `lightspeed.storeInfo` - Store information

### Frontend Hooks
- `useOrderHistory()` - Get customer's order history
- `useCustomerData()` - Get customer profile data

## Data Structure

### Customer Analytics CSV Columns
1. Customer ID
2. Customer Code
3. Name
4. Email
5. Phone
6. Lifetime Value
7. Order Count
8. Avg Order Value
9. First Order Date
10. Last Order Date
11. Days Since Last Order
12. Is VIP (Yes/No)
13. Is High Value (Yes/No)
14. Inactive Segment (active/30d/60d/90d)
15. Tier (None/Seed/Sprout/Bloom/Evergreen)
16. Referred Sales (0 for now)

## Example Use Cases

### 1. Re-engagement Campaign
```typescript
// Get customers inactive 90+ days
const inactive90 = analytics.filter(c => c.inactiveSegment === '90d');
// Send SMS: "We miss you! 20% off your next order"

// Track: How many came back after campaign?
```

### 2. VIP Exclusive Offer
```typescript
// Get VIP customers
const vip = analytics.filter(c => c.isVIP);
// Send SMS: "VIP Exclusive: Early access to new products"

// Track: VIP response rate vs regular customers
```

### 3. Upsell Campaign
```typescript
// Get customers with low AOV
const lowAOV = analytics.filter(c => 
  c.averageOrderValue < 50 && c.orderCount > 0
);
// Send SMS: "Add $X more to your next order for free shipping"
```

### 4. Repeat Purchase Tracking
```typescript
// Calculate repeat purchase rate
const repeatCustomers = analytics.filter(c => c.orderCount > 1);
const repeatRate = (repeatCustomers.length / totalCustomers) * 100;
// Use for marketing ROI calculations
```

## Questions Answered

**Q: Can we find customer information per customer?**
A: Yes! Use `getCustomer(customerId)` or search by email.

**Q: Can we find what they ordered?**
A: Yes! Use `getCustomerSales(customerEmail)` or `/search?type=sales&customer_id={id}`

**Q: Can we calculate repeat orders?**
A: Yes! The analytics script calculates `orderCount` per customer.

**Q: Can we calculate average order value?**
A: Yes! Both per-customer (`averageOrderValue`) and system-wide.

**Q: How do we segment customers?**
A: The analytics script creates segments:
- VIP/High Value (spend-based)
- Active/Inactive (time-based)
- Tiers (spend-based now, referral-based later)

**Q: How does this connect to GreenLoop?**
A: 
1. Import CSV data to Firebase
2. Use segments for SMS campaigns
3. Display metrics in app
4. Track referrals for ambassador program
5. Build automated marketing campaigns

## Summary

You now have:
- ✅ Complete customer database (9,328 customers)
- ✅ Per-customer order history access
- ✅ Customer metrics (LTV, AOV, repeat orders)
- ✅ Segmentation (VIP, inactive, tiers)
- ✅ Foundation for GreenLoop integration

**Next:** Import to Firebase, build campaign system, implement referral tracking.
