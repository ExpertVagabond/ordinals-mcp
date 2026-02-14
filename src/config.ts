export interface ApiConfig {
  key: string | undefined;
  baseUrl: string;
  maxRpm: number;
}

export const config = {
  hiro: {
    key: process.env.HIRO_API_KEY,
    baseUrl: "https://api.hiro.so",
    maxRpm: process.env.HIRO_API_KEY ? 500 : 50,
  } satisfies ApiConfig,

  ordiscan: {
    key: process.env.ORDISCAN_API_KEY,
    baseUrl: "https://api.ordiscan.com",
    maxRpm: 60, // conservative for free tier daily limits
  } satisfies ApiConfig,

  magicEden: {
    key: process.env.MAGIC_EDEN_API_KEY,
    baseUrl: "https://api-mainnet.magiceden.dev",
    maxRpm: process.env.MAGIC_EDEN_API_KEY ? 120 : 30,
  } satisfies ApiConfig,

  ordinalsBot: {
    key: process.env.ORDINALSBOT_API_KEY,
    baseUrl: "https://api.ordinalsbot.com",
    maxRpm: 12,
  } satisfies ApiConfig,

  cache: {
    defaultTtlMs: parseInt(process.env.CACHE_TTL_SECONDS || "300", 10) * 1000,
  },

  rateLimitBuffer: parseFloat(process.env.RATE_LIMIT_BUFFER || "0.8"),
};

export function hasAnyApiKey(): boolean {
  return !!(config.hiro.key || config.ordiscan.key);
}
