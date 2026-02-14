import { config } from "../config.js";
import { cache, TTL } from "../cache/index.js";
import { getRateLimiter } from "../rate-limit/index.js";

const limiter = getRateLimiter("ordiscan", config.ordiscan.maxRpm, config.rateLimitBuffer);

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (config.ordiscan.key) h["Authorization"] = `Bearer ${config.ordiscan.key}`;
  return h;
}

export class OrdiscanApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`Ordiscan API ${status}: ${message}`);
    this.name = "OrdiscanApiError";
  }
}

async function request<T>(path: string, cacheKey: string, ttl: number): Promise<T> {
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached.data;

  await limiter.wait();

  const url = `${config.ordiscan.baseUrl}${path}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    if (res.status === 429) {
      const stale = cache.getStale<T>(cacheKey);
      if (stale) return stale;
      throw new OrdiscanApiError(429, "Rate limited");
    }
    const body = await res.text().catch(() => "");
    throw new OrdiscanApiError(res.status, body || res.statusText);
  }

  const data = (await res.json()) as T;
  cache.set(cacheKey, data, ttl);
  return data;
}

// --- Inscriptions ---

export interface OrdiscanInscription {
  inscription_id: string;
  inscription_number: number;
  content_type: string;
  owner_address: string;
  owner_output: string;
  sat: number;
  rarity: string;
  genesis_transaction: string;
  genesis_block: number;
  genesis_timestamp: string;
  collection_slug?: string;
}

export async function getInscription(id: string): Promise<OrdiscanInscription> {
  return request<OrdiscanInscription>(
    `/v1/inscription/${encodeURIComponent(id)}`,
    `ordiscan:inscription:${id}`,
    TTL.INSCRIPTION_META,
  );
}

export async function getAddressInscriptions(
  address: string,
  offset = 0,
  limit = 20,
): Promise<OrdiscanInscription[]> {
  return request<OrdiscanInscription[]>(
    `/v1/address/${encodeURIComponent(address)}/inscriptions?offset=${offset}&limit=${limit}`,
    `ordiscan:addrinsc:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

// --- Rare Sats ---

export interface RareSatBalance {
  sat: number;
  rarity: string;
  output: string;
  offset: number;
  name?: string;
}

export async function getAddressRareSats(
  address: string,
  offset = 0,
  limit = 20,
): Promise<RareSatBalance[]> {
  return request<RareSatBalance[]>(
    `/v1/address/${encodeURIComponent(address)}/rare-sats?offset=${offset}&limit=${limit}`,
    `ordiscan:raresats:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

// --- Collections ---

export interface OrdiscanCollection {
  slug: string;
  name: string;
  description: string;
  image_url: string;
  inscription_count: number;
  floor_price?: number;
  total_volume?: number;
  owner_count?: number;
}

export async function getCollectionInfo(slug: string): Promise<OrdiscanCollection> {
  return request<OrdiscanCollection>(
    `/v1/collection/${encodeURIComponent(slug)}`,
    `ordiscan:collection:${slug}`,
    TTL.COLLECTION_INFO,
  );
}

export async function getCollectionInscriptions(
  slug: string,
  offset = 0,
  limit = 20,
): Promise<OrdiscanInscription[]> {
  return request<OrdiscanInscription[]>(
    `/v1/collection/${encodeURIComponent(slug)}/inscriptions?offset=${offset}&limit=${limit}`,
    `ordiscan:collinsc:${slug}:${offset}:${limit}`,
    TTL.COLLECTION_INFO,
  );
}

// --- Runes ---

export interface OrdiscanRune {
  name: string;
  spaced_name: string;
  rune_number: number;
  symbol: string;
  divisibility: number;
  total_supply: string;
  minted: string;
  premine: string;
  etching_txid: string;
  etching_block: number;
  turbo: boolean;
}

export async function getRuneInfo(name: string): Promise<OrdiscanRune> {
  return request<OrdiscanRune>(
    `/v1/rune/${encodeURIComponent(name)}`,
    `ordiscan:rune:${name}`,
    TTL.RUNE_ETCHING,
  );
}

export interface OrdiscanRuneMarket {
  name: string;
  price_usd?: number;
  market_cap_usd?: number;
  volume_24h_usd?: number;
}

export async function getRuneMarketInfo(name: string): Promise<OrdiscanRuneMarket> {
  return request<OrdiscanRuneMarket>(
    `/v1/rune/${encodeURIComponent(name)}/market`,
    `ordiscan:runemarket:${name}`,
    TTL.MARKETPLACE,
  );
}

export interface OrdiscanRuneBalance {
  name: string;
  spaced_name: string;
  balance: string;
  symbol: string;
  divisibility: number;
}

export async function getAddressRunes(
  address: string,
  offset = 0,
  limit = 20,
): Promise<OrdiscanRuneBalance[]> {
  return request<OrdiscanRuneBalance[]>(
    `/v1/address/${encodeURIComponent(address)}/runes?offset=${offset}&limit=${limit}`,
    `ordiscan:addrrunes:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

export interface RuneUnlockDate {
  name: string;
  unlock_block: number;
  estimated_date: string;
}

export async function getRuneUnlockDate(name: string): Promise<RuneUnlockDate> {
  return request<RuneUnlockDate>(
    `/v1/rune/unlock/${encodeURIComponent(name)}`,
    `ordiscan:runeunlock:${name}`,
    TTL.SAT_RARITY, // static data
  );
}

// --- BRC-20 ---

export interface OrdiscanBrc20Balance {
  tick: string;
  available_balance: string;
  transferrable_balance: string;
  overall_balance: string;
}

export async function getAddressBrc20(
  address: string,
  offset = 0,
  limit = 20,
): Promise<OrdiscanBrc20Balance[]> {
  return request<OrdiscanBrc20Balance[]>(
    `/v1/address/${encodeURIComponent(address)}/brc20?offset=${offset}&limit=${limit}`,
    `ordiscan:addrbrc20:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

// --- Transactions ---

export async function getTxInscriptions(txid: string): Promise<OrdiscanInscription[]> {
  return request<OrdiscanInscription[]>(
    `/v1/tx/${encodeURIComponent(txid)}/inscriptions`,
    `ordiscan:txinsc:${txid}`,
    TTL.INSCRIPTION_META,
  );
}

export interface OrdiscanTxRune {
  name: string;
  spaced_name: string;
  amount: string;
  address: string;
  operation: string;
}

export async function getTxRunes(txid: string): Promise<OrdiscanTxRune[]> {
  return request<OrdiscanTxRune[]>(
    `/v1/tx/${encodeURIComponent(txid)}/runes`,
    `ordiscan:txrunes:${txid}`,
    TTL.INSCRIPTION_META,
  );
}

// --- Inscription Traits ---

export interface InscriptionTrait {
  trait_type: string;
  value: string;
}

export async function getInscriptionTraits(id: string): Promise<InscriptionTrait[]> {
  return request<InscriptionTrait[]>(
    `/v1/inscription/${encodeURIComponent(id)}/traits`,
    `ordiscan:traits:${id}`,
    TTL.SAT_RARITY, // static
  );
}
