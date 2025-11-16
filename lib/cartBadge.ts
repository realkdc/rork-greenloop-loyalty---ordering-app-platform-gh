import { debugLog } from '@/lib/logger';

export type CartCountMsg = { 
  type: 'CART_COUNT'; 
  value: number | null; 
  source?: string;
};

type Listener = (n: number) => void;

class CartBadgeManager {
  private listeners: Listener[] = [];
  public lastShown = 0;

  set(n: number | null) {
    debugLog('[cartBadge] 🔄 set called with:', n, 'type:', typeof n);
    if (n === null) {
      debugLog('[cartBadge] ⏭️ Ignoring null value');
      return;
    }
    if (Number.isNaN(n)) {
      debugLog('[cartBadge] ⏭️ Ignoring NaN value');
      return;
    }
    const v = Math.max(0, Math.min(999, n));
    if (v === this.lastShown) {
      debugLog('[cartBadge] ⏭️ Value unchanged, skipping update');
      return;
    }
    
    debugLog('[cartBadge] ✅ Updating from', this.lastShown, 'to', v, '- notifying', this.listeners.length, 'listeners');
    this.lastShown = v;
    this.listeners.forEach((cb, index) => {
      debugLog(`[cartBadge] 📢 Calling listener ${index + 1}/${this.listeners.length} with value:`, v);
      cb(v);
    });
  }

  on(cb: Listener) {
    debugLog('[cartBadge] 👂 New listener registered, immediately calling with current value:', this.lastShown);
    this.listeners.push(cb);
    cb(this.lastShown);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx > -1) this.listeners.splice(idx, 1);
      debugLog('[cartBadge] 👋 Listener unregistered, remaining listeners:', this.listeners.length);
    };
  }

  get() {
    return this.lastShown;
  }
}

export const cartBadge = new CartBadgeManager();
