# Automated Daily Customer Tier Sync

## How It Works

### Daily Automated Process (2:00 AM UTC)

The GitHub Actions workflow automatically runs every day:

1. **Update Analytics CSV** (`scripts/incrementalUpdate.ts`)
   - Fetches recent customer orders from Lightspeed
   - Calculates both Lifetime Value (LTV) and Rolling 90-Day Value
   - Updates tier assignments based on **ROLLING 90-DAY spend** (not lifetime):
     - **Seed**: Has made at least one purchase
     - **Sprout**: $250+ in last 90 days
     - **Bloom**: $750+ in last 90 days
     - **Evergreen**: $1,500+ in last 90 days
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
- Customers automatically move between tiers based on recent activity
- Lightspeed groups stay in sync with analytics
- No manual intervention needed

✅ **Rolling 90-Day Window** 🔄 **NEW!**
- Tiers are based on spend in the **last 90 days**, not lifetime
- Customers must **maintain** their spending level to keep their tier
- This drives ongoing engagement and repeat purchases
- Example: Someone who spent $2,000 last year but $0 recently → drops from Evergreen to Seed
- Example: Someone spending $300/month consistently → stays in Sprout tier

✅ **Always Up-to-Date**
- When a customer reaches $250 in last 90 days → Automatically moved to Sprout tier
- When they hit $750 in last 90 days → Automatically moved to Bloom
- If spending drops below threshold → Tier automatically decreases
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

| Tier | Lightspeed Group | Criteria (Rolling 90-Day) |
|------|------------------|---------------------------|
| **First Time Buyer** | First Time Buyer | New customers (not yet calculated) |
| **Seed** | GreenHaus Crew - Seed | Has made at least one purchase |
| **Sprout** | GreenHaus Crew - Sprout | $250+ spent in last 90 days |
| **Bloom** | GreenHaus Crew - Bloom | $750+ spent in last 90 days |
| **Evergreen** | GreenHaus Crew - Evergreen | $1,500+ spent in last 90 days |

**Important**: Tiers are based on a **rolling 90-day window**, not lifetime value. This means:
- Customers need to maintain spending to keep their tier
- Tiers can go up OR down each month
- This encourages ongoing engagement and repeat purchases

## Benefits

1. **Marketing Automation**
   - Create targeted campaigns by tier in Lightspeed
   - Send SMS/email to specific customer groups
   - Automatic segmentation

2. **Loyalty Program**
   - Rolling window keeps customers engaged
   - "Maintain your status" becomes real - not just a one-way door
   - Incentivizes ongoing frequency, basket size, and mix
   - Rewards active customers, not just historical spend

3. **Data Consistency**
   - Single source of truth (CSV)
   - Lightspeed always reflects latest analytics
   - No manual updates needed
   - Tracks both lifetime and rolling 90-day values

4. **Reporting**
   - Track tier movement over time
   - Identify customers who are maintaining vs. declining
   - See which customers are at risk of dropping tiers
   - Analyze engagement patterns for each tier

---

**Last Updated**: January 15, 2026
