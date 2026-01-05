# Lightspeed Application Setup Guide

## Current Step: Add Application Form

You're on the "Add Application" screen in Lightspeed Developers portal.

### Fields to Fill:

1. **Application Name**: ✅ Already filled - "GreenLoop"

2. **Redirect URL**: ❌ Need to fill this

### What is Redirect URL?

The Redirect URL is where users are sent **after they authorize your app** (if using OAuth flow).

### Options for Redirect URL:

#### Option 1: For OAuth Flow (if you need user authorization)
```
https://greenhaus-admin.vercel.app/api/auth/lightspeed/callback
```
Or for local development:
```
http://localhost:3000/api/auth/lightspeed/callback
```

#### Option 2: For Personal Token (Simpler - Recommended)
If you're using a **Personal Token** (like the one you have: `lsxs_pt_...`), you might not need OAuth. In that case:

1. **Skip this form** - Go back
2. **Use Personal Token directly** - You already have: `lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9`
3. **Just need to get the e-commerce API token** from a different place

### What Should You Do?

**If you want to use OAuth (for multi-store access):**
- Enter a callback URL like: `https://greenhaus-admin.vercel.app/api/auth/callback`
- Click "Save Application"
- You'll get Client ID and Client Secret
- Use those for OAuth flow

**If you just need API access (simpler):**
- You might not need this form
- Check if there's a "Personal Tokens" or "API Keys" section instead
- Or look in: **Settings** > **Store Settings** > **Developers** in your Lightspeed Retail admin

### Next Steps After Saving:

1. You'll get:
   - **Client ID**
   - **Client Secret**
   
2. Use these for OAuth authentication OR use Personal Token directly

3. Test the API with your Store ID: `86917525`

## Recommendation

Since you already have a Personal Token (`lsxs_pt_...`), you might want to:
1. **Check if Personal Token works** for e-commerce API first
2. **If not**, then create this OAuth app and use the callback URL

For now, you can enter:
```
https://greenhaus-admin.vercel.app/api/auth/callback
```

Then click "Save Application" to proceed.
