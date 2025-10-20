# iOS Simulator Testing Guide for GreenHaus Cannabis App

This guide explains how to set up and test the GreenHaus Cannabis app in the iOS Simulator with comprehensive logging.

## Prerequisites

- macOS with Xcode installed
- iOS Simulator available
- Bun package manager installed
- Expo CLI installed

## Quick Start

### 1. Start iOS Simulator and Expo Development Server

```bash
# Start everything with logging
./ios-simulator-setup.sh all

# Or start step by step
./ios-simulator-setup.sh start
```

### 2. Monitor Logs

In a separate terminal:

```bash
# Monitor iOS simulator logs
./ios-simulator-setup.sh logs

# Or use the direct command
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "GreenLoopLoyaltyOrderingAppPlatform"' --style compact
```

## Manual Setup (Alternative)

### 1. Start iOS Simulator

```bash
# Boot iPhone 16 Pro simulator
xcrun simctl boot "iPhone 16 Pro"

# Open Simulator app
open -a Simulator
```

### 2. Start Expo Development Server

```bash
# Set environment variables for debugging
export PATH="/Users/drippo/.bun/bin:$PATH"
export EXPO_DEBUG=1
export REACT_NATIVE_LOG_LEVEL=debug

# Start Expo with iOS support and logging
DEBUG=expo* bunx expo start --ios --tunnel --clear
```

### 3. Monitor Logs

```bash
# Monitor app-specific logs
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "GreenLoopLoyaltyOrderingAppPlatform"' --style compact

# Monitor all iOS logs
xcrun simctl spawn booted log stream --style compact

# Monitor Expo logs
DEBUG=expo* bunx expo start --ios --tunnel
```

## Available Simulators

To see all available iOS simulators:

```bash
./ios-simulator-setup.sh simulators
# or
xcrun simctl list devices
```

## Debugging Features

### 1. App-Specific Logging

The app includes comprehensive logging for:
- WebView interactions
- Network requests
- Location services
- Camera functionality
- Authentication flows
- Cart operations

### 2. Expo Debug Logging

- Metro bundler logs
- JavaScript runtime logs
- Native module logs
- Performance metrics

### 3. iOS Simulator Logs

- System logs
- App crash logs
- Performance logs
- Network logs

## Troubleshooting

### Common Issues

1. **Simulator not starting**: Make sure Xcode is installed and simulators are available
2. **Expo not connecting**: Check tunnel connection and firewall settings
3. **App not loading**: Check Metro bundler logs and clear cache
4. **Logs not showing**: Ensure debug environment variables are set

### Debug Commands

```bash
# Clear Expo cache
bunx expo start --clear

# Reset iOS simulator
xcrun simctl erase all

# Check Expo installation
bunx expo --version

# Check Bun installation
bun --version
```

## Log Analysis

### Key Log Patterns to Watch

1. **App Launch**: Look for bundle loading and initialization logs
2. **Authentication**: Monitor auth flow and token management
3. **WebView**: Check WebView loading and JavaScript execution
4. **Network**: Monitor API calls and responses
5. **Location**: Track location permission and updates
6. **Camera**: Monitor camera permission and QR scanning

### Log Levels

- `LOG`: General information
- `ERROR`: Error conditions
- `WARN`: Warning conditions
- `DEBUG`: Debug information
- `VERBOSE`: Verbose logging

## Performance Monitoring

The setup includes performance monitoring for:
- App launch time
- Memory usage
- Network performance
- JavaScript execution time
- Native module performance

## Testing Checklist

- [ ] App launches successfully
- [ ] Authentication flow works
- [ ] WebView loads correctly
- [ ] Location services work
- [ ] Camera/QR scanner functions
- [ ] Network requests complete
- [ ] Cart operations work
- [ ] Navigation flows properly
- [ ] No crashes or errors
- [ ] Performance is acceptable

## Support

If you encounter issues:

1. Check the logs for error messages
2. Verify all dependencies are installed
3. Ensure iOS Simulator is properly configured
4. Check Expo development server status
5. Review network connectivity

For additional help, refer to:
- [Expo Documentation](https://docs.expo.dev/)
- [React Native iOS Setup](https://reactnative.dev/docs/environment-setup)
- [iOS Simulator Documentation](https://developer.apple.com/documentation/xcode/running-your-app-in-the-simulator)
