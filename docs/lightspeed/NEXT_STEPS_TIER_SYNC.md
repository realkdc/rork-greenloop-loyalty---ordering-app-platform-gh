# Next Steps: Test Customer Tier Sync

## Current Status

✅ **Customer Analytics CSV**: Up to date (9,344 customers, downloaded Jan 15, 2026)
✅ **Sync Scripts**: All created and ready to use
✅ **Test Scripts**: Already exist in android-googleplay branch
⏳ **Lightspeed Credentials**: Need to be added to .env file

## What You Need to Do

### 1. Add Lightspeed Credentials to .env

Edit your [.env](.env) file and add these two lines:

```bash
EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_your-actual-token-here
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
```

**Where to get the token:**
- Lightspeed Dashboard: https://greenhauscannabisco.retail.lightspeed.app
- Go to Settings → API / Integrations
- Copy your API token (starts with `lsxs_pt_`)

### 2. Test Lightspeed Connection & Get Group IDs

```bash
# Option A: Use the existing test script (recommended)
npx tsx scripts/testCustomerGroups.ts

# Option B: Use the new script we created
npx tsx scripts/getCustomerGroupIds.ts
```

Both will output the customer group IDs like:

```
✅ Found 5 customer groups:

1. First Time Buyer
   ID: abc-123-def-456
   Customers: 0

2. GreenHaus Crew - Seed (Loyalty + First Purchase)
   ID: ghi-789-jkl-012
   Customers: 0

3. GreenHaus Crew - Sprout ($250 CLV or 3 purchases/month)
   ID: mno-345-pqr-678
   Customers: 0

4. GreenHaus Crew - Bloom ($750 CLV)
   ID: stu-901-vwx-234
   Customers: 0

5. GreenHaus Crew - Evergreen ($1,500 CLV)
   ID: yza-567-bcd-890
   Customers: 0
```

### 3. Update Sync Script with Real Group IDs

Edit [scripts/syncCustomerTiersToLightspeed.ts](scripts/syncCustomerTiersToLightspeed.ts) lines 41-47:

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

With the actual IDs from step 2:
```typescript
const TIER_TO_GROUP_MAP: Record<string, string> = {
  'First Time Buyer': 'abc-123-def-456',
  'Seed': 'ghi-789-jkl-012',
  'Sprout': 'mno-345-pqr-678',
  'Bloom': 'stu-901-vwx-234',
  'Evergreen': 'yza-567-bcd-890',
  'None': ''
};
```

### 4. Test Sync with 5 Customers (Dry Run)

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5
```

This will show what WOULD happen without making any changes:

```
🚀 Lightspeed Customer Tier Sync
================================

🧪 DRY RUN MODE - No changes will be made

✅ Found 5 customer groups:
   - First Time Buyer (ID: abc-123)
   - GreenHaus Crew - Seed (ID: ghi-456)
   ...

📊 Tier to Group Mapping:
   First Time Buyer → First Time Buyer (abc-123)
   Seed → GreenHaus Crew - Seed (ghi-456)
   ...

🔄 Processing 5 customers...

[1/5] 🔄 Assigning John Doe to Seed...
   [DRY RUN] Would assign customer 123-abc to group ghi-456
[1/5] ✅ Updated

...

✨ Sync Complete!
Total: 5, Updated: 5, Skipped: 0, Errors: 0
```

### 5. Real Test with 10 Customers

If dry run looks good:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 10
```

This will actually assign 10 customers to their tier groups.

### 6. Verify in Lightspeed

Go to your Lightspeed dashboard:
- Navigate to Customers → Customer Groups
- Verify the 10 customers appear in their correct groups
- Check that the group counts updated (should show 1-10 customers in various groups)

### 7. Full Sync (All 9,344 Customers)

Once verified the 10 test customers worked:

```bash
npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

This will:
- Process all 9,344 customers
- Take ~15-20 minutes (100ms delay between API calls for rate limiting)
- Skip customers already in correct groups
- Create `tier_sync_log.json` with detailed results

Expected results:
- **Seed**: ~6,112 customers assigned
- **Sprout**: ~1,378 customers assigned
- **Bloom**: ~663 customers assigned
- **Evergreen**: ~881 customers assigned
- **None/Skipped**: ~247 customers (no tier assigned)

---

## Files Reference

### Existing Test Scripts (android-googleplay branch)
- [scripts/testCustomerGroups.ts](scripts/testCustomerGroups.ts) - Tests customer group API
- [scripts/testLightspeedAPI.ts](scripts/testLightspeedAPI.ts) - Tests general Lightspeed API
- [scripts/lightspeed-cli.ts](scripts/lightspeed-cli.ts) - Interactive CLI for Lightspeed

### New Sync Scripts (created today)
- [scripts/getCustomerGroupIds.ts](scripts/getCustomerGroupIds.ts) - Get group IDs
- [scripts/syncCustomerTiersToLightspeed.ts](scripts/syncCustomerTiersToLightspeed.ts) - Main sync script

### Documentation
- [QUICK_TEST_SYNC.md](QUICK_TEST_SYNC.md) - Step-by-step testing guide
- [CUSTOMER_TIER_SYNC_GUIDE.md](CUSTOMER_TIER_SYNC_GUIDE.md) - Complete setup guide
- [SETUP_LIGHTSPEED_CREDENTIALS.md](SETUP_LIGHTSPEED_CREDENTIALS.md) - Credential setup guide

### Data Files
- [customer_analytics_master.csv](customer_analytics_master.csv) - Master customer data (9,344 customers)
- `tier_sync_log.json` - Created after first sync, tracks results

---

## TL;DR

1. Add `EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...` to [.env](.env)
2. Run `npx tsx scripts/testCustomerGroups.ts` to get group IDs
3. Update [scripts/syncCustomerTiersToLightspeed.ts](scripts/syncCustomerTiersToLightspeed.ts) with those IDs
4. Test: `npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5`
5. Run: `npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 10`
6. Verify in Lightspeed dashboard
7. Full sync: `npx tsx scripts/syncCustomerTiersToLightspeed.ts`

**You're all set! Just need to add the Lightspeed token to .env to get started.**
