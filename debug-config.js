// Debug Configuration for iOS Simulator Testing
// This file contains logging and debugging configurations

const debugConfig = {
  // Enable all debug logging
  expo: {
    debug: true,
    logLevel: 'debug'
  },
  
  // React Native debugging
  reactNative: {
    logLevel: 'debug',
    enableFlipper: true,
    enableHermes: true
  },
  
  // Metro bundler debugging
  metro: {
    verbose: true,
    resetCache: true
  },
  
  // iOS Simulator specific settings
  ios: {
    enableLogging: true,
    enablePerformanceMonitoring: true,
    enableCrashReporting: true
  },
  
  // App-specific debugging
  app: {
    enableWebViewDebugging: true,
    enableNetworkLogging: true,
    enableLocationLogging: true,
    enableCameraLogging: true
  }
};

// Export for use in development
module.exports = debugConfig;

// Console logging setup
if (typeof console !== 'undefined') {
  // Override console methods for better debugging
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = (...args) => {
    originalLog(`[${new Date().toISOString()}] [LOG]`, ...args);
  };
  
  console.error = (...args) => {
    originalError(`[${new Date().toISOString()}] [ERROR]`, ...args);
  };
  
  console.warn = (...args) => {
    originalWarn(`[${new Date().toISOString()}] [WARN]`, ...args);
  };
}
