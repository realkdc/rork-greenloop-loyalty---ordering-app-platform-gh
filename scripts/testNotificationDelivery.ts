/**
 * Test script to verify Android push notification delivery
 *
 * This script tests the FULL notification flow:
 * 1. Fetches the token from Firebase Firestore (where your app registers it)
 * 2. Sends a test notification using Expo's Push Notification API
 * 3. Checks for common issues
 *
 * Usage:
 *   npx ts-node scripts/testNotificationDelivery.ts
 */

import fetch from 'node-fetch';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface PushTokenData {
  token: string;
  deviceOS: string;
  storeId: string;
  env: string;
  optedIn: boolean;
  createdAt: any;
  updatedAt: any;
}

async function testNotificationDelivery() {
  console.log('\n🔍 Android Push Notification Delivery Test\n');
  console.log('='.repeat(60));

  // Step 1: Get token from your backend/Firestore
  console.log('\n📡 Step 1: Fetching registered Android tokens...\n');

  const backendUrl = 'https://greenhaus-admin.vercel.app/api';

  try {
    // Try to get tokens from backend
    const response = await fetch(`${backendUrl}/push/tokens/android`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log('⚠️  Could not fetch tokens from backend. You\'ll need to provide a token manually.');
      console.log('   Get the token from device logs by running:');
      console.log('   adb logcat | grep "Obtained token"');
      console.log('');
      process.exit(1);
    }

    const tokens: PushTokenData[] = await response.json() as PushTokenData[];

    if (tokens.length === 0) {
      console.log('❌ No Android tokens found in database!');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. The app never successfully registered a token');
      console.log('  2. Token registration failed silently');
      console.log('  3. Wrong environment (prod vs dev)');
      console.log('');
      console.log('To register a token:');
      console.log('  1. Open the GreenHaus app on your Android device');
      console.log('  2. Make sure you have a store selected');
      console.log('  3. Check logs: adb logcat | grep registerPushToken');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ Found ${tokens.length} Android token(s)\n`);

    // Use the most recently updated token
    const sortedTokens = tokens.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || a.updatedAt || 0;
      const timeB = b.updatedAt?.toMillis?.() || b.updatedAt || 0;
      return timeB - timeA;
    });

    const latestToken = sortedTokens[0];

    console.log('📱 Using most recent token:');
    console.log(`   Token: ${latestToken.token.substring(0, 30)}...`);
    console.log(`   Device OS: ${latestToken.deviceOS}`);
    console.log(`   Store ID: ${latestToken.storeId}`);
    console.log(`   Opted In: ${latestToken.optedIn}`);
    console.log(`   Environment: ${latestToken.env}`);
    console.log('');

    // Step 2: Send test notification
    console.log('='.repeat(60));
    console.log('\n📤 Step 2: Sending test notification...\n');

    const pushMessage = {
      to: latestToken.token,
      sound: 'default',
      title: '🧪 Test Notification',
      body: 'If you see this, Android notifications are working!',
      data: {
        type: 'test',
        timestamp: Date.now(),
      },
      priority: 'high',
      channelId: 'default',
    };

    console.log('Push message payload:');
    console.log(JSON.stringify(pushMessage, null, 2));
    console.log('');

    const pushResponse = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessage),
    });

    if (!pushResponse.ok) {
      console.log(`❌ Expo Push API returned error: ${pushResponse.status} ${pushResponse.statusText}`);
      const errorText = await pushResponse.text();
      console.log('Error details:', errorText);
      process.exit(1);
    }

    const pushResult = await pushResponse.json();
    console.log('Push API Response:');
    console.log(JSON.stringify(pushResult, null, 2));
    console.log('');

    // Step 3: Analyze result
    console.log('='.repeat(60));
    console.log('\n📊 Step 3: Analyzing result...\n');

    const data = pushResult.data?.[0];

    if (!data) {
      console.log('❌ No response data from Expo Push API');
      process.exit(1);
    }

    if (data.status === 'ok') {
      console.log('✅ Notification sent successfully!');
      console.log(`   Push ticket ID: ${data.id}`);
      console.log('');
      console.log('🎯 What to check now:');
      console.log('  1. Check your Android device - notification should appear');
      console.log('  2. If not visible, check notification tray (swipe down)');
      console.log('  3. Run: adb logcat | grep -E "Notifications|FCM|expo"');
      console.log('');
      console.log('⚠️  Common reasons notification may not appear:');
      console.log('  • Battery optimization is enabled for GreenHaus app');
      console.log('  • Do Not Disturb mode is active');
      console.log('  • Notification channel is disabled in Android settings');
      console.log('  • App is in foreground (some apps suppress foreground notifications)');
      console.log('  • Google Play Services is not working properly');
      console.log('  • Device has no internet connection');
      console.log('');
    } else if (data.status === 'error') {
      console.log('❌ Notification failed to send');
      console.log(`   Error: ${data.message}`);
      console.log(`   Details: ${data.details || 'None'}`);
      console.log('');

      if (data.message === 'DeviceNotRegistered') {
        console.log('🔍 Error Analysis: DeviceNotRegistered');
        console.log('');
        console.log('This means the push token is invalid or expired.');
        console.log('');
        console.log('Solutions:');
        console.log('  1. Uninstall the GreenHaus app completely');
        console.log('  2. Reinstall the app (from Play Store or fresh build)');
        console.log('  3. Open the app and select a store');
        console.log('  4. Check logs for new token: adb logcat | grep "Obtained token"');
        console.log('  5. Wait a few minutes for token to register');
        console.log('  6. Run this script again');
        console.log('');
      } else if (data.message.includes('credentials')) {
        console.log('🔍 Error Analysis: Invalid Credentials');
        console.log('');
        console.log('This means Firebase credentials are misconfigured.');
        console.log('');
        console.log('Solutions:');
        console.log('  1. Verify google-services.json has correct package name');
        console.log('  2. Check Firebase project settings');
        console.log('  3. Ensure FCM is enabled in Firebase console');
        console.log('');
      }
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.log('❌ Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testNotificationDelivery();
