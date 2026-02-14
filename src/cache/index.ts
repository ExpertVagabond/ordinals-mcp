interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): { data: T; etag?: string } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { data: entry.data, etag: entry.etag };
  }

  set<T>(key: string, data: T, ttlMs: number, etag?: string): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest entries
      const toDelete = Math.floor(this.maxEntries * 0.2);
      const keys = this.store.keys();
      for (let i = 0; i < toDelete; i++) {
        const next = keys.next();
        if (next.done) break;
        this.store.delete(next.value);
      }
    }
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      etag,
    });
  }

  /** Get stale data if available (for fallback when APIs are rate-limited) */
  getStale<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    return entry?.data ?? null;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new Cache();

// TTL presets (milliseconds)
export const TTL = {
  SAT_RARITY: 24 * 60 * 60 * 1000,   // 24h — never changes
  INSCRIPTION_META: 5 * 60 * 1000,     // 5min — rarely changes
  RUNE_ETCHING: 5 * 60 * 1000,         // 5min — static after creation
  COLLECTION_INFO: 2 * 60 * 1000,      // 2min — prices change
  BALANCE: 60 * 1000,                   // 1min — active trading
  MARKETPLACE: 30 * 1000,              // 30s — volatile
  ACTIVITY: 30 * 1000,                 // 30s — real-time
} as const;
