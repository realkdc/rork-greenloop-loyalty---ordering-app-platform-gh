# Lightspeed/Ecwid API Research & Testing Guide

## Overview

This document provides comprehensive information about the Lightspeed/Ecwid API integration, how it works, and how to test it properly.

## Understanding the Relationship: Lightspeed vs Ecwid

### Key Points:
1. **Ecwid API is Being Used**: Despite the naming convention "Lightspeed" in the codebase, the actual API being used is **Ecwid API v3**.
2. **Integration Relationship**: Lightspeed Retail (POS) can be integrated with Ecwid (e-commerce platform), but they are separate platforms:
   - **Lightspeed**: Point-of-sale (POS) system
   - **Ecwid**: E-commerce platform (online store)
3. **API Endpoints**: The code uses Ecwid API endpoints:
   - `https://app.ecwid.com/api/v3`
   - `https://api.ecwid.com/api/v3`

## Ecwid API v3 Fundamentals

### Base URL
The primary base URL for Ecwid API v3 is:
```
https://app.ecwid.com/api/v3
```

### Authentication

Ecwid API v3 uses **Bearer Token Authentication**:

```http
Authorization: Bearer {your_access_token}
Content-Type: application/json
```

### Required Credentials

1. **Store ID**: A unique numeric identifier for your Ecwid store
2. **Access Token**: Either a Secret Token or Public Token

#### Finding Your Store ID:
- Log into your Ecwid admin panel
- Navigate to the bottom of any page - your Store ID is displayed there
- Or check the URL when logged in (it's in the URL structure)
- Or go to: Control Panel > Settings > "What's my store ID?"

#### Obtaining Access Tokens:
- Log into your Ecwid admin panel
- Navigate to "My Apps" page
- If you have a custom app, open its details to find access tokens
- **Secret Token**: Grants full access to REST API (keep confidential)
- **Public Token**: Allows access to public store data (safe for public code)

### API Request Format

All API requests follow this pattern:
```
GET https://app.ecwid.com/api/v3/{storeId}/{endpoint}
Authorization: Bearer {secret_token}
```

## Key API Endpoints

### 1. Store Profile
**Endpoint**: `GET /{storeId}/profile`

**Purpose**: Retrieve store information

**Example Request**:
```http
GET https://app.ecwid.com/api/v3/{storeId}/profile
Authorization: Bearer {your_access_token}
```

**Example Response**:
```json
{
  "generalInfo": {
    "storeId": 1003,
    "storeUrl": "https://store1003.company.site/products",
    "websitePlatform": "instantsite",
    "profileId": "p3855016"
  },
  "account": {
    "accountName": "API Team Store",
    "accountEmail": "[email protected]"
  }
}
```

### 2. Products
**Endpoint**: `GET /{storeId}/products`

**Query Parameters**:
- `limit`: Number of products to return (default: 100, max: 100)
- `offset`: Number of products to skip
- `keyword`: Search keyword
- `category`: Filter by category ID

**Example Request**:
```http
GET https://app.ecwid.com/api/v3/{storeId}/products?limit=5
Authorization: Bearer {your_access_token}
```

**Example Response**:
```json
{
  "total": 50,
  "count": 5,
  "offset": 0,
  "limit": 5,
  "items": [
    {
      "id": 123456,
      "sku": "PROD-001",
      "name": "Product Name",
      "price": 29.99,
      "enabled": true,
      "url": "https://store1003.company.site/products/product-name"
    }
  ]
}
```

### 3. Categories
**Endpoint**: `GET /{storeId}/categories`

**Example Request**:
```http
GET https://app.ecwid.com/api/v3/{storeId}/categories
Authorization: Bearer {your_access_token}
```

**Example Response**:
```json
{
  "total": 2,
  "count": 2,
  "offset": 0,
  "limit": 100,
  "items": [
    {
      "id": 9691094,
      "name": "Fruits",
      "description": "A variety of fresh fruits.",
      "enabled": true,
      "productCount": 5,
      "url": "https://store1003.company.site/categories/9691094"
    }
  ]
}
```

## Rate Limits

### Important Limits:
- **600 requests per minute per token**
- Exceeding this limit results in `429 Too Many Requests` error
- Response includes `Retry-After` header indicating cooldown period
- Continued excessive requests may lead to longer token blocks

### Best Practices:
1. **Monitor API Usage**: Track request counts
2. **Implement Exponential Backoff**: If you receive a `429` error, wait before retrying
3. **Optimize API Calls**: Consolidate multiple requests when possible
4. **Cache Responses**: Cache data that doesn't change frequently

## Testing the API

### Using the Test Script

The project includes a test script at `scripts/testLightspeedAPI.ts`:

```bash
npx tsx scripts/testLightspeedAPI.ts
```

### What the Test Script Does:

1. **Step 1: Discover Store ID**
   - Attempts to get store profile without store ID
   - Tries to extract store ID from token format
   - Provides instructions if automatic discovery fails

2. **Step 2: Test Store Profile**
   - Fetches store profile using discovered store ID
   - Validates response structure

3. **Step 3: Test Product List**
   - Fetches first 5 products
   - Displays product information

4. **Step 4: Test Category List**
   - Fetches all categories
   - Displays category information

### Manual Testing with cURL

#### Test Store Profile:
```bash
curl -X GET \
  "https://app.ecwid.com/api/v3/{STORE_ID}/profile" \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Test Products:
```bash
curl -X GET \
  "https://app.ecwid.com/api/v3/{STORE_ID}/products?limit=5" \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json"
```

#### Test Categories:
```bash
curl -X GET \
  "https://app.ecwid.com/api/v3/{STORE_ID}/categories" \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json"
```

### Testing with Postman/Insomnia

1. **Create a new request**
2. **Set Method**: GET
3. **Set URL**: `https://app.ecwid.com/api/v3/{STORE_ID}/profile`
4. **Add Headers**:
   - `Authorization`: `Bearer {YOUR_TOKEN}`
   - `Content-Type`: `application/json`
5. **Send Request**

## Common Errors & Troubleshooting

### 1. Authentication Errors

#### Error: `403 Token doesn't exist`
**Causes**:
- Invalid or expired token
- Token doesn't have necessary permissions
- Token format is incorrect

**Solutions**:
- Verify token in Ecwid admin panel > My Apps
- Generate a new token if expired
- Ensure token has appropriate scope/permissions
- Check token format (should be a string, not empty)

#### Error: `401 Unauthorized`
**Causes**:
- Missing Authorization header
- Incorrect Bearer token format
- Token doesn't match the store

**Solutions**:
- Ensure header format: `Authorization: Bearer {token}`
- Verify token is correct for the store ID
- Check that token hasn't been revoked

### 2. Store ID Errors

#### Error: `404 Not Found` or `Store not found`
**Causes**:
- Incorrect store ID
- Store ID doesn't match the token
- Store has been deleted or deactivated

**Solutions**:
- Verify store ID in Ecwid admin panel
- Ensure store ID matches the token's store
- Check that store is active

### 3. Rate Limit Errors

#### Error: `429 Too Many Requests`
**Causes**:
- Exceeded 600 requests per minute limit

**Solutions**:
- Implement exponential backoff
- Reduce request frequency
- Cache responses to minimize API calls
- Check `Retry-After` header for wait time

### 4. Request Format Errors

#### Error: `400 Bad Request`
**Causes**:
- Invalid endpoint URL
- Missing required parameters
- Invalid parameter values

**Solutions**:
- Verify endpoint URL format
- Check API documentation for required parameters
- Validate parameter types and values

## Environment Variables

Based on the codebase, these environment variables are used:

```env
# LightSpeed (Ecwid) API Configuration
EXPO_PUBLIC_LIGHTSPEED_TOKEN=your_token_here
EXPO_PUBLIC_LIGHTSPEED_STORE_ID=your_store_id_here
EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
```

### Setting Up Environment Variables:

1. **Get your token** from Ecwid admin panel > My Apps
2. **Get your store ID** from Ecwid admin panel (bottom of any page)
3. **Add to `.env` file**:
   ```env
   EXPO_PUBLIC_LIGHTSPEED_TOKEN=lsxs_pt_...
   EXPO_PUBLIC_LIGHTSPEED_STORE_ID=123456
   EXPO_PUBLIC_LIGHTSPEED_API_BASE=https://app.ecwid.com/api/v3
   ```

## Current Implementation Analysis

### Test Script (`scripts/testLightspeedAPI.ts`)

**Strengths**:
- ✅ Attempts automatic store ID discovery
- ✅ Tests multiple endpoints (profile, products, categories)
- ✅ Provides helpful error messages
- ✅ Tries multiple base URLs

**Potential Issues**:
- ⚠️ The `/profile` endpoint without store ID may not work for all token types
- ⚠️ Token format parsing (`lsxs_pt_`) suggests Lightspeed token, but using Ecwid API
- ⚠️ May need to manually provide store ID if auto-discovery fails

### Recommendations for Improvement:

1. **Add Store ID as Optional Parameter**:
   ```typescript
   const STORE_ID = process.env.EXPO_PUBLIC_LIGHTSPEED_STORE_ID;
   ```

2. **Better Error Handling**:
   - Distinguish between authentication errors and store ID errors
   - Provide specific guidance based on error type

3. **Add More Test Endpoints**:
   - Test orders endpoint (if permissions allow)
   - Test inventory endpoint
   - Test webhooks (if applicable)

4. **Validate Token Format**:
   - Check if token looks valid before making requests
   - Provide guidance on token format

## Best Practices

### 1. Security
- **Never commit tokens to version control**
- Use environment variables for all sensitive data
- Use Public Tokens for client-side code when possible
- Keep Secret Tokens server-side only

### 2. Error Handling
- Always check response status codes
- Implement retry logic with exponential backoff
- Log errors for debugging
- Provide user-friendly error messages

### 3. Performance
- Cache API responses when appropriate
- Batch requests when possible
- Monitor rate limit usage
- Use pagination for large datasets

### 4. Testing
- Test with different token types
- Test rate limit handling
- Test error scenarios
- Test with invalid credentials

## Official Documentation

- **Ecwid API v3 Reference**: https://docs.ecwid.com/api-reference/
- **Getting Started**: https://docs.ecwid.com/get-started/make-your-first-api-request
- **Authentication**: https://docs.ecwid.com/develop-apps/app-settings
- **Store Profile**: https://docs.ecwid.com/api-reference/rest-api/store-profile/get-store-profile
- **Products API**: https://docs.ecwid.com/api-reference/rest-api/products
- **Categories API**: https://docs.ecwid.com/api-reference/rest-api/categories

## Next Steps

1. **Run the test script** to verify API connection:
   ```bash
   npx tsx scripts/testLightspeedAPI.ts
   ```

2. **If store ID discovery fails**, manually find it:
   - Log into Ecwid admin panel
   - Check bottom of any page for Store ID
   - Add to `.env` file

3. **Verify token permissions**:
   - Check in Ecwid admin panel > My Apps
   - Ensure token has necessary scopes

4. **Test individual endpoints** using cURL or Postman

5. **Integrate API calls** into your application code

## Questions to Resolve

1. **Token Type**: Is `lsxs_pt_` a Lightspeed token or Ecwid token?
   - If Lightspeed token, why using Ecwid API?
   - If Ecwid token, why the Lightspeed prefix?

2. **Store ID**: Can it be discovered automatically, or must it be provided?
   - Current script attempts auto-discovery but may fail

3. **Integration Purpose**: What specific functionality needs the API?
   - Products listing?
   - Inventory management?
   - Order processing?
   - Other?

4. **Backend vs Frontend**: Should API calls be made from:
   - Client-side (React Native app)?
   - Server-side (backend/hono.ts)?
   - Both?

## Summary

- The codebase uses **Ecwid API v3**, not Lightspeed API directly
- Authentication requires a **Store ID** and **Bearer Token**
- Rate limit is **600 requests per minute**
- Test script exists but may need manual store ID input
- Official Ecwid documentation is the best resource for API details
