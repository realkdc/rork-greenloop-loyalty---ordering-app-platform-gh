# Lightspeed API Quick Reference

## Test the API

```bash
npx tsx scripts/testLightspeedAPI.ts
```

## Basic Request Format

```javascript
const response = await fetch(
  'https://greenhauscannabisco.retail.lightspeed.app/api/2.0/products',
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN_HERE', // ⚠️ Use environment variable, never hardcode!
      'Content-Type': 'application/json'
    }
  }
);
const data = await response.json();
```

## Available Endpoints

### Store Info
```
GET /retailer
```
Returns: Store name, loyalty settings, timezone, currency

### Products
```
GET /products?page_size=20
```
Returns: Products with images, pricing, SKUs, inventory status

### Customers
```
GET /customers?page_size=20
```
Returns: Customer database, loyalty balances, contact info

### Sales/Orders
```
GET /sales?page_size=20
```
Returns: Completed sales, line items, payments, totals

### Store Locations
```
GET /outlets
```
Returns: Physical store locations with addresses, coordinates

### Registers
```
GET /registers
```
Returns: POS systems, online registers, settings

### Inventory
```
GET /inventory?page_size=20
```
Returns: Real-time stock levels per outlet

### Purchase Orders
```
GET /consignments?page_size=20
```
Returns: Incoming stock, suppliers

## Real Data You Can Access

### Stores
- **GreenHaus Cannabis Co-Crossville**
  - Address: 750 US Hwy 70 E, Suite 106, Crossville, TN 38555
  - Phone: (931) 337-0880
  - Coordinates: 36.1446857, -85.5244405

- **GreenHaus Cannabis Co-Cookeville**

### Loyalty Program
- Enabled: Yes
- Earn rate: 3% back
- Sign-up bonus: $5.00

### Products Example
- Gift Cards
- Various cannabis products
- Full inventory with images

## Common Use Cases

### Get All Products
```javascript
const products = await fetch(
  `${API_BASE}/products?page_size=100`,
  { headers: { 'Authorization': `Bearer ${TOKEN}` }}
).then(r => r.json());
```

### Get Customer by Email
```javascript
const customers = await fetch(
  `${API_BASE}/customers?email=customer@example.com`,
  { headers: { 'Authorization': `Bearer ${TOKEN}` }}
).then(r => r.json());
```

### Get Recent Sales
```javascript
const sales = await fetch(
  `${API_BASE}/sales?after=2026-01-01&page_size=50`,
  { headers: { 'Authorization': `Bearer ${TOKEN}` }}
).then(r => r.json());
```

### Get Inventory for Specific Outlet
```javascript
const inventory = await fetch(
  `${API_BASE}/inventory?outlet_id=06819b3a-2e91-11ed-f9a0-c4d550292f42`,
  { headers: { 'Authorization': `Bearer ${TOKEN}` }}
).then(r => r.json());
```

## Response Format

All endpoints return:
```json
{
  "data": [...],  // Array of results
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 150
  }
}
```

## Rate Limiting

Check response headers:
- `X-RateLimit-Limit`: Requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time until reset

## Troubleshooting

**401 Unauthorized:**
- Regenerate token at: https://greenhauscannabisco.retail.lightspeed.app/setup/personal-tokens
- Update .env with new token
- Test with: `npx tsx scripts/testLightspeedAPI.ts`

**403 Forbidden:**
- Verify you're on Plus plan (Billing page)

**404 Not Found:**
- Check domain prefix is correct: `greenhauscannabisco`

## Environment Variables

```bash
EXPO_PUBLIC_LIGHTSPEED_DOMAIN_PREFIX=greenhauscannabisco
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_token_here  # ⚠️ Never commit real tokens to git!
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://greenhauscannabisco.retail.lightspeed.app/api/2.0
```

## Next Steps

1. Create service file: `services/lightspeed.ts`
2. Build product sync feature
3. Integrate loyalty program
4. Display real-time inventory

---

**Full Documentation:** [docs/LIGHTSPEED_API_SETUP.md](./LIGHTSPEED_API_SETUP.md)
