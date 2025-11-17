/**
 * Shared debouncing for START_ORDER_CLICK events across all tabs
 * Prevents duplicate events when navigating between tabs after clicking checkout
 */

let lastStartOrderTime = 0;
const DEBOUNCE_MS = 2000; // 2 seconds

export function shouldTrackStartOrder(): boolean {
  const now = Date.now();
  if (now - lastStartOrderTime < DEBOUNCE_MS) {
    return false;
  }
  lastStartOrderTime = now;
  return true;
}
