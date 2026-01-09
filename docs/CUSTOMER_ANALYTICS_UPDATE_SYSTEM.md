# Customer Analytics Update System

## Overview

The customer analytics database needs to stay current as new customers sign up and existing customers make purchases. This document explains the update system.

## File Structure

### Master Files (Keep These)
- **`customer_analytics_master.csv`** - The master customer database with all analytics
- **`first_time_buyers.csv`** - Current list of first-time buyers (updated separately)
- **`ecom_orders_export.csv`** - Source eCom data (manually exported from Lightspeed)

### Archive Directory
- **`archive/`** - Old intermediate files (can be deleted after verification)

---

## Update Methods

### 1. Incremental Update (Recommended - Daily)

**Fast, efficient updates that only process changes:**

```bash
# Update last 7 days (default)
npx tsx scripts/incrementalUpdate.ts

# Update last 14 days
npx tsx scripts/incrementalUpdate.ts --days=14

# Full update (use sparingly - slow)
npx tsx scripts/incrementalUpdate.ts --full
```

**What it does:**
- ✅ Only fetches sales/customers that changed since last run
- ✅ Updates existing customer records with new metrics
- ✅ Adds new customers
- ✅ Uses caching to avoid redundant API calls
- ✅ Fast (typically 2-5 minutes for daily updates)

**When to run:**
- **Daily** (recommended) - Keeps data fresh
- **After major sales events** - Ensure all orders are captured
- **Before running reports** - Get latest numbers

### 2. Full Rebuild (Monthly/Quarterly)

**Complete rebuild from scratch:**

```bash
# Step 1: Full customer analytics
npx tsx scripts/analyzeCustomerMetrics.ts --reuse-customers --cache

# Step 2: Import eCom data (if you have new export)
npx tsx scripts/importEcomCSV.ts

# Step 3: Merge everything
npx tsx scripts/mergeEcomIntoAnalytics.ts

# Step 4: Rename to master
cp customer_analytics_updated_YYYY-MM-DD.csv customer_analytics_master.csv
```

**When to run:**
- **Monthly** - Full data refresh
- **After major data issues** - Reset and rebuild
- **When adding new data sources** - Re-merge everything

---

## Automated Scheduling

### Option 1: Cron Job (Mac/Linux)

Add to crontab (`crontab -e`):

```bash
# Daily update at 2 AM
0 2 * * * cd /path/to/project && npx tsx scripts/incrementalUpdate.ts >> logs/update.log 2>&1
```

### Option 2: GitHub Actions (Recommended)

Create `.github/workflows/update-analytics.yml`:

```yaml
name: Update Customer Analytics

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npx tsx scripts/incrementalUpdate.ts
        env:
          EXPO_PUBLIC_LIGHTSPEED_TOKEN: ${{ secrets.LIGHTSPEED_TOKEN }}
          EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX: ${{ secrets.LIGHTSPEED_DOMAIN }}
      - uses: actions/upload-artifact@v3
        with:
          name: customer-analytics
          path: customer_analytics_master.csv
```

### Option 3: Manual (Current)

Just run the script when needed:

```bash
npx tsx scripts/incrementalUpdate.ts
```

---

## What Gets Updated

### Daily Incremental Update
- ✅ New customers (signed up in last N days)
- ✅ Existing customers with new orders
- ✅ Updated metrics (LTV, order count, AOV)
- ✅ Updated segments (VIP, inactive status, tier)
- ✅ Last order dates

### Not Updated Automatically
- ⚠️ First-time buyer status (run `analyzeFirstTimeBuyers.ts` separately)
- ⚠️ eCom sync status (requires manual eCom CSV export)

---

## Data Freshness

### How Stale Data Happens
- New customers sign up → Not in master CSV
- Existing customers make purchases → Metrics outdated
- eCom orders sync to Retail → Need to be captured

### Keeping Data Fresh
1. **Run incremental update daily** (automatic or manual)
2. **Check `.last_update_timestamp`** file to see when last updated
3. **Run full rebuild monthly** to catch any missed updates

---

## Troubleshooting

### "Master CSV not found"
- Run full rebuild first: `npx tsx scripts/analyzeCustomerMetrics.ts`

### "No recent sales found"
- This is normal if no sales happened in the time window
- Try `--days=14` to look further back

### "Data seems outdated"
- Check `.last_update_timestamp` file
- Run incremental update: `npx tsx scripts/incrementalUpdate.ts`
- If still issues, run full rebuild

### "Too slow"
- Incremental updates should be fast (2-5 min)
- Full rebuilds are slow (30-60 min) - only run monthly
- Use `--cache` flag to speed up

---

## Best Practices

1. **Daily incremental updates** - Keep data fresh
2. **Monthly full rebuilds** - Catch edge cases
3. **Backup master CSV** - Before major updates
4. **Monitor update logs** - Check for errors
5. **Verify data** - Spot check a few customers after updates

---

## Quick Reference

```bash
# Daily update (fast)
npx tsx scripts/incrementalUpdate.ts

# Weekly update (more thorough)
npx tsx scripts/incrementalUpdate.ts --days=7

# Monthly full rebuild (slow but complete)
npx tsx scripts/analyzeCustomerMetrics.ts --reuse-customers --cache
npx tsx scripts/mergeEcomIntoAnalytics.ts
cp customer_analytics_updated_*.csv customer_analytics_master.csv

# First-time buyers (run separately)
npx tsx scripts/analyzeFirstTimeBuyers.ts
```

---

## File Naming Convention

- **`customer_analytics_master.csv`** - Always use this for analysis
- **`first_time_buyers.csv`** - Current first-time buyers
- **`customer_analytics_updated_YYYY-MM-DD.csv`** - Temporary (gets renamed to master)
- **`archive/*.csv`** - Old intermediate files
