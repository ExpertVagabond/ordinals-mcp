import { config } from "../config.js";
import { cache, TTL } from "../cache/index.js";
import { getRateLimiter } from "../rate-limit/index.js";

const limiter = getRateLimiter("hiro", config.hiro.maxRpm, config.rateLimitBuffer);

function headers(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (config.hiro.key) h["x-hiro-api-key"] = config.hiro.key;
  return h;
}

export class HiroApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`Hiro API ${status}: ${message}`);
    this.name = "HiroApiError";
  }
}

async function request<T>(path: string, cacheKey: string, ttl: number): Promise<T> {
  // Check cache
  const cached = cache.get<T>(cacheKey);
  if (cached) return cached.data;

  await limiter.wait();

  const url = `${config.hiro.baseUrl}${path}`;
  const res = await fetch(url, { headers: headers() });

  if (!res.ok) {
    if (res.status === 429) {
      // Rate limited — try stale cache
      const stale = cache.getStale<T>(cacheKey);
      if (stale) return stale;
      throw new HiroApiError(429, "Rate limited");
    }
    const body = await res.text().catch(() => "");
    throw new HiroApiError(res.status, body || res.statusText);
  }

  const data = (await res.json()) as T;
  const etag = res.headers.get("etag") ?? undefined;
  cache.set(cacheKey, data, ttl, etag);
  return data;
}

// --- Inscriptions ---

export interface InscriptionMeta {
  id: string;
  number: number;
  address: string;
  content_type: string;
  content_length: number;
  genesis_address: string;
  genesis_block_height: number;
  genesis_block_hash: string;
  genesis_tx_id: string;
  genesis_fee: string;
  genesis_timestamp: number;
  tx_id: string;
  location: string;
  output: string;
  value: string;
  offset: string;
  sat_ordinal: string;
  sat_rarity: string;
  sat_coinbase_height: number;
  mime_type: string;
  recursive: boolean;
  recursion_refs: string[] | null;
  timestamp: number;
  curse_type: string | null;
}

export interface PaginatedResponse<T> {
  limit: number;
  offset: number;
  total: number;
  results: T[];
}

export async function getInscription(id: string): Promise<InscriptionMeta> {
  return request<InscriptionMeta>(
    `/ordinals/v1/inscriptions/${encodeURIComponent(id)}`,
    `hiro:inscription:${id}`,
    TTL.INSCRIPTION_META,
  );
}

export async function searchInscriptions(params: {
  address?: string;
  mime_type?: string;
  rarity?: string;
  from_block?: number;
  to_block?: number;
  from_number?: number;
  to_number?: number;
  recursive?: boolean;
  cursed?: boolean;
  offset?: number;
  limit?: number;
}): Promise<PaginatedResponse<InscriptionMeta>> {
  const qs = new URLSearchParams();
  if (params.address) qs.set("address", params.address);
  if (params.mime_type) qs.set("mime_type", params.mime_type);
  if (params.rarity) qs.set("rarity", params.rarity);
  if (params.from_block !== undefined) qs.set("from_block_height", String(params.from_block));
  if (params.to_block !== undefined) qs.set("to_block_height", String(params.to_block));
  if (params.from_number !== undefined) qs.set("from_number", String(params.from_number));
  if (params.to_number !== undefined) qs.set("to_number", String(params.to_number));
  if (params.recursive !== undefined) qs.set("recursive", String(params.recursive));
  if (params.cursed !== undefined) qs.set("cursed", String(params.cursed));
  qs.set("offset", String(params.offset ?? 0));
  qs.set("limit", String(params.limit ?? 20));

  const key = `hiro:inscriptions:${qs.toString()}`;
  return request<PaginatedResponse<InscriptionMeta>>(
    `/ordinals/v1/inscriptions?${qs}`,
    key,
    TTL.INSCRIPTION_META,
  );
}

export async function getInscriptionContent(id: string): Promise<{ contentType: string; data: string }> {
  await limiter.wait();
  const url = `${config.hiro.baseUrl}/ordinals/v1/inscriptions/${encodeURIComponent(id)}/content`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new HiroApiError(res.status, res.statusText);

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("svg")) {
    const text = await res.text();
    return { contentType, data: text };
  }
  // Binary content — return base64
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  return { contentType, data: `data:${contentType};base64,${b64}` };
}

export interface Transfer {
  block_height: number;
  block_hash: string;
  address: string;
  tx_id: string;
  location: string;
  output: string;
  value: string;
  offset: string;
  timestamp: number;
}

export async function getInscriptionTransfers(
  id: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<Transfer>> {
  return request<PaginatedResponse<Transfer>>(
    `/ordinals/v1/inscriptions/${encodeURIComponent(id)}/transfers?offset=${offset}&limit=${limit}`,
    `hiro:transfers:${id}:${offset}:${limit}`,
    TTL.ACTIVITY,
  );
}

// --- Sats ---

export interface SatInfo {
  coinbase_height: number;
  cycle: number;
  decimal: string;
  degree: string;
  inscription_id: string | null;
  epoch: number;
  name: string;
  offset: number;
  percentile: string;
  period: number;
  rarity: string;
}

export async function getSatInfo(ordinal: string): Promise<SatInfo> {
  return request<SatInfo>(
    `/ordinals/v1/sats/${encodeURIComponent(ordinal)}`,
    `hiro:sat:${ordinal}`,
    TTL.SAT_RARITY,
  );
}

// --- BRC-20 ---

export interface Brc20Token {
  id: string;
  number: number;
  block_height: number;
  tx_id: string;
  address: string;
  ticker: string;
  max_supply: string;
  mint_limit: string;
  decimals: number;
  deploy_timestamp: number;
  minted_supply: string;
  tx_count: number;
}

export async function getBrc20Token(ticker: string): Promise<Brc20Token> {
  return request<Brc20Token>(
    `/ordinals/v1/brc-20/tokens/${encodeURIComponent(ticker)}`,
    `hiro:brc20:${ticker}`,
    TTL.INSCRIPTION_META,
  );
}

export interface Brc20Balance {
  ticker: string;
  available_balance: string;
  transferrable_balance: string;
  overall_balance: string;
}

export async function getBrc20Balances(
  address: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<Brc20Balance>> {
  return request<PaginatedResponse<Brc20Balance>>(
    `/ordinals/v1/brc-20/balances/${encodeURIComponent(address)}?offset=${offset}&limit=${limit}`,
    `hiro:brc20bal:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

export interface Brc20Activity {
  operation: string;
  ticker: string;
  inscription_id: string;
  block_height: number;
  block_hash: string;
  tx_id: string;
  address: string;
  timestamp: number;
  deploy?: { max_supply: string; mint_limit: string; decimals: number };
  mint?: { amount: string };
  transfer?: { amount: string; from_address: string };
}

export async function getBrc20Activity(params: {
  ticker?: string;
  address?: string;
  operation?: string;
  offset?: number;
  limit?: number;
}): Promise<PaginatedResponse<Brc20Activity>> {
  const qs = new URLSearchParams();
  if (params.ticker) qs.set("ticker", params.ticker);
  if (params.address) qs.set("address", params.address);
  if (params.operation) qs.set("operation", params.operation);
  qs.set("offset", String(params.offset ?? 0));
  qs.set("limit", String(params.limit ?? 20));
  return request<PaginatedResponse<Brc20Activity>>(
    `/ordinals/v1/brc-20/activity?${qs}`,
    `hiro:brc20act:${qs}`,
    TTL.ACTIVITY,
  );
}

export interface Brc20Holder {
  address: string;
  overall_balance: string;
}

export async function getBrc20Holders(
  ticker: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<Brc20Holder>> {
  return request<PaginatedResponse<Brc20Holder>>(
    `/ordinals/v1/brc-20/tokens/${encodeURIComponent(ticker)}/holders?offset=${offset}&limit=${limit}`,
    `hiro:brc20holders:${ticker}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

// --- Runes ---

export interface RuneEtching {
  id: string;
  name: string;
  spaced_name: string;
  number: number;
  block_height: number;
  tx_index: number;
  tx_id: string;
  divisibility: number;
  premine: string;
  symbol: string;
  turbo: boolean;
  supply: { current: string; minted: string; mint_percentage: string; mintable: boolean; burned: string; premine: string; total_mints: string; total_burns: string };
  mint_terms?: { amount: string | null; cap: string | null; height_start: number | null; height_end: number | null; offset_start: number | null; offset_end: number | null };
  cenotaph: boolean;
  timestamp: number;
}

export async function getRuneInfo(name: string): Promise<RuneEtching> {
  return request<RuneEtching>(
    `/runes/v1/etchings/${encodeURIComponent(name)}`,
    `hiro:rune:${name}`,
    TTL.RUNE_ETCHING,
  );
}

export async function listRunes(params: {
  offset?: number;
  limit?: number;
}): Promise<PaginatedResponse<RuneEtching>> {
  const qs = new URLSearchParams();
  qs.set("offset", String(params.offset ?? 0));
  qs.set("limit", String(params.limit ?? 20));
  return request<PaginatedResponse<RuneEtching>>(
    `/runes/v1/etchings?${qs}`,
    `hiro:runes:${qs}`,
    TTL.RUNE_ETCHING,
  );
}

export interface RuneBalance {
  rune: { id: string; name: string; spaced_name: string };
  address: string;
  balance: string;
}

export async function getRuneBalances(
  address: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<RuneBalance>> {
  return request<PaginatedResponse<RuneBalance>>(
    `/runes/v1/addresses/${encodeURIComponent(address)}/balances?offset=${offset}&limit=${limit}`,
    `hiro:runebal:${address}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

export interface RuneHolder {
  address: string;
  balance: string;
}

export async function getRuneHolders(
  name: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<RuneHolder>> {
  return request<PaginatedResponse<RuneHolder>>(
    `/runes/v1/etchings/${encodeURIComponent(name)}/holders?offset=${offset}&limit=${limit}`,
    `hiro:runeholders:${name}:${offset}:${limit}`,
    TTL.BALANCE,
  );
}

export interface RuneActivity {
  rune: { id: string; name: string; spaced_name: string };
  address: string;
  receiver_address: string;
  amount: string;
  operation: string;
  block_height: number;
  tx_index: number;
  tx_id: string;
  output: string;
  timestamp: number;
}

export async function getRuneActivity(
  name: string,
  offset = 0,
  limit = 20,
): Promise<PaginatedResponse<RuneActivity>> {
  return request<PaginatedResponse<RuneActivity>>(
    `/runes/v1/etchings/${encodeURIComponent(name)}/activity?offset=${offset}&limit=${limit}`,
    `hiro:runeact:${name}:${offset}:${limit}`,
    TTL.ACTIVITY,
  );
}

// --- Stats ---

export interface InscriptionStats {
  count: number;
  count_accum: number;
}

export async function getInscriptionStats(): Promise<PaginatedResponse<InscriptionStats>> {
  return request<PaginatedResponse<InscriptionStats>>(
    `/ordinals/v1/stats/inscriptions`,
    `hiro:stats`,
    TTL.COLLECTION_INFO,
  );
}
