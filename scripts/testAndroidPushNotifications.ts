#!/usr/bin/env ts-node
/**
 * Test script for Android Push Notifications
 *
 * This script helps you test push notification setup before building the app.
 *
 * Usage:
 *   npx ts-node scripts/testAndroidPushNotifications.ts <expo-push-token> <store-id>
 *
 * Example:
 *   npx ts-node scripts/testAndroidPushNotifications.ts "ExponentPushToken[abc123]" "2"
 */

const BACKEND_URL = "https://greenhaus-admin.vercel.app/api";

async function testPushSetup(token: string, storeId: string) {
  console.log("🧪 Testing Android Push Notification Setup\n");
  console.log("📋 Configuration:");
  console.log(`   Backend URL: ${BACKEND_URL}`);
  console.log(`   Expo Token: ${token.substring(0, 30)}...`);
  console.log(`   Store ID: ${storeId}\n`);

  // Test 1: Register push token
  console.log("1️⃣ Testing token registration...");
  try {
    const registerResponse = await fetch(`${BACKEND_URL}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        deviceOS: "android",
        storeId,
        env: "prod",
        optedIn: true,
      }),
    });

    const registerData = await registerResponse.json();

    if (registerResponse.ok && registerData.ok) {
      console.log("   ✅ Token registration successful!\n");
    } else {
      console.log("   ❌ Token registration failed!");
      console.log(`   Status: ${registerResponse.status}`);
      console.log(`   Response:`, registerData);
      process.exit(1);
    }
  } catch (error) {
    console.log("   ❌ Token registration error:", error);
    process.exit(1);
  }

  // Test 2: Check Firebase config
  console.log("2️⃣ Checking Firebase configuration...");
  try {
    const fs = require("fs");
    const path = require("path");

    const googleServicesPath = path.join(__dirname, "../google-services.json");
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, "utf-8"));

    const hasAndroidClient = googleServices.client.some(
      (c: any) => c.client_info.android_client_info.package_name === "com.greenloop.greenhaus"
    );

    if (hasAndroidClient) {
      console.log("   ✅ google-services.json has com.greenloop.greenhaus config\n");
    } else {
      console.log("   ⚠️  google-services.json missing com.greenloop.greenhaus!");
      console.log("   Found packages:", googleServices.client.map((c: any) => c.client_info.android_client_info.package_name));
      console.log("");
    }
  } catch (error) {
    console.log("   ⚠️  Could not read google-services.json:", error);
  }

  // Test 3: Check app.json permissions
  console.log("3️⃣ Checking app.json permissions...");
  try {
    const fs = require("fs");
    const path = require("path");

    const appJsonPath = path.join(__dirname, "../app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));

    const permissions = appJson.expo?.android?.permissions || [];
    const hasPostNotifications = permissions.some((p: string) =>
      p === "POST_NOTIFICATIONS" || p === "android.permission.POST_NOTIFICATIONS"
    );

    if (hasPostNotifications) {
      console.log("   ✅ POST_NOTIFICATIONS permission found in app.json\n");
    } else {
      console.log("   ❌ POST_NOTIFICATIONS permission MISSING from app.json!");
      console.log("   Current permissions:", permissions);
      console.log("   🔧 This is required for Android 13+ (API 33+)\n");
      process.exit(1);
    }
  } catch (error) {
    console.log("   ⚠️  Could not read app.json:", error);
  }

  // Test 4: Send a test notification
  console.log("4️⃣ Sending test notification via Expo Push API...");
  try {
    const notifResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: "🧪 Test Notification",
        body: "If you see this, Android push notifications are working!",
        data: { test: true },
      }),
    });

    const notifData = await notifResponse.json();

    if (notifResponse.ok && notifData.data?.[0]?.status === "ok") {
      console.log("   ✅ Test notification sent successfully!");
      console.log(`   Receipt ID: ${notifData.data[0].id}`);
      console.log("\n   📱 Check your device for the notification!\n");
    } else {
      console.log("   ❌ Failed to send test notification");
      console.log(`   Status: ${notifResponse.status}`);
      console.log(`   Response:`, JSON.stringify(notifData, null, 2));

      if (notifData.data?.[0]?.status === "error") {
        console.log(`\n   Error: ${notifData.data[0].message}`);
        console.log(`   Details: ${notifData.data[0].details?.error || "N/A"}\n`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.log("   ❌ Error sending test notification:", error);
    process.exit(1);
  }

  console.log("✅ All tests passed! Your Android push notification setup looks good.\n");
  console.log("📝 Next steps:");
  console.log("   1. Build a new version: eas build --platform android --profile production");
  console.log("   2. Install the new build on your device");
  console.log("   3. Test receiving notifications\n");
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("❌ Error: Missing required arguments\n");
  console.log("Usage:");
  console.log("  npx ts-node scripts/testAndroidPushNotifications.ts <expo-push-token> <store-id>\n");
  console.log("Example:");
  console.log('  npx ts-node scripts/testAndroidPushNotifications.ts "ExponentPushToken[abc123]" "2"\n');
  console.log("To get your Expo push token:");
  console.log("  1. Open your app");
  console.log("  2. Look in the device logs for 'Obtained token:' or");
  console.log("  3. Check your backend database for the latest registered token\n");
  process.exit(1);
}

const [token, storeId] = args;

testPushSetup(token, storeId).catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
