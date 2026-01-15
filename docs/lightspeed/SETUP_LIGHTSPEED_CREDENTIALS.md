# Setup Lightspeed Credentials for Testing

## Quick Setup

Add these two lines to your [.env](.env) file:

```bash
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your-token-here
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
```

## Where to Get the Token

The Lightspeed API token is stored in GitHub Secrets. You'll need to either:

1. **Get it from your Lightspeed dashboard**:
   - Go to https://greenhauscannabisco.retail.lightspeed.app
   - Navigate to Settings → API / Integrations
   - Generate or copy your API token
   - It should start with `lsxs_pt_` or similar

2. **Or ask someone on your team** who has access to the Lightspeed account

## Once You Have the Credentials

Run these commands to test the Lightspeed integration:

```bash
# 1. Get all customer group IDs from Lightspeed
npx tsx scripts/getCustomerGroupIds.ts

# This will output something like:
# ✅ Found 5 customer groups:
#
# 1. First Time Buyer
#    ID: abc-123-def
#    Customers: 0
#
# 2. GreenHaus Crew - Seed (Loyalty + First Purchase)
#    ID: ghi-456-jkl
#    Customers: 0
# ...

# 2. Copy those IDs into scripts/syncCustomerTiersToLightspeed.ts
# Update lines 41-47 with the actual group IDs

# 3. Test sync with 5 customers (dry run - no changes made)
npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5

# 4. If that looks good, sync 10 customers for real
npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 10

# 5. Verify in Lightspeed that those 10 customers appear in their correct groups

# 6. Once confirmed working, sync all 9,344 customers
npx tsx scripts/syncCustomerTiersToLightspeed.ts
```

## Security Note

**DO NOT commit the .env file with the token!**

The .env file is already in .gitignore, but double-check you don't accidentally commit it.
