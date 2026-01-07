# Customer ID Systems: X-Series vs E-Series

## Overview

**Lightspeed Retail (X-Series)** and **Lightspeed eCom (E-Series)** are **separate systems** with **separate customer databases**. They use **different customer ID formats** and are **not directly linked**.

## How Customer IDs Work

### X-Series (Retail/POS)
- **System**: Lightspeed Retail POS
- **Customer ID Format**: UUID-like strings
  - Example: `02269032-111f-11f0-fa97-aa6b4d4b1801`
- **Identifiers**: 
  - Customer ID (unique per Retail system)
  - Email
  - Phone
  - Customer Code (e.g., "Keshaun-S6LL")
- **Where orders live**: Retail API (`/search?type=sales&customer_id=...`)

### E-Series (eCom/Online)
- **System**: Lightspeed eCom (online store)
- **Customer ID Format**: Different from X-Series (separate system)
- **Identifiers**:
  - Email (primary)
  - Phone
  - eCom customer ID (separate from Retail)
- **Where orders live**: eCom CSV export (or eCom API if we had access)

## How They Connect

### When eCom Orders Sync to Retail

1. **eCom order is placed** → Stored in E-Series system
2. **Sync process runs** → Lightspeed syncs order to Retail X-Series
3. **Order gets "X-series Order ID"** → This is the Retail sale ID
4. **Customer matching** → Retail matches eCom customer to Retail customer **BY EMAIL**
5. **If no match** → Retail might create new customer record

### The Problem

- **Customer IDs are DIFFERENT** between systems
- **Same person can have:**
  - One customer record in eCom (identified by email)
  - One OR MORE customer records in Retail (identified by email/phone)
  - These records have **different customer IDs**

## How We Handle This

### ✅ Current Approach (Correct)

1. **Match by Email** (not customer ID)
   - `importEcomCSV.ts` searches Retail API by email
   - Finds matching Retail customer
   - Stores `retailCustomerId` (the X-Series customer ID)

2. **Merge by Email**
   - `mergeEcomIntoAnalytics.ts` combines data by email
   - Doesn't rely on customer IDs matching

3. **Deduplicate Retail Customers**
   - `analyzeCustomerMetrics.ts` finds duplicate Retail customers
   - Merges records with same email OR same phone
   - Fetches orders from ALL duplicate customer IDs

### Why This Works

- **Email is the common identifier** across both systems
- **Phone can also be used** for matching
- **Customer IDs are just internal references** - we don't need them to match

## Example: Your Case

You have:
- **eCom**: Customer with email `kdcxmusic@gmail.com` (eCom customer ID: unknown/different)
- **Retail Record 1**: Email `kdcxmusic@gmail.com`, no phone, Customer ID: `02269032-111f-11f0-fa97-aa6b4d4b1801`
- **Retail Record 2**: Phone `6053760333`, no email, Customer ID: `02269032-111f-11f0-eb9a-7616bf2f236e`

**What happens:**
1. eCom orders match to Retail by email → Find Record 1
2. But your 9 orders are on Record 2 (phone-based)
3. Our deduplication finds both Retail records
4. Merges them into one customer record
5. Fetches orders from BOTH customer IDs
6. Final result: One customer with email + phone + all 9 orders ✅

## Do We Need Customer IDs?

### ❌ We DON'T need:
- eCom customer IDs (we use email)
- Matching customer IDs between systems (they're different anyway)

### ✅ We DO need:
- Retail customer IDs (to fetch orders via API)
- Email (to match between systems)
- Phone (to match duplicate Retail records)

## Summary

**Customer IDs are system-specific and don't need to match.** We match customers by **email** and **phone**, which are the common identifiers across both systems. This is the correct approach and what we're already doing.
