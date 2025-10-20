#!/bin/bash

# Fix iOS Simulator Connection Issues
# This script addresses common connection problems between Expo and iOS Simulator

echo "🔧 Fixing iOS Simulator Connection Issues..."

# Function to clean up processes
cleanup() {
    echo "🧹 Cleaning up existing processes..."
    pkill -f "expo start" 2>/dev/null || true
    pkill -f "metro" 2>/dev/null || true
    sleep 2
}

# Function to reset iOS Simulator
reset_simulator() {
    echo "📱 Resetting iOS Simulator..."
    xcrun simctl shutdown "iPhone 16 Pro" 2>/dev/null || true
    sleep 2
    xcrun simctl boot "iPhone 16 Pro"
    sleep 3
    open -a Simulator
}

# Function to check network connectivity
check_network() {
    echo "🌐 Checking network connectivity..."
    if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        echo "✅ Internet connection is working"
    else
        echo "❌ Internet connection issues detected"
        return 1
    fi
}

# Function to start Expo with proper configuration
start_expo() {
    echo "🚀 Starting Expo development server..."
    
    # Set environment variables
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    export REACT_NATIVE_LOG_LEVEL=debug
    
    # Clear Expo cache
    echo "🗑️ Clearing Expo cache..."
    ~/.bun/bin/bunx expo start --clear --no-dev --minify false
    
    # Wait a moment for the server to start
    sleep 5
    
    # Try to open iOS simulator
    echo "📱 Opening iOS Simulator..."
    ~/.bun/bin/bunx expo start --ios
}

# Function to monitor logs
monitor_logs() {
    echo "📊 Starting log monitoring..."
    echo "Press Ctrl+C to stop monitoring"
    
    # Monitor iOS simulator logs
    xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "GreenLoopLoyaltyOrderingAppPlatform"' --style compact &
    
    # Monitor Expo logs
    tail -f ~/.expo/logs/*.log 2>/dev/null || echo "No Expo logs found"
}

# Main execution
case "$1" in
    "clean")
        cleanup
        ;;
    "reset")
        reset_simulator
        ;;
    "network")
        check_network
        ;;
    "start")
        cleanup
        reset_simulator
        check_network
        start_expo
        ;;
    "logs")
        monitor_logs
        ;;
    "full")
        cleanup
        reset_simulator
        check_network
        start_expo &
        sleep 10
        monitor_logs
        ;;
    *)
        echo "Usage: $0 {clean|reset|network|start|logs|full}"
        echo ""
        echo "Commands:"
        echo "  clean   - Clean up existing processes"
        echo "  reset   - Reset iOS Simulator"
        echo "  network - Check network connectivity"
        echo "  start   - Start Expo with iOS (recommended)"
        echo "  logs    - Monitor logs"
        echo "  full    - Complete reset and start with monitoring"
        echo ""
        echo "Recommended sequence:"
        echo "1. ./fix-ios-connection.sh full"
        echo "2. If that doesn't work, try: ./fix-ios-connection.sh start"
        ;;
esac
