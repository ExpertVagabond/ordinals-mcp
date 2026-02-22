// Stripe authentication and subscription management for Ordinals MCP
import Stripe from "stripe";

// Lazy-initialize Stripe so the server can start without credentials (free tier works without Stripe)
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY not configured. Paid tiers require Stripe credentials.",
      );
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Tier limits
export interface TierLimits {
  dailyCalls: number; // -1 = unlimited
  monthlyPrice: number; // cents
}

export const TIERS: Record<string, TierLimits> = {
  free: { dailyCalls: 10, monthlyPrice: 0 },
  pro: { dailyCalls: 1000, monthlyPrice: 2900 },
  enterprise: { dailyCalls: -1, monthlyPrice: 19900 },
};

/**
 * Validate API key and return tier info
 * Free tier: no key or "free"
 * Paid tiers: skey_{customerId}_{hash}
 */
export async function validateApiKey(
  apiKey: string,
): Promise<{ tier: string; limits: TierLimits; customerId: string } | null> {
  try {
    if (!apiKey || apiKey === "free") {
      return { tier: "free", limits: TIERS.free, customerId: "free" };
    }

    if (!apiKey.startsWith("skey_")) {
      return null;
    }

    const parts = apiKey.split("_");
    if (parts.length < 3) return null;
    const customerId = parts[1];

    const subscriptions = await getStripe().subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) return null;

    const priceId = subscriptions.data[0].items.data[0]?.price.id;
    const tier =
      priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID
        ? "enterprise"
        : "pro";

    return { tier, limits: TIERS[tier], customerId };
  } catch (error) {
    console.error("API key validation failed:", error);
    return null;
  }
}

// In-memory daily usage counters (reset daily)
const usageMap = new Map<string, { count: number; date: string }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getUsage(customerId: string): number {
  const entry = usageMap.get(customerId);
  if (!entry || entry.date !== todayKey()) return 0;
  return entry.count;
}

export function trackUsage(customerId: string): void {
  const today = todayKey();
  const entry = usageMap.get(customerId);
  if (!entry || entry.date !== today) {
    usageMap.set(customerId, { count: 1, date: today });
  } else {
    entry.count++;
  }
}

export function checkUsageLimit(
  customerId: string,
  limits: TierLimits,
): boolean {
  if (limits.dailyCalls === -1) return true;
  return getUsage(customerId) < limits.dailyCalls;
}

export async function createCheckoutSession(
  priceId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { product: "ordinals-mcp" },
  });
  return session.url || "";
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
