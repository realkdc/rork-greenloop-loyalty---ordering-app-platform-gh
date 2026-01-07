# GitHub Actions Setup Guide

## Quick Setup (5 minutes)

### Step 1: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

   **Secret 1:**
   - Name: `LIGHTSPEED_TOKEN`
   - Value: Your Lightspeed API token (from `.env` file: `EXPO_PUBLIC_LIGHTSPEED_TOKEN`)

   **Secret 2:**
   - Name: `LIGHTSPEED_DOMAIN_PREFIX`
   - Value: Your Lightspeed domain prefix (from `.env` file: `EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX`)

### Step 2: Commit the Workflow File

The workflow file is already created at:
```
.github/workflows/update-customer-analytics.yml
```

Just commit and push it:

```bash
git add .github/workflows/update-customer-analytics.yml
git commit -m "Add automated customer analytics updates"
git push
```

### Step 3: Verify It's Working

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You should see "Update Customer Analytics" workflow
4. It will run automatically daily at 2 AM UTC
5. You can also trigger it manually by clicking "Run workflow"

---

## What It Does

- ✅ Runs daily at 2:00 AM UTC (automatically)
- ✅ Updates customer analytics (LTV, orders, tiers)
- ✅ Commits updated CSV back to the repository
- ✅ Saves artifacts (backup of CSV files)
- ✅ Can be triggered manually anytime

---

## Schedule Times

The workflow runs at **2:00 AM UTC** by default.

**Time conversions:**
- **2:00 AM UTC** = 9:00 PM EST (previous day)
- **2:00 AM UTC** = 6:00 PM PST (previous day)
- **2:00 AM UTC** = 2:00 AM GMT

**To change the time**, edit `.github/workflows/update-customer-analytics.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # Change the hour (2) to your preferred time
```

**Cron format:** `minute hour day month weekday`

Examples:
- `0 2 * * *` = 2:00 AM daily
- `0 9 * * *` = 9:00 AM daily
- `0 */6 * * *` = Every 6 hours

---

## Manual Trigger

You can run it manually anytime:

1. Go to **Actions** tab
2. Click **Update Customer Analytics**
3. Click **Run workflow**
4. Click the green **Run workflow** button

---

## Viewing Results

### Check Workflow Runs

1. Go to **Actions** tab
2. Click on a workflow run
3. Click on **update-analytics** job
4. Expand **Run incremental update** to see logs

### Download Updated CSV

1. Go to **Actions** tab
2. Click on a completed workflow run
3. Scroll down to **Artifacts**
4. Download **customer-analytics-master**

### View Updated CSV in Repository

The updated CSV is automatically committed back to the repo:
- File: `customer_analytics_master.csv`
- Updated daily with latest data

---

## Troubleshooting

### "Secret not found" error

Make sure you added both secrets:
- `LIGHTSPEED_TOKEN`
- `LIGHTSPEED_DOMAIN_PREFIX`

Go to: **Settings** → **Secrets and variables** → **Actions**

### "Workflow not running"

1. Check if workflow file is in `.github/workflows/` directory
2. Make sure it's committed and pushed to GitHub
3. Check the **Actions** tab for any errors

### "Permission denied" when committing

The workflow uses `GITHUB_TOKEN` which should work automatically. If not:
1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select **Read and write permissions**
3. Check **Allow GitHub Actions to create and approve pull requests**

### Wrong timezone

The cron schedule uses UTC. Adjust the hour in the cron expression:
- For EST (UTC-5): `0 7 * * *` = 2 AM EST
- For PST (UTC-8): `0 10 * * *` = 2 AM PST

---

## Advantages Over Cron

✅ **Runs in the cloud** - No need to keep your computer on
✅ **Automatic backups** - CSV saved as artifacts
✅ **Version control** - Updated CSV committed to repo
✅ **Easy monitoring** - See all runs in GitHub Actions
✅ **Manual trigger** - Run anytime from GitHub UI
✅ **Free** - GitHub Actions free tier includes 2,000 minutes/month

---

## Next Steps

1. ✅ Add secrets to GitHub (Step 1 above)
2. ✅ Commit and push workflow file (Step 2 above)
3. ✅ Test it manually (Step 3 above)
4. ✅ Let it run automatically daily!

That's it! Your customer analytics will update automatically every day.
