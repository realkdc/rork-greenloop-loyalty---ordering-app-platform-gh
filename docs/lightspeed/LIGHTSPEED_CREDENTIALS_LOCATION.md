# Lightspeed API Credentials - Location & Access

## Where the Token is Stored (Securely)

### 1. GitHub Secrets (For CI/CD)
The Lightspeed API token is stored in GitHub repository secrets:
- Secret name: `LIGHTSPEED_TOKEN`
- Secret name: `LIGHTSPEED_DOMAIN_PREFIX` (value: `greenhauscannabisco`)
- Location: Repository Settings → Secrets and variables → Actions
- Set on: January 7, 2026
- Used by: `.github/workflows/update-customer-analytics.yml`

**To view/update:**
1. Go to: https://github.com/realkdc/rork-greenloop-loyalty---ordering-app-platform-gh/settings/secrets/actions
2. Click on `LIGHTSPEED_TOKEN` to update (cannot view existing value)

### 2. Lightspeed Dashboard (Source of Truth)
The token can be regenerated/viewed from:
- URL: https://greenhauscannabisco.retail.lightspeed.app
- Navigate to: Settings → API / Integrations → API Tokens
- Token format: `lsxs_pt_...` (starts with this prefix)

### 3. Local Development (.env file)
For local testing, add to `.env` file (NOT committed to git):
```bash
EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
```

**IMPORTANT:** The `.env` file is in `.gitignore` and will NEVER be committed to the repository.

## How to Get the Token for Local Testing

**Option 1: From Lightspeed Dashboard**
1. Login to https://greenhauscannabisco.retail.lightspeed.app
2. Go to Settings → API / Integrations
3. Copy the API token (starts with `lsxs_pt_`)
4. Add to your local `.env` file

**Option 2: Ask Team Member**
Someone with access to Lightspeed account can provide the token directly.

## Security Notes

✅ **Safe:**
- Storing in GitHub Secrets (encrypted at rest)
- Storing in local `.env` file (gitignored)
- Documenting where to find it (this file)

❌ **NOT Safe:**
- Committing token to git repository
- Sharing token in Slack/Discord/Email
- Hardcoding in source code
- Including in screenshots/logs

## Token Permissions

The Lightspeed API token has access to:
- Read/Write customer data
- Read/Write customer groups
- Read/Write products
- Read/Write sales/orders

**Keep it secure!**

## If Token is Compromised

1. Login to Lightspeed dashboard
2. Revoke the old token immediately
3. Generate a new token
4. Update GitHub Secret: `LIGHTSPEED_TOKEN`
5. Update local `.env` file
6. Notify team members

## Files Using This Token

- `.github/workflows/update-customer-analytics.yml` - Daily analytics updates
- `scripts/syncCustomerTiersToLightspeed.ts` - Customer tier sync
- `scripts/getCustomerGroupIds.ts` - Get customer groups
- `scripts/testCustomerGroups.ts` - Test customer group API
- `scripts/testLightspeedAPI.ts` - Test Lightspeed API
- `scripts/lightspeed-cli.ts` - Interactive CLI
- `scripts/incrementalUpdate.ts` - Incremental analytics updates
- `scripts/analyzeCustomerMetrics.ts` - Customer analytics
