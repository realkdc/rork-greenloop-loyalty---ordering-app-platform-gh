#!/bin/bash

# Monitor iOS Simulator Connection
# This script helps monitor the connection between Expo and iOS Simulator

echo "📊 Monitoring iOS Simulator Connection..."

# Function to check Expo status
check_expo() {
    echo "🔍 Checking Expo server status..."
    if ps aux | grep "expo start" | grep -v grep > /dev/null; then
        echo "✅ Expo server is running"
        ps aux | grep "expo start" | grep -v grep
    else
        echo "❌ Expo server is not running"
        return 1
    fi
}

# Function to check iOS Simulator
check_simulator() {
    echo "📱 Checking iOS Simulator status..."
    if xcrun simctl list devices | grep "iPhone 16 Pro.*Booted" > /dev/null; then
        echo "✅ iPhone 16 Pro simulator is running"
    else
        echo "❌ iPhone 16 Pro simulator is not running"
        return 1
    fi
}

# Function to check network connectivity
check_network() {
    echo "🌐 Checking network connectivity..."
    if ping -c 1 localhost > /dev/null 2>&1; then
        echo "✅ Localhost is accessible"
    else
        echo "❌ Localhost is not accessible"
        return 1
    fi
}

# Function to monitor logs
monitor_logs() {
    echo "📋 Monitoring logs (Press Ctrl+C to stop)..."
    echo "Watching for connection issues..."
    
    # Monitor iOS simulator logs for connection errors
    xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "GreenLoopLoyaltyOrderingAppPlatform"' --style compact &
    LOG_PID=$!
    
    # Monitor for 30 seconds
    sleep 30
    kill $LOG_PID 2>/dev/null || true
}

# Function to restart everything
restart_all() {
    echo "🔄 Restarting everything..."
    
    # Kill Expo
    pkill -f "expo start" 2>/dev/null || true
    sleep 2
    
    # Reset simulator
    xcrun simctl shutdown "iPhone 16 Pro" 2>/dev/null || true
    sleep 2
    xcrun simctl boot "iPhone 16 Pro"
    sleep 3
    open -a Simulator
    
    # Start Expo
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    ~/.bun/bin/bunx expo start --ios --localhost --clear --dev-client &
    
    echo "✅ Restart complete"
}

# Main execution
case "$1" in
    "status")
        check_expo
        check_simulator
        check_network
        ;;
    "logs")
        monitor_logs
        ;;
    "restart")
        restart_all
        ;;
    "watch")
        while true; do
            echo "--- $(date) ---"
            check_expo
            check_simulator
            check_network
            echo ""
            sleep 10
        done
        ;;
    *)
        echo "Usage: $0 {status|logs|restart|watch}"
        echo ""
        echo "Commands:"
        echo "  status  - Check current status of all components"
        echo "  logs    - Monitor logs for 30 seconds"
        echo "  restart - Restart everything"
        echo "  watch   - Continuously monitor status"
        ;;
esac
