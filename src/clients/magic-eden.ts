import { config } from "../config.js";
import { cache, TTL } from "../cache/index.js";
import { getRateLimiter } from "../rate-limit/index.js";

const limiter = getRateLimiter("magiceden", config.magicEden.maxRpm, config.rateLimitBuffer);

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (config.magicEden.key) h["Authorization"] = `Bearer ${config.magicEden.key}`;
  return h;
}

export class MagicEdenApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`Magic Eden API ${status}: ${message}`);
    this.name = "MagicEdenApiError";
  }
}

async function request<T>(path: string, cacheKey: string, ttl: number): Promise<T> {
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached.data;

  await limiter.wait();

  const url = `${config.magicEden.baseUrl}${path}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    if (res.status === 429) {
      const stale = cache.getStale<T>(cacheKey);
      if (stale) return stale;
      throw new MagicEdenApiError(429, "Rate limited");
    }
    const body = await res.text().catch(() => "");
    throw new MagicEdenApiError(res.status, body || res.statusText);
  }

  const data = (await res.json()) as T;
  cache.set(cacheKey, data, ttl);
  return data;
}

// --- Collection Listings ---

export interface MeListing {
  id: string;
  token_id: string;
  inscription_id: string;
  price: number; // in BTC
  seller: string;
  collection_symbol: string;
  listed_at: string;
}

export async function getCollectionListings(
  collectionSymbol: string,
  offset = 0,
  limit = 20,
): Promise<MeListing[]> {
  return request<MeListing[]>(
    `/v2/ord/btc/tokens?collectionSymbol=${encodeURIComponent(collectionSymbol)}&offset=${offset}&limit=${limit}&listed=true`,
    `me:listings:${collectionSymbol}:${offset}:${limit}`,
    TTL.MARKETPLACE,
  );
}

// --- Collection Stats ---

export interface MeCollectionStats {
  symbol: string;
  floorPrice: number;
  totalListed: number;
  totalVolume: number;
  owners: number;
  supply: number;
}

export async function getCollectionStats(collectionSymbol: string): Promise<MeCollectionStats> {
  return request<MeCollectionStats>(
    `/v2/ord/btc/stat?collectionSymbol=${encodeURIComponent(collectionSymbol)}`,
    `me:stats:${collectionSymbol}`,
    TTL.MARKETPLACE,
  );
}

// --- Collection Activities ---

export interface MeActivity {
  kind: string; // "buying_broadcasted", "list", "delist", etc.
  token_inscription_id: string;
  collection_symbol: string;
  seller_address: string;
  buyer_address?: string;
  price: number;
  created_at: string;
  tx_id?: string;
}

export async function getCollectionActivities(
  collectionSymbol: string,
  offset = 0,
  limit = 20,
): Promise<MeActivity[]> {
  return request<MeActivity[]>(
    `/v2/ord/btc/activities?collectionSymbol=${encodeURIComponent(collectionSymbol)}&offset=${offset}&limit=${limit}`,
    `me:activity:${collectionSymbol}:${offset}:${limit}`,
    TTL.ACTIVITY,
  );
}
