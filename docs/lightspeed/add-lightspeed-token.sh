#!/bin/bash
# Quick script to add Lightspeed token to .env file

echo "🔑 Lightspeed API Token Setup"
echo "=============================="
echo ""
echo "Where to get your token:"
echo "1. Go to: https://greenhauscannabisco.retail.lightspeed.app"
echo "2. Navigate to: Settings → API / Integrations"
echo "3. Copy your API token (starts with lsxs_pt_)"
echo ""
echo -n "Paste your Lightspeed token here: "
read TOKEN

# Check if token looks valid
if [[ ! $TOKEN =~ ^lsxs_pt_ ]]; then
    echo ""
    echo "⚠️  Warning: Token doesn't start with 'lsxs_pt_'"
    echo "   Are you sure this is correct? (y/n)"
    read -n 1 CONFIRM
    echo ""
    if [[ $CONFIRM != "y" ]]; then
        echo "❌ Cancelled. Please try again with the correct token."
        exit 1
    fi
fi

# Add to .env file
echo "" >> .env
echo "# Lightspeed Retail API Configuration" >> .env
echo "EXPO_PUBLIC_LIGHTSPEED_TOKEN=$TOKEN" >> .env
echo "EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco" >> .env

echo ""
echo "✅ Token added to .env file!"
echo ""
echo "Next steps:"
echo "1. Test connection: npx tsx scripts/testCustomerGroups.ts"
echo "2. Get group IDs and update scripts/syncCustomerTiersToLightspeed.ts"
echo "3. Dry run test: npx tsx scripts/syncCustomerTiersToLightspeed.ts --dry-run --limit 5"
echo ""
