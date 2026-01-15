# Customer Tier Sync to Lightspeed - Setup Guide

## Current Status

✅ **Analytics System**: Running daily at 2:00 AM UTC via GitHub Actions
- **Last successful run**: January 15, 2026 at 3:44 AM UTC
- **Last update timestamp**: January 9, 2026 at 6:30 PM
- **Customer analytics CSV**: Updated and tracking 9,282 customers

### Tier Distribution (from customer_analytics_master.csv):
- **Seed**: 6,112 customers
- **Sprout**: 1,378 customers
- **Bloom**: 663 customers
- **Evergreen**: 881 customers
- **None**: 247 customers

### Lightspeed Customer Groups (from your screenshot):
1. First Time Buyer (0 customers)
2. GreenHaus Crew - Seed (Loyalty + First Purchase) (0 customers)
3. GreenHaus Crew - Sprout ($250 CLV or 3 purchases/month) (0 customers)
4. GreenHaus Crew - Bloom ($750 CLV) (0 customers)
5. GreenHaus Crew - Evergreen ($1,500 CLV) (0 customers)

**All groups show 0 customers because they haven't been synced yet!**

---

## How to Sync Customers to Groups

### Step 1: Get Customer Group IDs from Lightspeed

Run this script to fetch the actual group IDs:

```bash
npx tsx scripts/getCustomerGroupIds.ts
```

This will output something like:

```
const TIER_TO_GROUP_MAP = {
  'First Time Buyer': 'abc123-def456-...',
  'Seed': 'ghi789-jkl012-...',
  'Sprout': 'mno345-pqr678-...',
  'Bloom': 'stu901-vwx234-...',
  'Evergreen': 'yza567-bcd890-...',
  'None': ''
};
```

### Step 2: Update the Sync Script

Copy those IDs into `scripts/syncCustomerTiersToLightspeed.ts` at line 38.

### Step 3: Test with Dry Run

Test the sync without making changes:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 10
```

This will:
- Process only the first 10 customers
- Show what WOULD be updated
- Not make any actual API calls

### Step 4: Run Limited Real Sync

Test with a small batch:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 100
```

This will:
- Assign first 100 customers to their tier groups
- Take ~10 seconds (100ms rate limit between requests)
- Create a `tier_sync_log.json` file with results

### Step 5: Full Sync

Once you confirm it's working:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

This will:
- Process all 9,282 customers
- Take ~15-20 minutes (with rate limiting)
- Skip customers already in correct group
- Log all changes

---

## Monitoring Analytics Updates

### Check Last Run Time

The `.last_update_timestamp` file shows when analytics last updated:

```bash
cat .last_update_timestamp
```

Output: `2026-01-09T18:30:49.199Z`

### Check GitHub Actions Status

```bash
gh run list --workflow="update-customer-analytics.yml" --limit 5
```

Shows recent runs with status (success/failure).

### View Customer Analytics CSV

```bash
# Count customers by tier
awk -F',' 'NR>1 {print $15}' customer_analytics_master.csv | sort | uniq -c | sort -rn

# View last 10 updated customers
tail -10 customer_analytics_master.csv

# Check specific customer
grep "customer@email.com" customer_analytics_master.csv
```

### Check Sync Log

After running the sync script, view results:

```bash
cat tier_sync_log.json
```

Shows:
- Last run time
- How many customers were updated/skipped/errored
- Breakdown by tier
- Error details

---

## Automated Sync Setup

To automatically sync tiers after analytics updates, add to the GitHub Actions workflow:

### Edit `.github/workflows/update-customer-analytics.yml`

Add this step after the incremental update:

```yaml
- name: Sync tiers to Lightspeed
  env:
    EXPO_PUBLIC_LIGHTSPEED_TOKEN: ${{ secrets.LIGHTSPEED_TOKEN }}
    EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX: ${{ secrets.LIGHTSPEED_DOMAIN_PREFIX }}
  run: npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

This will:
- Run daily after analytics update
- Automatically assign customers to their tier groups
- Keep Lightspeed groups in sync with analytics

---

## Monitoring Dashboard (Future Enhancement)

Consider creating a simple dashboard to monitor:

1. **Last Analytics Update**: When analytics last ran
2. **Last Tier Sync**: When tiers were last synced to Lightspeed
3. **Tier Distribution**: Count of customers in each tier
4. **Sync Errors**: Failed assignments
5. **Group Counts**: Actual customer counts in Lightspeed groups

Could be a simple HTML page or added to your existing admin dashboard.

---

## Troubleshooting

### Analytics Not Updating

Check GitHub Actions runs:
```bash
gh run list --workflow="update-customer-analytics.yml"
```

If failing, check logs:
```bash
gh run view [RUN_ID] --log-failed
```

Common issues:
- API token expired
- Rate limiting
- Network issues

### Sync Errors

Check `tier_sync_log.json` for error details.

Common issues:
- Customer doesn't exist in Lightspeed (deleted)
- Customer group ID is wrong
- API rate limiting

### Customers Not Appearing in Groups

1. Verify group IDs are correct
2. Check sync log for errors
3. Verify customer exists in Lightspeed
4. Check if customer tier is "None" (won't be assigned)

---

## Files Created

1. **scripts/syncCustomerTiersToLightspeed.ts** - Main sync script
2. **scripts/getCustomerGroupIds.ts** - Helper to get group IDs
3. **tier_sync_log.json** - Sync results log (created after first run)
4. **CUSTOMER_TIER_SYNC_GUIDE.md** - This guide

---

## Next Steps

1. ✅ Run `getCustomerGroupIds.ts` to get actual Lightspeed group IDs
2. ✅ Update `syncCustomerTiersToLightspeed.ts` with those IDs
3. ✅ Test with `--dry-run --limit 10`
4. ✅ Run limited sync with `--limit 100`
5. ✅ Verify customers appear in Lightspeed groups
6. ✅ Run full sync
7. ✅ Add to GitHub Actions for automated daily syncing
8. ✅ Monitor sync logs and adjust as needed

---

**Last Updated**: January 15, 2026
