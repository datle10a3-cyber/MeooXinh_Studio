/**
 * Lightweight in-memory cache for API responses.
 * Each cache entry stores: data, timestamp, and a studioId scope.
 * Entries auto-expire after `ttl` ms.
 */

type CacheEntry<T = unknown> = {
  data: T;
  ts: number;
};

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL = 30_000; // 30 seconds

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > DEFAULT_TTL) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  // Prevent unbounded growth
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now - v.ts > ttl) store.delete(k);
    }
  }
  store.set(key, { data, ts: Date.now() });
}

export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}
