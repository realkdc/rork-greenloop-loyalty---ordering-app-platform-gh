#!/bin/bash

echo "================================================"
echo "Android Push Notification Debug Logger"
echo "================================================"
echo ""
echo "This script will watch for:"
echo "  - Push token registration"
echo "  - Notification delivery"
echo "  - Firebase/FCM messages"
echo "  - Expo notification events"
echo ""
echo "Keep this running and:"
echo "  1. Open the GreenHaus app"
echo "  2. Send a test notification"
echo "  3. Watch for logs below"
echo ""
echo "================================================"
echo ""

# Clear old logs
adb logcat -c

# Watch for relevant logs
adb logcat | grep --line-buffered -E "registerPushToken|ExponentPushToken|Notifications|FCM|firebase|expo.modules.notifications|GCM|GreenHaus" | while read line; do
    echo "[$(date +%H:%M:%S)] $line"
done
