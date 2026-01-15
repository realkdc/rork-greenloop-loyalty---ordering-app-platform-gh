# Quick Test: Sync Customer Tiers to Lightspeed

## Current Status

✅ **CSV is UP TO DATE!**
- Downloaded latest from GitHub Actions (Jan 15, 2026)
- **9,344 customers** total (up from 9,282)
- File size: 1.2M

## Quick Test Steps

### Step 1: Set Lightspeed Credentials

The credentials are in GitHub Secrets. To use them locally:

```bash
# Option A: Get from GitHub Secrets (if you have access)
gh secret get LIGHTSPEED_TOKEN
gh secret get LIGHTSPEED_DOMAIN_PREFIX

# Option B: Export them (ask someone with access to provide)
export EXPO_PUBLIC_LIGHTSPEED_TOKEN="your-token-here"
export EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX="greenhauscannabisco"
```

### Step 2: Get Customer Group IDs

```bash
npx tsx scripts/getCustomerGroupIds.ts
```

This will output something like:

```
✅ Found 5 customer groups:

1. First Time Buyer
   ID: abc-123-def
   Customers: 0

2. GreenHaus Crew - Seed (Loyalty + First Purchase)
   ID: ghi-456-jkl
   Customers: 0

3. GreenHaus Crew - Sprout ($250 CLV or 3 purchases/month)
   ID: mno-789-pqr
   Customers: 0

4. GreenHaus Crew - Bloom ($750 CLV)
   ID: stu-012-vwx
   Customers: 0

5. GreenHaus Crew - Evergreen ($1,500 CLV)
   ID: yza-345-bcd
   Customers: 0
```

### Step 3: Update Sync Script

Edit `scripts/syncCustomerTiersToLightspeed.ts` line 38-44:

Replace:
```typescript
const TIER_TO_GROUP_MAP: Record<string, string> = {
  'First Time Buyer': 'FIRST_TIME_BUYER_GROUP_ID',
  'Seed': 'SEED_GROUP_ID',
  'Sprout': 'SPROUT_GROUP_ID',
  'Bloom': 'BLOOM_GROUP_ID',
  'Evergreen': 'EVERGREEN_GROUP_ID',
  'None': ''
};
```

With the actual IDs from Step 2.

### Step 4: Test with 5 Customers (Dry Run)

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5
```

Expected output:
```
🚀 Lightspeed Customer Tier Sync
================================

🧪 DRY RUN MODE - No changes will be made

📋 Fetching Lightspeed customer groups...
✅ Found 5 customer groups:
   - First Time Buyer (ID: abc-123)
   - GreenHaus Crew - Seed (ID: ghi-456)
   ...

📊 Tier to Group Mapping:
   First Time Buyer → First Time Buyer (abc-123)
   Seed → GreenHaus Crew - Seed (ghi-456)
   ...

📁 Loading customers from CSV...
✅ Loaded 9344 customers

🔄 Processing 5 customers...

[1/5] 🔄 Assigning John Doe to Seed...
   [DRY RUN] Would assign customer 123-abc to group ghi-456
[1/5] ✅ Updated

...

✨ Sync Complete!

Total Customers: 5
✅ Updated: 5
⏭️  Skipped: 0
❌ Errors: 0

Tier Breakdown:
   Seed: 3
   Sprout: 2

🧪 This was a DRY RUN - no actual changes were made
```

### Step 5: Real Test with 10 Customers

If dry-run looks good:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 10
```

This will actually assign 10 customers to their tier groups.

### Step 6: Verify in Lightspeed

Go to your Lightspeed dashboard and check:
- Customer Groups should now show customer counts
- Check a few customers to verify they're in the correct group

### Step 7: Full Sync (All 9,344 Customers)

Once verified:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

This will:
- Take ~15-20 minutes (with rate limiting)
- Skip customers already in correct groups
- Create `tier_sync_log.json` with full results

Expected results:
- Seed: ~6,112 customers assigned
- Sprout: ~1,378 customers assigned
- Bloom: ~663 customers assigned
- Evergreen: ~881 customers assigned
- Skipped: ~247 (tier = "None")

---

## If You Don't Have Lightspeed Credentials Locally

You can add the sync step to the GitHub Actions workflow so it runs automatically:

Edit `.github/workflows/update-customer-analytics.yml` and add after line 53:

```yaml
- name: Sync tiers to Lightspeed
  env:
    EXPO_PUBLIC_LIGHTSPEED_TOKEN: ${{ secrets.LIGHTSPEED_TOKEN }}
    EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX: ${{ secrets.LIGHTSPEED_DOMAIN_PREFIX }}
  run: npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

Then it will automatically sync customers daily after updating analytics!

---

**Ready to test?** Just need the Lightspeed API credentials to get started!
