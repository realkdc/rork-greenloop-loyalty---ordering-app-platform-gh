const isVerboseLoggingEnabled =
  ((typeof __DEV__ !== 'undefined' ? __DEV__ : true) && process.env.EXPO_PUBLIC_VERBOSE_LOGS === 'true') || false;

// PERFORMANCE FIX: Disable all console logging to prevent UI freezing
// Excessive console.log calls (455+ across the app) were causing the app to freeze
// Only allow logging when explicitly enabled via EXPO_PUBLIC_VERBOSE_LOGS=true
const originalLog = console.log;
const originalWarn = console.warn;
const originalInfo = console.info;

if (!isVerboseLoggingEnabled) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  // Keep console.error for critical errors
}

type LogArgs = Parameters<typeof console.log>;

export const debugLog = (...args: LogArgs) => {
  if (!isVerboseLoggingEnabled) {
    return;
  }
  console.log(...args);
};

export const debugWarn = (...args: LogArgs) => {
  if (!isVerboseLoggingEnabled) {
    return;
  }
  console.warn(...args);
};

export const debugError = (...args: LogArgs) => {
  if (!isVerboseLoggingEnabled) {
    return;
  }
  console.error(...args);
};

export const isVerboseLogging = isVerboseLoggingEnabled;

