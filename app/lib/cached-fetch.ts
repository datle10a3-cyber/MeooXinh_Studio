"use client";

/**
 * Client-side data fetcher with deduplication, caching, and revalidation.
 * Prevents duplicate in-flight requests and caches responses.
 */

type FetchEntry<T = unknown> = {
  data: T;
  ts: number;
  promise?: Promise<T>;
};

const cache = new Map<string, FetchEntry>();
const STALE_TIME = 30_000; // 30s — serve cached data, revalidate in background
const DEDUPE_TIME = 2_000; // 2s — deduplicate rapid identical requests

export type FetchOptions = {
  /** Time in ms before cached data is considered stale. Default 30s */
  staleTime?: number;
  /** If true, always fetch fresh data (but still deduplicate in-flight) */
  force?: boolean;
};

export async function cachedFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const staleTime = options.staleTime ?? STALE_TIME;
  const now = Date.now();
  const entry = cache.get(url);

  // Return cached data if fresh
  if (!options.force && entry && now - entry.ts < staleTime) {
    return entry.data as T;
  }

  // Deduplicate in-flight requests
  if (entry?.promise && now - entry.ts < DEDUPE_TIME) {
    return entry.promise as Promise<T>;
  }

  // Create new request
  const promise = fetch(url)
    .then(async (res) => {
      const json = await res.json();
      const data = json.data ?? json;
      cache.set(url, { data, ts: Date.now() });
      return data as T;
    })
    .catch((err) => {
      // On error, keep stale data if available
      if (entry) return entry.data as T;
      throw err;
    });

  cache.set(url, { data: entry?.data, ts: now, promise } as FetchEntry);
  return promise;
}

export function invalidateCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
}
