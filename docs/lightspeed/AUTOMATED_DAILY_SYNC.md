# Automated Daily Customer Tier Sync

## How It Works

### Daily Automated Process (2:00 AM UTC)

The GitHub Actions workflow automatically runs every day:

1. **Update Analytics CSV** (`scripts/incrementalUpdate.ts`)
   - Fetches recent customer orders from Lightspeed
   - Recalculates Customer Lifetime Value (CLV)
   - Updates tier assignments based on:
     - **Seed**: First purchase after loyalty signup
     - **Sprout**: $250+ CLV or 3+ purchases/month
     - **Bloom**: $750+ CLV
     - **Evergreen**: $1,500+ CLV
   - Updates `customer_analytics_master.csv`

2. **Sync Tiers to Lightspeed** (`scripts/syncCustomerTiersToLightspeed.ts`) ✨ NEW!
   - Reads the updated CSV
   - Assigns customers to their Lightspeed customer groups
   - Only updates customers whose tier changed (efficient)
   - Creates sync log for monitoring

3. **Commit & Upload**
   - Commits updated CSV to repository
   - Uploads CSV as artifact for download

## What This Means

✅ **Fully Automated**
- Customers automatically move between tiers as they make purchases
- Lightspeed groups stay in sync with analytics
- No manual intervention needed

✅ **Always Up-to-Date**
- When a customer reaches $250 CLV → Automatically moved to Sprout tier
- When they hit $750 → Automatically moved to Bloom
- Updates happen every 24 hours

✅ **Use Cases**
- **Targeted promotions**: Send offers to specific tiers via Lightspeed
- **Loyalty rewards**: Automatically apply discounts to tier groups
- **Reporting**: Track tier distribution over time
- **Customer service**: See customer tier in Lightspeed POS

## Workflow File

Location: `.github/workflows/update-customer-analytics.yml`

```yaml
- name: Sync customer tiers to Lightspeed
  env:
    EXPO_PUBLIC_LIGHTSPEED_TOKEN: ${{ secrets.LIGHTSPEED_TOKEN }}
    EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX: ${{ secrets.LIGHTSPEED_DOMAIN_PREFIX }}
  run: |
    echo "🔄 Syncing customer tiers to Lightspeed groups..."
    npx tsx scripts/syncCustomerTiersToLightspeed.ts
    echo "✅ Tier sync complete"
```

## Monitoring

### Check Last Run

```bash
# View recent workflow runs
gh run list --workflow="update-customer-analytics.yml" --limit 5

# View specific run logs
gh run view [RUN_ID] --log
```

### Verify Customer Counts

```bash
# Check actual counts via API (dashboard may be cached)
npx tsx scripts/verifyCustomerGroupCounts.ts
```

### View Sync Logs

The sync creates a log file with detailed results:
- Location: `tier_sync_log.json` (in repository)
- Shows: Total customers, updated, skipped, errors
- Tier breakdown by count

## Manual Trigger

You can manually trigger the workflow anytime:

```bash
# Trigger via GitHub CLI
gh workflow run update-customer-analytics.yml

# Or via GitHub UI
# https://github.com/YOUR_REPO/actions/workflows/update-customer-analytics.yml
# Click "Run workflow" button
```

## Troubleshooting

### Sync Failed

Check the workflow logs:
```bash
gh run list --workflow="update-customer-analytics.yml" --limit 1
gh run view [RUN_ID] --log-failed
```

Common issues:
- API token expired (regenerate in Lightspeed dashboard)
- Rate limiting (sync includes 100ms delays, shouldn't happen)
- Network issues (workflow will retry next day)

### Customer Not Moving Tiers

1. Check if their tier updated in CSV:
   ```bash
   grep "customer@email.com" customer_analytics_master.csv
   ```

2. Verify their Lightspeed group:
   ```bash
   # Run verification script
   npx tsx scripts/verifyCustomerGroupCounts.ts
   ```

3. Check sync log for errors:
   ```bash
   cat tier_sync_log.json
   ```

## Architecture

```
Daily (2:00 AM UTC)
    ↓
GitHub Actions Workflow
    ↓
1. Fetch recent orders from Lightspeed
    ↓
2. Calculate CLV & determine tiers
    ↓
3. Update customer_analytics_master.csv
    ↓
4. Sync tiers to Lightspeed customer groups ← NEW!
    ↓
5. Commit CSV & upload artifact
```

## Customer Tier Groups

| Tier | Lightspeed Group | Criteria |
|------|------------------|----------|
| **First Time Buyer** | First Time Buyer | New customers (not yet calculated) |
| **Seed** | GreenHaus Crew - Seed | Loyalty + First Purchase |
| **Sprout** | GreenHaus Crew - Sprout | $250 CLV or 3 purchases/month |
| **Bloom** | GreenHaus Crew - Bloom | $750 CLV |
| **Evergreen** | GreenHaus Crew - Evergreen | $1,500 CLV |

## Benefits

1. **Marketing Automation**
   - Create targeted campaigns by tier in Lightspeed
   - Send SMS/email to specific customer groups
   - Automatic segmentation

2. **Loyalty Program**
   - Customers see their progress
   - Automatic perks when reaching new tiers
   - Incentivizes repeat purchases

3. **Data Consistency**
   - Single source of truth (CSV)
   - Lightspeed always reflects latest analytics
   - No manual updates needed

4. **Reporting**
   - Track tier movement over time
   - Analyze which customers are growing
   - Identify at-risk customers (downgrading tiers)

---

**Last Updated**: January 15, 2026
