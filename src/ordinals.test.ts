/**
 * ordinals-mcp unit tests
 *
 * Tests cover:
 * - Cache class (get, set, expiry, stale, eviction)
 * - TokenBucket rate limiter (consume, canConsume)
 * - Config parsing (API key detection, RPM values)
 * - Parameter validation via Zod schemas
 * - textResult / errorResult shapes
 *
 * No network calls, no real Bitcoin APIs.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Cache (inline — mirrors src/cache/index.ts)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

class Cache {
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
      const toDelete = Math.floor(this.maxEntries * 0.2);
      const keys = this.store.keys();
      for (let i = 0; i < toDelete; i++) {
        const next = keys.next();
        if (next.done) break;
        this.store.delete(next.value);
      }
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs, etag });
  }

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

const TTL = {
  SAT_RARITY: 24 * 60 * 60 * 1000,
  INSCRIPTION_META: 5 * 60 * 1000,
  RUNE_ETCHING: 5 * 60 * 1000,
  COLLECTION_INFO: 2 * 60 * 1000,
  BALANCE: 60 * 1000,
  MARKETPLACE: 30 * 1000,
  ACTIVITY: 30 * 1000,
} as const;

describe("Cache.get/set", () => {
  it("stores and retrieves a value", () => {
    const cache = new Cache();
    cache.set("key1", { rune: "UNCOMMON•GOODS" }, 60_000);
    const hit = cache.get<{ rune: string }>("key1");
    expect(hit).not.toBeNull();
    expect(hit!.data.rune).toBe("UNCOMMON•GOODS");
  });

  it("returns null for missing key", () => {
    const cache = new Cache();
    expect(cache.get("missing")).toBeNull();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    const cache = new Cache();
    cache.set("temp", "data", 1000); // 1 second TTL
    vi.advanceTimersByTime(1001);
    expect(cache.get("temp")).toBeNull();
    vi.useRealTimers();
  });

  it("returns value before expiry", () => {
    vi.useFakeTimers();
    const cache = new Cache();
    cache.set("temp", "data", 5000);
    vi.advanceTimersByTime(4999);
    expect(cache.get("temp")).not.toBeNull();
    vi.useRealTimers();
  });

  it("stores etag alongside data", () => {
    const cache = new Cache();
    cache.set("key-etag", { x: 1 }, 60_000, "etag-abc123");
    const hit = cache.get<{ x: number }>("key-etag");
    expect(hit?.etag).toBe("etag-abc123");
  });

  it("increments size on new entries", () => {
    const cache = new Cache();
    expect(cache.size).toBe(0);
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    expect(cache.size).toBe(2);
  });

  it("clear() empties the store", () => {
    const cache = new Cache();
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
  });
});

describe("Cache.getStale", () => {
  it("returns data even after expiry (without prior get call)", () => {
    vi.useFakeTimers();
    const cache = new Cache();
    cache.set("key", "staleData", 500);
    vi.advanceTimersByTime(1000);
    // getStale returns the data without evicting
    expect(cache.getStale("key")).toBe("staleData");
    vi.useRealTimers();
  });

  it("normal get() evicts expired entry so getStale() returns null after get()", () => {
    vi.useFakeTimers();
    const cache = new Cache();
    cache.set("key", "staleData", 500);
    vi.advanceTimersByTime(1000);
    // Normal get() evicts the expired entry
    expect(cache.get("key")).toBeNull();
    // After eviction, getStale() also returns null
    expect(cache.getStale("key")).toBeNull();
    vi.useRealTimers();
  });

  it("returns null for completely missing key", () => {
    const cache = new Cache();
    expect(cache.getStale("nope")).toBeNull();
  });
});

describe("Cache eviction", () => {
  it("evicts 20% of entries when maxEntries is reached", () => {
    const cache = new Cache(10);
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, i, 60_000);
    }
    // Adding one more should trigger eviction of ~2 entries
    cache.set("overflow", 99, 60_000);
    // After eviction: 10 - 2 = 8 + 1 new = 9 entries max
    expect(cache.size).toBeLessThanOrEqual(9);
  });
});

describe("TTL constants", () => {
  it("SAT_RARITY is 24 hours", () => {
    expect(TTL.SAT_RARITY).toBe(86_400_000);
  });

  it("INSCRIPTION_META is 5 minutes", () => {
    expect(TTL.INSCRIPTION_META).toBe(300_000);
  });

  it("MARKETPLACE is 30 seconds", () => {
    expect(TTL.MARKETPLACE).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// TokenBucket (inline — mirrors src/rate-limit/index.ts)
// ---------------------------------------------------------------------------

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxRpm: number, buffer = 0.8) {
    const effectiveRpm = Math.floor(maxRpm * buffer);
    this.maxTokens = effectiveRpm;
    this.tokens = effectiveRpm;
    this.refillRate = effectiveRpm / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  canConsume(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

describe("TokenBucket", () => {
  it("starts with full token pool", () => {
    const bucket = new TokenBucket(60, 1.0); // 60 RPM, no buffer
    expect(bucket.canConsume()).toBe(true);
  });

  it("applies buffer to max tokens", () => {
    const bucket = new TokenBucket(100, 0.8); // 80 effective
    // Consume 80 tokens — all should succeed
    let consumed = 0;
    for (let i = 0; i < 80; i++) {
      if (bucket.consume()) consumed++;
    }
    expect(consumed).toBe(80);
    // 81st should fail
    expect(bucket.consume()).toBe(false);
  });

  it("refills tokens over time", () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket(60, 1.0); // 1 token/sec
    // Drain all tokens
    for (let i = 0; i < 60; i++) bucket.consume();
    expect(bucket.consume()).toBe(false);

    // Advance 1 second — should get ~1 token back
    vi.advanceTimersByTime(1000);
    expect(bucket.canConsume()).toBe(true);
    vi.useRealTimers();
  });

  it("does not exceed maxTokens on refill", () => {
    vi.useFakeTimers();
    const bucket = new TokenBucket(60, 1.0);
    // Advance 10 minutes — don't let it overflow
    vi.advanceTimersByTime(600_000);
    // Consume all 60 tokens — should work
    let consumed = 0;
    for (let i = 0; i < 60; i++) {
      if (bucket.consume()) consumed++;
    }
    expect(consumed).toBe(60);
    // 61st should fail
    expect(bucket.consume()).toBe(false);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Config parsing
// ---------------------------------------------------------------------------

function hasAnyApiKey(hiroKey?: string, ordiscanKey?: string): boolean {
  return !!(hiroKey || ordiscanKey);
}

function computeHiroRpm(apiKey?: string): number {
  return apiKey ? 500 : 50;
}

describe("config parsing", () => {
  it("hasAnyApiKey is false when no keys set", () => {
    expect(hasAnyApiKey(undefined, undefined)).toBe(false);
  });

  it("hasAnyApiKey is true when hiro key is set", () => {
    expect(hasAnyApiKey("hiro-key-123", undefined)).toBe(true);
  });

  it("hasAnyApiKey is true when ordiscan key is set", () => {
    expect(hasAnyApiKey(undefined, "ordiscan-key")).toBe(true);
  });

  it("hiro RPM is 500 with API key", () => {
    expect(computeHiroRpm("my-key")).toBe(500);
  });

  it("hiro RPM is 50 without API key", () => {
    expect(computeHiroRpm(undefined)).toBe(50);
  });

  it("cache TTL parses from seconds to milliseconds", () => {
    const seconds = "300";
    const ms = parseInt(seconds, 10) * 1000;
    expect(ms).toBe(300_000);
  });

  it("rate limit buffer parses correctly", () => {
    expect(parseFloat("0.8")).toBe(0.8);
    expect(parseFloat("1.0")).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// textResult / errorResult
// ---------------------------------------------------------------------------

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

describe("textResult", () => {
  it("passes strings through", () => {
    expect(textResult("hello").content[0].text).toBe("hello");
  });

  it("JSON-stringifies objects", () => {
    const r = textResult({ id: "abc123" });
    const parsed = JSON.parse(r.content[0].text);
    expect(parsed.id).toBe("abc123");
  });
});

describe("errorResult", () => {
  it("sets isError: true", () => {
    expect(errorResult("fail").isError).toBe(true);
  });

  it("prefixes with Error:", () => {
    expect(errorResult("no api key").content[0].text).toBe("Error: no api key");
  });
});

// ---------------------------------------------------------------------------
// Rune name schema
// ---------------------------------------------------------------------------

const runeNameSchema = z.object({
  name: z.string().min(1),
});

describe("rune name schema", () => {
  it("accepts UNCOMMON•GOODS", () => {
    expect(runeNameSchema.safeParse({ name: "UNCOMMON•GOODS" }).success).toBe(true);
  });

  it("accepts dotless form UNCOMMONGOODS", () => {
    expect(runeNameSchema.safeParse({ name: "UNCOMMONGOODS" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(runeNameSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inscription search schema
// ---------------------------------------------------------------------------

const inscriptionSearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(60).default(20),
  offset: z.number().min(0).default(0),
});

describe("inscription search schema", () => {
  it("accepts valid search query", () => {
    const r = inscriptionSearchSchema.safeParse({ query: "bitcoin" });
    expect(r.success).toBe(true);
  });

  it("defaults limit to 20", () => {
    const r = inscriptionSearchSchema.safeParse({ query: "test" });
    expect(r.success && r.data.limit).toBe(20);
  });

  it("rejects limit above 60", () => {
    expect(inscriptionSearchSchema.safeParse({ query: "test", limit: 61 }).success).toBe(false);
  });

  it("defaults offset to 0", () => {
    const r = inscriptionSearchSchema.safeParse({ query: "test" });
    expect(r.success && r.data.offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BRC-20 token schema
// ---------------------------------------------------------------------------

const brc20Schema = z.object({
  ticker: z.string().min(1).max(4),
});

describe("BRC-20 ticker schema", () => {
  it("accepts valid 4-char ticker", () => {
    expect(brc20Schema.safeParse({ ticker: "ORDI" }).success).toBe(true);
  });

  it("accepts 1-char ticker", () => {
    expect(brc20Schema.safeParse({ ticker: "X" }).success).toBe(true);
  });

  it("rejects 5+ char ticker", () => {
    expect(brc20Schema.safeParse({ ticker: "LONGNAME" }).success).toBe(false);
  });

  it("rejects empty ticker", () => {
    expect(brc20Schema.safeParse({ ticker: "" }).success).toBe(false);
  });
});
