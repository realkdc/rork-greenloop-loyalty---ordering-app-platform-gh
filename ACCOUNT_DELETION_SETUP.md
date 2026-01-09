# Account Deletion Feature - Setup Guide

## Overview
The account deletion feature allows users to request account deletion from within the app. Requests are stored in Firestore and need to be manually processed.

## How It Works

1. **User Flow:**
   - User navigates to the Profile tab
   - Taps the red "Delete Account" button (bottom right)
   - Enters their email address in the confirmation modal
   - Submits the request

2. **Backend:**
   - Request is sent via tRPC to `/api/trpc/account.deleteRequest`
   - Data is stored in Firestore collection: `accountDeletionRequests`
   - Each request includes:
     - `email`: User's email address
     - `requestedAt`: Timestamp
     - `status`: "pending"

## Monitoring Deletion Requests

### Option 1: Firebase Console (Manual Check)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `greenhaus-app`
3. Navigate to Firestore Database
4. Look for the `accountDeletionRequests` collection
5. Review pending requests and process them manually

### Option 2: Set Up Email Notifications (Recommended)

To automatically receive emails when users request account deletion, you can set up a Firebase Cloud Function:

1. Create a file: `functions/src/accountDeletionNotification.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const notifyAccountDeletion = functions.firestore
  .document('accountDeletionRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const email = data.email;
    const requestedAt = data.requestedAt?.toDate() || new Date();

    // Send email to greenhauscc@gmail.com
    // You'll need to set up email service (SendGrid, etc.)
    console.log(`New account deletion request from: ${email}`);
    console.log(`Requested at: ${requestedAt}`);

    // TODO: Implement email sending here
  });
```

2. Deploy the function:
```bash
firebase deploy --only functions
```

## Processing Deletion Requests

When you receive a deletion request:

1. **Verify the request** - Confirm the email address
2. **Delete user data** - Remove all user data from your systems:
   - Firebase Auth account
   - Firestore user documents
   - Any other associated data
3. **Send confirmation email** - Email the user confirming deletion within 24-48 hours
4. **Update Firestore** - Mark the request as processed:
   ```
   status: "completed"
   processedAt: [timestamp]
   ```

## Apple App Store Compliance

This feature satisfies Apple's requirement for user account deletion:
- ✅ Users can initiate account deletion from within the app
- ✅ Clear confirmation dialog explains the action
- ✅ Users receive confirmation of their request
- ✅ Processing within 24-48 hours (as promised to users)

## Support Contact
If users have issues, direct them to: **greenhauscc@gmail.com**
