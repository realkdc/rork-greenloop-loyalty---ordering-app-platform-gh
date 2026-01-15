#!/bin/bash
# Test script to sync a few customers to Lightspeed groups
#
# This script will:
# 1. Get Lightspeed customer group IDs
# 2. Update the sync script with those IDs
# 3. Run a test sync with 5 customers in dry-run mode
# 4. If successful, sync 10 real customers

set -e

echo "🔍 Step 1: Fetching Lightspeed Customer Group IDs..."
echo ""

# Get secrets from GitHub (you need to run this manually or set env vars)
if [ -z "$EXPO_PUBLIC_LIGHTSPEED_TOKEN" ]; then
    echo "❌ EXPO_PUBLIC_LIGHTSPEED_TOKEN not set"
    echo ""
    echo "Please run:"
    echo "  export EXPO_PUBLIC_LIGHTSPEED_TOKEN=\"your-token\""
    echo "  export EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=\"greenhauscannabisco\""
    echo ""
    echo "Or get them from GitHub secrets:"
    echo "  gh secret list"
    exit 1
fi

npx tsx scripts/getCustomerGroupIds.ts

echo ""
echo "📝 Step 2: Update scripts/syncCustomerTiersToLightspeed.ts with the IDs shown above"
echo ""
read -p "Press Enter when you've updated the script..."

echo ""
echo "🧪 Step 3: Testing with 5 customers (dry-run)..."
npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5

echo ""
read -p "Does the dry-run look correct? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "✅ Step 4: Syncing 10 real customers..."
    npx tsx scripts/syncCustomerTiersToLightspeed.ts --limit 10

    echo ""
    echo "✅ Test sync complete! Check tier_sync_log.json for results"
    echo ""
    echo "To sync all customers, run:"
    echo "  npx tsx scripts/syncCustomerTiersToLightspeed.ts"
else
    echo "⏭️  Skipping real sync. Fix the issues and run again."
fi
