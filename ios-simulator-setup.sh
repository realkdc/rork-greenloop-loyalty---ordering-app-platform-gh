#!/bin/bash

# iOS Simulator Setup Script for GreenHaus Cannabis App
# This script sets up iOS simulator testing with comprehensive logging

echo "🚀 Setting up iOS Simulator for GreenHaus Cannabis App..."

# Set up environment variables for logging
export PATH="/Users/drippo/.bun/bin:$PATH"
export EXPO_DEBUG=1
export REACT_NATIVE_LOG_LEVEL=debug

# Function to start iOS simulator with logging
start_ios_simulator() {
    echo "📱 Starting iOS Simulator..."
    
    # Boot the iPhone 16 Pro simulator
    xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || echo "Simulator already running"
    
    # Open Simulator app
    open -a Simulator
    
    echo "✅ iOS Simulator started"
}

# Function to start Expo with iOS and logging
start_expo_ios() {
    echo "🔧 Starting Expo development server with iOS support and logging..."
    
    # Start Expo with iOS simulator, tunnel, and debug logging
    DEBUG=expo* bunx expo start --ios --tunnel --clear
}

# Function to monitor logs
monitor_logs() {
    echo "📊 Setting up log monitoring..."
    
    # Monitor iOS simulator logs
    echo "Monitoring iOS Simulator logs (press Ctrl+C to stop):"
    xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "GreenLoopLoyaltyOrderingAppPlatform"' --style compact
}

# Function to show available simulators
show_simulators() {
    echo "📋 Available iOS Simulators:"
    xcrun simctl list devices | grep -E "(iPhone|iPad)"
}

# Main execution
case "$1" in
    "start")
        start_ios_simulator
        start_expo_ios
        ;;
    "logs")
        monitor_logs
        ;;
    "simulators")
        show_simulators
        ;;
    "all")
        start_ios_simulator
        start_expo_ios &
        sleep 5
        monitor_logs
        ;;
    *)
        echo "Usage: $0 {start|logs|simulators|all}"
        echo ""
        echo "Commands:"
        echo "  start      - Start iOS simulator and Expo development server"
        echo "  logs       - Monitor iOS simulator logs"
        echo "  simulators - Show available iOS simulators"
        echo "  all        - Start everything and monitor logs"
        echo ""
        echo "For manual testing:"
        echo "1. Run: ./ios-simulator-setup.sh start"
        echo "2. In another terminal: ./ios-simulator-setup.sh logs"
        ;;
esac
