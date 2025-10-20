#!/bin/bash

# Alternative iOS Setup for SDK 53
# This approach uses localhost instead of tunnel for better reliability

echo "🔄 Alternative iOS Setup for SDK 53..."

# Set environment variables
export PATH="/Users/drippo/.bun/bin:$PATH"
export EXPO_DEBUG=1
export REACT_NATIVE_LOG_LEVEL=debug

# Function to start with localhost
start_localhost() {
    echo "🏠 Starting Expo with localhost (no tunnel)..."
    
    # Kill any existing processes
    pkill -f "expo start" 2>/dev/null || true
    
    # Start Expo on localhost
    ~/.bun/bin/bunx expo start --ios --localhost --clear
}

# Function to start with LAN
start_lan() {
    echo "🌐 Starting Expo with LAN connection..."
    
    # Kill any existing processes
    pkill -f "expo start" 2>/dev/null || true
    
    # Start Expo with LAN
    ~/.bun/bin/bunx expo start --ios --lan --clear
}

# Function to start with tunnel (original approach)
start_tunnel() {
    echo "🚇 Starting Expo with tunnel..."
    
    # Kill any existing processes
    pkill -f "expo start" 2>/dev/null || true
    
    # Start Expo with tunnel
    ~/.bun/bin/bunx expo start --ios --tunnel --clear
}

# Function to check what's running
check_status() {
    echo "📊 Current status:"
    echo "Expo processes:"
    ps aux | grep expo | grep -v grep || echo "No Expo processes running"
    echo ""
    echo "iOS Simulator status:"
    xcrun simctl list devices | grep "iPhone 16 Pro"
    echo ""
    echo "Network interfaces:"
    ifconfig | grep "inet " | grep -v 127.0.0.1
}

# Main execution
case "$1" in
    "localhost")
        start_localhost
        ;;
    "lan")
        start_lan
        ;;
    "tunnel")
        start_tunnel
        ;;
    "status")
        check_status
        ;;
    "try-all")
        echo "🔄 Trying localhost first..."
        start_localhost &
        sleep 10
        if ! ps aux | grep expo | grep -v grep > /dev/null; then
            echo "❌ Localhost failed, trying LAN..."
            pkill -f expo
            start_lan &
            sleep 10
            if ! ps aux | grep expo | grep -v grep > /dev/null; then
                echo "❌ LAN failed, trying tunnel..."
                pkill -f expo
                start_tunnel
            fi
        fi
        ;;
    *)
        echo "Usage: $0 {localhost|lan|tunnel|status|try-all}"
        echo ""
        echo "Commands:"
        echo "  localhost - Start with localhost (recommended for local development)"
        echo "  lan       - Start with LAN connection"
        echo "  tunnel    - Start with tunnel (original approach)"
        echo "  status    - Check current status"
        echo "  try-all   - Try all methods until one works"
        echo ""
        echo "For SDK 53, try: ./alternative-ios-setup.sh localhost"
        ;;
esac
