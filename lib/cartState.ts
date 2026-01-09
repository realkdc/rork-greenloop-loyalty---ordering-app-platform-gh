import AsyncStorage from '@react-native-async-storage/async-storage';

type StorageBucket = Record<string, string>;

export interface CartStorageSnapshot {
  session?: StorageBucket;
  local?: StorageBucket;
  cookies?: StorageBucket;
}

interface PersistedSnapshot {
  session: StorageBucket;
  local: StorageBucket;
  cookies: StorageBucket;
  updatedAt: number;
  signature: string;
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - persist cart across app restarts
const STORAGE_KEY = '@greenloop_cart_state_snapshot_v1';

let snapshot: PersistedSnapshot | null = null;
let hydrationPromise: Promise<PersistedSnapshot | null> | null = null;
let hydrationComplete = false;
const hydrationListeners = new Set<(ready: boolean) => void>();

const cloneBucket = (bucket?: StorageBucket): StorageBucket => {
  if (!bucket) return {};
  return Object.keys(bucket).reduce<StorageBucket>((acc, key) => {
    const value = bucket[key];
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const serializeBucket = (bucket?: StorageBucket) => {
  if (!bucket) return '';
  return Object.keys(bucket)
    .sort()
    .map((key) => `${key}=${bucket[key]}`)
    .join('|');
};

const createSignature = (payload?: CartStorageSnapshot | PersistedSnapshot | null) => {
  if (!payload) return '';
  return [
    serializeBucket(payload.session),
    serializeBucket(payload.local),
    serializeBucket(payload.cookies),
  ].join('||');
};

const buildCookieHeader = (cookies?: StorageBucket) => {
  if (!cookies) return undefined;
  const parts = Object.entries(cookies)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => `${key}=${value}`);
  return parts.length ? parts.join('; ') : undefined;
};

const notifyHydrated = () => {
  hydrationComplete = true;
  hydrationListeners.forEach((listener) => {
    try {
      listener(true);
    } catch (error) {
      console.warn('[cartState] Hydration listener failed', error);
    }
  });
  hydrationListeners.clear();
};

const persistSnapshot = async (value: PersistedSnapshot | null) => {
  try {
    if (!value) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('[cartState] Failed to persist snapshot', error);
  }
};

export const cartState = {
  save(next?: CartStorageSnapshot | null) {
    if (!next) return;
    const hasSession = next.session && Object.keys(next.session).length > 0;
    const hasLocal = next.local && Object.keys(next.local).length > 0;
    const hasCookies = next.cookies && Object.keys(next.cookies).length > 0;
    if (!hasSession && !hasLocal && !hasCookies) {
      return;
    }
    const signature = createSignature(next);
    if (snapshot && snapshot.signature === signature) {
      snapshot.updatedAt = Date.now();
      return;
    }
    snapshot = {
      session: cloneBucket(next.session),
      local: cloneBucket(next.local),
      cookies: cloneBucket(next.cookies),
      updatedAt: Date.now(),
      signature,
    };
    persistSnapshot(snapshot);
    notifyHydrated();
  },

  clear() {
    snapshot = null;
    persistSnapshot(null);
    notifyHydrated();
  },

  get(): PersistedSnapshot | null {
    if (!snapshot) return null;
    if (Date.now() - snapshot.updatedAt > MAX_AGE_MS) {
      snapshot = null;
      return null;
    }
    if (!snapshot.signature) {
      snapshot.signature = createSignature(snapshot);
    }
    return snapshot;
  },

  async hydrateFromStorage(): Promise<PersistedSnapshot | null> {
    if (hydrationComplete) {
      return snapshot;
    }
    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (!stored) {
            return null;
          }
          const parsed = JSON.parse(stored);
          if (!parsed || typeof parsed !== 'object') {
            return null;
          }
          snapshot = {
            session: cloneBucket(parsed.session),
            local: cloneBucket(parsed.local),
            cookies: cloneBucket(parsed.cookies),
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
            signature: typeof parsed.signature === 'string' ? parsed.signature : createSignature(parsed),
          };
          return snapshot;
        } catch (error) {
          console.warn('[cartState] Failed to hydrate snapshot', error);
          return null;
        }
      })().finally(() => {
        hydrationPromise = null;
        notifyHydrated();
      });
    }
    return hydrationPromise;
  },

  onHydrated(listener: (ready: boolean) => void) {
    if (hydrationComplete) {
      listener(true);
      return () => {};
    }
    hydrationListeners.add(listener);
    return () => {
      hydrationListeners.delete(listener);
    };
  },

  isHydrated() {
    return hydrationComplete;
  },
};

export const getCartCookieHeader = () => {
  const current = cartState.get();
  return buildCookieHeader(current?.cookies);
};

