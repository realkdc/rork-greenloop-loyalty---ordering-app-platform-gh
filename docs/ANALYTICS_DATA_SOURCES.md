# Customer Analytics Data Sources

## The Problem

We have **two separate data sources** that need to be combined:

1. **Retail API** (`analyzeCustomerMetrics.ts`)
   - Only shows orders that have **synced** from eCom to Retail
   - eCom orders can take **months** to sync
   - So customers who only ordered online (and it hasn't synced) show as **0 orders**

2. **eCom CSV Export** (`importEcomCSV.ts`)
   - Has **ALL** eCom orders (synced + not synced)
   - Complete historical data
   - But only has eCom orders, not retail/POS orders

## The Solution

To get **complete, accurate analytics**:

1. **Run full analytics script** to get all Retail API data:
   ```bash
   npx tsx scripts/analyzeCustomerMetrics.ts --reuse-customers
   ```
   This gets:
   - All retail/POS orders
   - All eCom orders that HAVE synced

2. **Import eCom CSV** to get all eCom orders:
   ```bash
   npx tsx scripts/importEcomCSV.ts
   ```
   This gets:
   - ALL eCom orders (synced + not synced)

3. **Merge them together**:
   ```bash
   npx tsx scripts/mergeEcomIntoAnalytics.ts
   ```
   This combines:
   - Retail orders from API
   - eCom orders from CSV (even if not synced yet)
   - Recalculates all metrics

## Why Customers Show 0 Orders

If a customer shows 0 orders, it means:
- They haven't made any retail/POS purchases
- AND their eCom orders haven't synced to Retail API yet
- BUT they might have eCom orders in the CSV that we can add

The merge script should fix this by adding eCom orders from the CSV.

## Current Status

- ✅ Retail API: Fetches all synced orders
- ✅ eCom CSV: Has all eCom orders (synced + not synced)
- ✅ Merge script: Combines both sources
- ⚠️ Need to re-run analytics to get latest Retail API data
- ⚠️ Then merge eCom CSV to get complete picture
