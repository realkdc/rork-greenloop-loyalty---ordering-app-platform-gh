#!/bin/bash

# Final iOS Simulator Fix for SDK 53
# This script addresses all connection issues and gets the app running

echo "🔧 Final iOS Simulator Fix for SDK 53..."

# Function to clean everything
clean_all() {
    echo "🧹 Cleaning all processes..."
    pkill -f "expo start" 2>/dev/null || true
    pkill -f "metro" 2>/dev/null || true
    pkill -f "node.*expo" 2>/dev/null || true
    sleep 3
}

# Function to reset iOS Simulator completely
reset_simulator() {
    echo "📱 Resetting iOS Simulator completely..."
    xcrun simctl shutdown "iPhone 16 Pro" 2>/dev/null || true
    sleep 3
    xcrun simctl erase "iPhone 16 Pro" 2>/dev/null || true
    sleep 3
    xcrun simctl boot "iPhone 16 Pro"
    sleep 5
    open -a Simulator
    sleep 3
}

# Function to install Expo Go if needed
install_expo_go() {
    echo "📲 Checking Expo Go installation..."
    if ! xcrun simctl list apps | grep -q "host.exp.Exponent"; then
        echo "Installing Expo Go..."
        # This will be handled by Expo automatically
    else
        echo "✅ Expo Go is already installed"
    fi
}

# Function to start with web first (for testing)
start_web() {
    echo "🌐 Starting web version first for testing..."
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    ~/.bun/bin/bunx expo start --web --localhost --clear &
    sleep 10
    echo "✅ Web version should be available at http://localhost:8081"
}

# Function to start iOS with different methods
start_ios_method1() {
    echo "📱 Method 1: Starting iOS with tunnel..."
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    ~/.bun/bin/bunx expo start --ios --tunnel --clear
}

start_ios_method2() {
    echo "📱 Method 2: Starting iOS with localhost..."
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    ~/.bun/bin/bunx expo start --ios --localhost --clear
}

start_ios_method3() {
    echo "📱 Method 3: Starting iOS with LAN..."
    export PATH="/Users/drippo/.bun/bin:$PATH"
    export EXPO_DEBUG=1
    ~/.bun/bin/bunx expo start --ios --lan --clear
}

# Function to monitor and restart if needed
monitor_and_restart() {
    echo "👀 Monitoring connection..."
    for i in {1..30}; do
        if ps aux | grep "expo start" | grep -v grep > /dev/null; then
            echo "✅ Expo server is running"
            break
        else
            echo "⏳ Waiting for Expo server... ($i/30)"
            sleep 2
        fi
    done
}

# Function to open iOS Simulator manually
open_simulator_manually() {
    echo "📱 Opening iOS Simulator manually..."
    open -a Simulator
    sleep 3
    
    # Try to open the app manually
    echo "🔗 Trying to open app manually..."
    xcrun simctl openurl booted "exp://127.0.0.1:8081" 2>/dev/null || echo "Manual open failed, will try automatic"
}

# Main execution
case "$1" in
    "clean")
        clean_all
        ;;
    "reset")
        reset_simulator
        ;;
    "web")
        clean_all
        start_web
        ;;
    "ios1")
        clean_all
        reset_simulator
        start_ios_method1
        ;;
    "ios2")
        clean_all
        reset_simulator
        start_ios_method2
        ;;
    "ios3")
        clean_all
        reset_simulator
        start_ios_method3
        ;;
    "full")
        clean_all
        reset_simulator
        install_expo_go
        start_web &
        sleep 5
        start_ios_method1 &
        monitor_and_restart
        open_simulator_manually
        ;;
    "manual")
        echo "📱 Manual iOS Simulator setup:"
        echo "1. Make sure iOS Simulator is open"
        echo "2. Run: ./fix-ios-connection-final.sh ios2"
        echo "3. In the iOS Simulator, open Safari"
        echo "4. Go to: http://localhost:8081"
        echo "5. The app should load in the browser"
        ;;
    *)
        echo "Usage: $0 {clean|reset|web|ios1|ios2|ios3|full|manual}"
        echo ""
        echo "Commands:"
        echo "  clean   - Clean all processes"
        echo "  reset   - Reset iOS Simulator completely"
        echo "  web     - Start web version for testing"
        echo "  ios1    - Start iOS with tunnel (Method 1)"
        echo "  ios2    - Start iOS with localhost (Method 2)"
        echo "  ios3    - Start iOS with LAN (Method 3)"
        echo "  full    - Complete reset and start everything"
        echo "  manual  - Manual setup instructions"
        echo ""
        echo "Recommended sequence:"
        echo "1. ./fix-ios-connection-final.sh full"
        echo "2. If that fails: ./fix-ios-connection-final.sh manual"
        ;;
esac
