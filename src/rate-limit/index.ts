export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxRpm: number, buffer = 0.8) {
    const effectiveRpm = Math.floor(maxRpm * buffer);
    this.maxTokens = effectiveRpm;
    this.tokens = effectiveRpm;
    this.refillRate = effectiveRpm / 60_000; // per ms
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

  /** Wait until a token is available */
  async wait(): Promise<void> {
    while (!this.consume()) {
      const waitMs = Math.ceil(1 / this.refillRate);
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 1000)));
    }
  }
}

const buckets = new Map<string, TokenBucket>();

export function getRateLimiter(name: string, maxRpm: number, buffer = 0.8): TokenBucket {
  let bucket = buckets.get(name);
  if (!bucket) {
    bucket = new TokenBucket(maxRpm, buffer);
    buckets.set(name, bucket);
  }
  return bucket;
}
