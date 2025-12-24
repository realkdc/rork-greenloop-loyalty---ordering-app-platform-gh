#!/bin/bash

# Cleanup script to free up disk space
# This removes build artifacts and dependencies that can be regenerated

echo "🧹 Starting cleanup..."

# Remove node_modules (can be reinstalled with npm install)
if [ -d "node_modules" ]; then
    echo "Removing node_modules (792M)..."
    rm -rf node_modules
    echo "✅ Removed node_modules"
fi

# Remove Android build artifacts
if [ -d "android/app/build" ]; then
    echo "Removing android/app/build (312M)..."
    rm -rf android/app/build
    echo "✅ Removed android/app/build"
fi

if [ -d "android/build" ]; then
    echo "Removing android/build..."
    rm -rf android/build
    echo "✅ Removed android/build"
fi

# Remove iOS Pods (can be reinstalled with pod install)
if [ -d "ios/Pods" ]; then
    echo "Removing ios/Pods (253M)..."
    rm -rf ios/Pods
    echo "✅ Removed ios/Pods"
fi

# Remove iOS build artifacts
if [ -d "ios/build" ]; then
    echo "Removing ios/build..."
    rm -rf ios/build
    echo "✅ Removed ios/build"
fi

# Remove iOS DerivedData
if [ -d "ios/DerivedData" ]; then
    echo "Removing ios/DerivedData..."
    rm -rf ios/DerivedData
    echo "✅ Removed ios/DerivedData"
fi

# Remove Android Gradle cache (optional, but can be large)
if [ -d "android/.gradle" ]; then
    echo "Removing android/.gradle cache..."
    rm -rf android/.gradle
    echo "✅ Removed android/.gradle"
fi

# Remove Expo cache
if [ -d ".expo" ]; then
    echo "Removing .expo cache..."
    rm -rf .expo
    echo "✅ Removed .expo"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "To restore dependencies:"
echo "  - npm install (or bun install)"
echo "  - cd ios && pod install && cd .."
echo ""
echo "Build artifacts will be regenerated when you build the app."

