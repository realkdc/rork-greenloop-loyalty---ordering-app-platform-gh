# How to Find Your Lightspeed Retail Store Subdomain

## The Issue

Your Personal Token (`lsxs_pt_...`) **IS CORRECT** for Lightspeed Retail X-Series!

But the API endpoint needs your **store subdomain**:
```
https://{your-subdomain}.retail.lightspeed.app/api/2.0/
```

## How to Find Your Subdomain

### Method 1: Check Your Lightspeed Retail Admin URL

1. **Log into Lightspeed Retail admin dashboard**
2. **Look at the URL in your browser**
   - It will be something like: `https://greenhaus.retail.lightspeed.app`
   - Or: `https://yourstore.retail.lightspeed.app`
   - The part before `.retail.lightspeed.app` is your subdomain!

### Method 2: Check Store Settings

1. In Lightspeed Retail admin, go to: **Settings** → **Store Settings**
2. Look for "Store URL" or "Domain" or "Subdomain"
3. It should show your subdomain there

### Method 3: Check Your Website

Since your website is `greenhauscc.com`, your subdomain might be:
- `greenhaus`
- `greenhauscc`
- `greenhaus-cannabis`
- Or something similar

## Once You Have the Subdomain

Update your `.env`:
```env
EXPO_PUBLIC_LIGHTSPEED_STORE_SUBDOMAIN=your-subdomain-here
```

Then test:
```bash
npx tsx scripts/testLightspeedAPI.ts
```

## Example API Call

Once you know your subdomain (let's say it's `greenhaus`):

```bash
curl -X GET \
  "https://greenhaus.retail.lightspeed.app/api/2.0/products" \
  -H "Authorization: Bearer lsxs_pt_MxoU8IdsWm5TG7lYgWjVIkqHi8u1gQA9"
```

## Why This Makes Sense

- ✅ Your token IS correct (Lightspeed Retail X-Series Personal Token)
- ✅ The API endpoint just needs your store subdomain
- ✅ Once you have the subdomain, it should work!
