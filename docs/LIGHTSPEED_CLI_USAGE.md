# Lightspeed Retail API - CLI Tool Usage

## Quick Start

Run the interactive CLI tool:

```bash
npx tsx scripts/lightspeed-cli.ts
```

## What It Does

The CLI provides an easy menu-driven interface to pull data from your Lightspeed Retail (X-Series) store.

## Menu Options

1. **Store Information** - View store details, locations, timezone
2. **Today's Sales Summary** - Get count, total revenue, and average sale for today
3. **Recent Sales (with details)** - View last N sales with customer and employee info
4. **Recent Sales (export CSV)** - Same as #3 but exports to CSV file
5. **Customers List** - Browse customer database
6. **Products List** - View product catalog
7. **Inventory** - Check stock levels
8. **Run All** - Quick overview of everything
0. **Exit**

## Requirements

- Node.js installed
- `.env` file with:
  - `EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...`
  - `EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco`

## Other Scripts

### `scripts/pullStoreData.ts`
One-shot script that pulls today's sales and exports last 5 sales to CSV.

```bash
npx tsx scripts/pullStoreData.ts
```

### `scripts/testLightspeedAPI.ts`
Test script to verify API connection and token.

```bash
npx tsx scripts/testLightspeedAPI.ts
```

## Notes

- All scripts use the Lightspeed Retail (X-Series) API
- Data is pulled in real-time from your store
- CSV exports are saved to the project root
- The CLI is interactive - just follow the prompts
