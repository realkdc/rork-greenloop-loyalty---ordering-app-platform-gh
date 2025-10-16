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
    console.log('[cartBadge] 🔄 set called with:', n, 'type:', typeof n);
    if (n === null) {
      console.log('[cartBadge] ⏭️ Ignoring null value');
      return;
    }
    if (Number.isNaN(n)) {
      console.log('[cartBadge] ⏭️ Ignoring NaN value');
      return;
    }
    const v = Math.max(0, Math.min(999, n));
    if (v === this.lastShown) {
      console.log('[cartBadge] ⏭️ Value unchanged, skipping update');
      return;
    }
    
    console.log('[cartBadge] ✅ Updating from', this.lastShown, 'to', v, '- notifying', this.listeners.length, 'listeners');
    this.lastShown = v;
    this.listeners.forEach((cb, index) => {
      console.log(`[cartBadge] 📢 Calling listener ${index + 1}/${this.listeners.length} with value:`, v);
      cb(v);
    });
  }

  on(cb: Listener) {
    console.log('[cartBadge] 👂 New listener registered, immediately calling with current value:', this.lastShown);
    this.listeners.push(cb);
    cb(this.lastShown);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx > -1) this.listeners.splice(idx, 1);
      console.log('[cartBadge] 👋 Listener unregistered, remaining listeners:', this.listeners.length);
    };
  }

  get() {
    return this.lastShown;
  }
}

export const cartBadge = new CartBadgeManager();
