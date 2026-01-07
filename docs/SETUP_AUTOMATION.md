# Setting Up Automated Updates

## Quick Setup (Easiest)

Run this command:

```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp
./scripts/setupCron.sh
```

This will:
- ✅ Set up a cron job that runs daily at 2 AM
- ✅ Create a logs directory
- ✅ Configure automatic logging

---

## Manual Setup

### Step 1: Open Crontab Editor

```bash
crontab -e
```

This opens your cron configuration in your default editor.

### Step 2: Add This Line

Add this line at the bottom:

```
0 2 * * * cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp && /usr/local/bin/npx tsx scripts/incrementalUpdate.ts >> logs/update.log 2>&1
```

**What this means:**
- `0 2 * * *` = Run at 2:00 AM every day
- `cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp` = Go to project directory
- `npx tsx scripts/incrementalUpdate.ts` = Run the update script
- `>> logs/update.log 2>&1` = Save output to log file

### Step 3: Save and Exit

- **nano**: Press `Ctrl+X`, then `Y`, then `Enter`
- **vim**: Press `Esc`, type `:wq`, press `Enter`
- **VS Code**: Just save and close

---

## Verify It's Set Up

```bash
# View your cron jobs
crontab -l

# You should see the incrementalUpdate line
```

---

## Change the Schedule

Edit the cron time (first 5 numbers):

```
* * * * *  = Every minute
0 * * * *  = Every hour (at :00)
0 2 * * *  = Daily at 2 AM (recommended)
0 2 * * 1  = Every Monday at 2 AM
0 */6 * * * = Every 6 hours
```

**Format:** `minute hour day month weekday`

Examples:
- `0 2 * * *` = 2:00 AM daily
- `0 9,17 * * *` = 9:00 AM and 5:00 PM daily
- `0 2 * * 1-5` = 2:00 AM on weekdays only

---

## View Logs

```bash
# View recent logs
tail -f logs/update.log

# View last 50 lines
tail -50 logs/update.log

# Search for errors
grep -i error logs/update.log
```

---

## Remove Automation

```bash
# Edit cron jobs
crontab -e

# Delete the line with "incrementalUpdate"
# Save and exit
```

Or use the setup script:

```bash
crontab -l | grep -v "incrementalUpdate" | crontab -
```

---

## Troubleshooting

### "Command not found: npx"

Find where npx is installed:

```bash
which npx
```

Then use the full path in cron:

```
0 2 * * * cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp && /full/path/to/npx tsx scripts/incrementalUpdate.ts >> logs/update.log 2>&1
```

### "Permission denied"

Make sure the script is executable:

```bash
chmod +x scripts/incrementalUpdate.ts
```

### Cron not running

Check if cron is enabled on Mac:

```bash
# macOS might need Full Disk Access for cron
# Go to: System Settings > Privacy & Security > Full Disk Access
# Add: Terminal (or whatever app runs cron)
```

### Test manually first

Before relying on cron, test the script manually:

```bash
cd /Users/drippo/Desktop/GH-GreenLoop_IOS+GPApp
npx tsx scripts/incrementalUpdate.ts
```

If this works, cron should work too.

---

## Alternative: GitHub Actions (Cloud-Based)

If you don't want to keep your computer on, use GitHub Actions:

1. Push your code to GitHub
2. Create `.github/workflows/update-analytics.yml`
3. GitHub will run it on their servers daily

See `CUSTOMER_ANALYTICS_UPDATE_SYSTEM.md` for GitHub Actions setup.

---

## Summary

**Easiest way:**
```bash
./scripts/setupCron.sh
```

**Manual way:**
```bash
crontab -e
# Add the cron line
# Save and exit
```

**Verify:**
```bash
crontab -l
```

**View logs:**
```bash
tail -f logs/update.log
```

That's it! Your updates will run automatically every day at 2 AM.
