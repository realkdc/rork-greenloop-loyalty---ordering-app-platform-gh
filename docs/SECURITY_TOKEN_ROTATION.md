# Security: Rotate Lightspeed Token

## Why Rotate?

Your Lightspeed API token was exposed in old documentation commits. Even though we're using GitHub Secrets now, it's best practice to rotate (generate a new one) for security.

## Steps to Rotate

### 1. Generate New Token in Lightspeed

1. Go to: https://greenhauscannabisco.retail.lightspeed.app/setup/api
2. Create a new Personal Access Token
3. Copy the new token

### 2. Update GitHub Secrets

1. Go to your GitHub repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **LIGHTSPEED_TOKEN** → **Update**
4. Paste the new token
5. Save

### 3. Update Local .env File

Update `.env`:
```
EXPO_PUBLIC_LIGHTSPEED_TOKEN=<new-token-here>
```

### 4. Revoke Old Token (Optional but Recommended)

1. Go back to Lightspeed API settings
2. Delete/revoke the old token

## After Rotation

- ✅ GitHub Actions will use the new token automatically
- ✅ Local scripts will use the new token from `.env`
- ✅ Old token is no longer valid (if you revoked it)

---

**Note:** The workflow file itself is safe - it uses GitHub Secrets, not hardcoded tokens. The issue was only in old documentation files.
