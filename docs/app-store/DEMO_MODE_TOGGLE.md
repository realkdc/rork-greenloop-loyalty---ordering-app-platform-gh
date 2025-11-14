# 🎭 Demo Mode Quick Toggle Guide

## Quick Start

### Enable Demo Mode (for App Store submission)
```bash
# 1. Open constants/config.ts
# 2. Change line 39:
DEMO_MODE: true,  // ← Set to true

# 3. Rebuild the app
npm run ios
# or
eas build --platform ios
```

### Disable Demo Mode (for production)
```bash
# 1. Open constants/config.ts
# 2. Change line 39:
DEMO_MODE: false,  // ← Set to false

# 3. Rebuild the app
npm run ios
# or
eas build --platform ios
```

## File Location
```
constants/config.ts
└── Line 39: DEMO_MODE: true/false
```

## What Changes When Enabled?

| Feature | Demo Mode ON | Demo Mode OFF |
|---------|--------------|---------------|
| Login | ❌ Bypassed | ✅ Required |
| Onboarding | ❌ Skipped | ✅ Shows flow |
| Demo Banner | ✅ Visible | ❌ Hidden |
| Checkout | ❌ Disabled | ✅ Enabled |
| Browse Products | ✅ Full access | ✅ Full access |
| Add to Cart | ✅ Works | ✅ Works |

## Visual Indicators

### Demo Mode ON
- Yellow banner at top: "🎭 Demo Mode Active — Browse products as guest"
- Checkout buttons show opacity and display alert when clicked
- Console logs show: `[DemoMode] 🎭 Demo mode active`

### Demo Mode OFF
- No banner
- Normal checkout flow
- Normal authentication required

## Testing

```bash
# After enabling demo mode, test:
1. App launches without login ✓
2. Demo banner visible ✓
3. Products browsable ✓
4. Checkout shows alert ✓
5. Pull-to-refresh works ✓
6. Share button works ✓
```

## Common Scenarios

### Scenario 1: Submitting to App Store
```typescript
// constants/config.ts
DEMO_MODE: true  // ← Use this
```

### Scenario 2: Production Release
```typescript
// constants/config.ts
DEMO_MODE: false  // ← Use this
```

### Scenario 3: Local Development/Testing
```typescript
// constants/config.ts
DEMO_MODE: false  // ← Usually this, unless testing demo flow
```

## Important Notes

⚠️ **Always verify the correct mode before building:**
- App Store Review Build → `true`
- Production Release → `false`

⚠️ **Remember to rebuild after changing:**
- Changes to `config.ts` require a full rebuild
- Hot reload won't pick up this change

## Verification Commands

```bash
# Check current setting
grep "DEMO_MODE" constants/config.ts

# Should show one of:
# DEMO_MODE: true,   // For App Store review
# DEMO_MODE: false,  // For production
```

---

**Pro Tip:** Add a comment in the code when you toggle it so you remember why it's set that way!

```typescript
export const APP_CONFIG = {
  // ...
  DEMO_MODE: true,  // ← ENABLED FOR APP STORE SUBMISSION - TODO: DISABLE AFTER APPROVAL
};
```

