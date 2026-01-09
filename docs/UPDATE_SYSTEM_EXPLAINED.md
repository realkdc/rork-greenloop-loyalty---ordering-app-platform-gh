# Update System - Explained Simply

## Current Status: **NOT AUTOMATED YET**

Right now, you need to **manually run** the update script. Automation is optional and needs to be set up.

---

## How It Works

### The Problem
- You have 9,282 customers in your master CSV right now
- New customers sign up every day
- Existing customers make new purchases every day
- Their metrics (LTV, order count, tiers) need to update

### The Solution: Incremental Updates

**Why only 7 days?**
- You already have ALL customers in the master CSV (9,282 of them)
- You don't need to re-fetch all 9,282 customers every day
- You only need to check: "What changed in the last 7 days?"
- This is **MUCH faster** (2-5 minutes vs 30-60 minutes)

**What gets updated:**
- ✅ **Lifetime Value** - Recalculated from all their orders
- ✅ **Order Count** - Updated with new orders
- ✅ **Average Order Value** - Recalculated
- ✅ **Last Order Date** - Updated
- ✅ **Days Since Last Order** - Recalculated
- ✅ **VIP Status** - Updated if they crossed $1000
- ✅ **High Value Status** - Updated if they crossed $500
- ✅ **Inactive Segment** - Updated (30d/60d/90d)
- ✅ **Tier** - Updated (Seed/Sprout/Bloom/Evergreen)
- ✅ **New Customers** - Added if they signed up

**What does NOT get re-fetched:**
- ❌ Customer name (unless changed)
- ❌ Customer email (unless changed)
- ❌ Customer phone (unless changed)
- ❌ Old orders (we already have them)

---

## Update Methods

### 1. Daily Incremental Update (What You Want)

```bash
npx tsx scripts/incrementalUpdate.ts
```

**What it does:**
1. Looks at `.last_update_timestamp` file (tracks when you last ran it)
2. Fetches only sales from the last 7 days (or since last update)
3. For each customer with new sales:
   - Fetches ALL their orders (to recalculate metrics accurately)
   - Updates their LTV, order count, AOV, tiers, segments
4. Adds any new customers
5. Saves updated master CSV

**Time:** 2-5 minutes (fast!)

**When to run:** Daily (or whenever you want fresh data)

---

### 2. Monthly Full Rebuild (Safety Net)

```bash
npx tsx scripts/analyzeCustomerMetrics.ts --reuse-customers --cache
npx tsx scripts/mergeEcomIntoAnalytics.ts
```

**What it does:**
- Rebuilds everything from scratch
- Catches any edge cases or missed updates
- Ensures 100% accuracy

**Time:** 30-60 minutes (slow!)

**When to run:** 
- Monthly (as a safety net)
- If you suspect data issues
- After major system changes

**Why monthly if daily updates run?**
- Daily updates are fast but might miss edge cases
- Monthly rebuild is a "safety net" to catch anything missed
- Think of it like: daily = quick sync, monthly = full backup

---

## Automation (Optional - Not Set Up Yet)

### Current Status: **MANUAL**

Right now, you need to run:
```bash
npx tsx scripts/incrementalUpdate.ts
```

### Option 1: Set Up Cron (Mac/Linux)

**This is NOT set up yet.** To set it up:

1. Open terminal
2. Run: `crontab -e`
3. Add this line:
   ```
   0 2 * * * cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp && npx tsx scripts/incrementalUpdate.ts >> logs/update.log 2>&1
   ```
4. Save and exit

**This will run daily at 2 AM automatically.**

### Option 2: Manual (Current)

Just run it when you need it:
```bash
npx tsx scripts/incrementalUpdate.ts
```

---

## Example: What Happens Daily

**Day 1 (Monday):**
- Customer "John" has: 5 orders, $500 LTV, "Sprout" tier
- John makes a new $200 purchase
- You run: `npx tsx scripts/incrementalUpdate.ts`
- Result: John now has 6 orders, $700 LTV, "Bloom" tier ✅

**Day 2 (Tuesday):**
- New customer "Sarah" signs up and makes first purchase
- You run: `npx tsx scripts/incrementalUpdate.ts`
- Result: Sarah added to master CSV with 1 order, $50 LTV, "Seed" tier ✅

**Day 3 (Wednesday):**
- No new sales
- You run: `npx tsx scripts/incrementalUpdate.ts`
- Result: "No recent sales found - database is up to date!" ✅

---

## What You Should Do

### Right Now (Manual)
```bash
# Run this daily (or whenever you want fresh data)
npx tsx scripts/incrementalUpdate.ts
```

### To Automate (Optional)
1. Set up cron job (see above)
2. Or use GitHub Actions (see `CUSTOMER_ANALYTICS_UPDATE_SYSTEM.md`)
3. Or just run it manually when needed

---

## Summary

- ✅ **Incremental update** = Fast (2-5 min), updates metrics only
- ✅ **Monthly rebuild** = Slow (30-60 min), full refresh (safety net)
- ⚠️ **NOT automated yet** - You need to run it manually or set up cron
- ✅ **Only updates metrics** - LTV, orders, tiers, segments (exactly what you want!)
