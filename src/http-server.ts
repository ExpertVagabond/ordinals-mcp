#!/usr/bin/env node
/**
 * Ordinals MCP HTTP Server — Hosted SaaS Proxy
 *
 * Stripe-authenticated API gateway for Bitcoin Ordinals data.
 * Users authenticate with API keys, get rate-limited by tier.
 *
 * Tiers: Free (10 calls/day), Pro $29/mo (1,000/day), Enterprise $199/mo (unlimited)
 */

import express, { Request, Response, NextFunction } from "express";
import * as dotenv from "dotenv";
import {
  sanitizeError as psmSanitizeError,
  validateNoInjection,
  OutputFilter,
  AuditLogger,
} from "@psm/mcp-core-ts";

// ── Security Constants ──────────────────────────────────────────────────
const MAX_REQUEST_BODY = 1 * 1024 * 1024; // 1 MB
const MAX_TOOL_NAME_LEN = 64;
const MAX_PARAM_VALUE_LEN = 1024;
const SAFE_TOOL_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

/** Shared PSM output filter for HTTP responses. */
const httpOutputFilter = new OutputFilter(true, true);

/** Shared PSM audit logger for HTTP requests. */
const httpAuditLog = new AuditLogger();

/** Credential patterns that must never appear in responses. */
const CREDENTIAL_RE =
  /(?:STRIPE_SECRET_KEY|STRIPE_PRO_PRICE_ID|STRIPE_ENTERPRISE_PRICE_ID|sk_live_|sk_test_)[^\s"']*/gi;

/**
 * Strip secrets from error messages before sending to clients.
 * Combines local credential stripping with psm-mcp-core-ts sanitizeError.
 */
function redactError(msg: string): string {
  let safe = msg.replace(CREDENTIAL_RE, "[REDACTED]");
  // Redact env var values
  for (const key of [
    "STRIPE_SECRET_KEY",
    "HIRO_API_KEY",
    "ORDISCAN_API_KEY",
  ]) {
    const val = process.env[key];
    if (val && val.length > 4) {
      safe = safe.replaceAll(val, "[REDACTED]");
    }
  }
  // Additional redaction via psm-mcp-core-ts (paths, long tokens)
  return psmSanitizeError(safe, 500);
}

/**
 * Validate tool arguments — reject null bytes, oversized values, injection patterns.
 * Enhanced with psm-mcp-core-ts validateNoInjection.
 */
function validateArgs(args: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === "string") {
      if (val.includes("\0")) {
        throw new Error(`Parameter '${key}' contains null bytes`);
      }
      if (val.length > MAX_PARAM_VALUE_LEN) {
        throw new Error(
          `Parameter '${key}' exceeds max length (${val.length} > ${MAX_PARAM_VALUE_LEN})`,
        );
      }
      // PSM injection check on all string params
      validateNoInjection(val, key);
    }
  }
}
import {
  validateApiKey,
  checkUsageLimit,
  trackUsage,
  getUsage,
  createCheckoutSession,
  createPortalSession,
  TIERS,
} from "./stripe-auth.js";

import type { McpAction } from "./types.js";

// Import all tool handlers (same as index.ts)
import { getInscription } from "./tools/inscriptions/get.js";
import { searchInscriptions } from "./tools/inscriptions/search.js";
import { getInscriptionContent } from "./tools/inscriptions/content.js";
import { getInscriptionTransfers } from "./tools/inscriptions/transfers.js";
import { getAddressInscriptions } from "./tools/address/inscriptions.js";
import { getBrc20Balances } from "./tools/address/brc20.js";
import { getRuneBalances } from "./tools/address/runes.js";
import { getAddressRareSats } from "./tools/address/rare-sats.js";
import { getSatInfo } from "./tools/sats/info.js";
import { getBrc20Token } from "./tools/brc20/token.js";
import { getRuneInfo } from "./tools/runes/info.js";
import { getCollectionInfo } from "./tools/collections/info.js";
import { getCollectionInscriptions } from "./tools/collections/inscriptions.js";
import { getCollectionListings } from "./tools/collections/listings.js";
import { getInscriptionTraits } from "./tools/inscriptions/traits.js";
import { getRuneMarketInfo } from "./tools/runes/market.js";
import { listRunes } from "./tools/runes/list.js";
import { getRuneHolders } from "./tools/runes/holders.js";
import { getRuneActivity } from "./tools/runes/activity.js";
import { getRuneUnlockDate } from "./tools/runes/unlock.js";
import { getBrc20Activity } from "./tools/brc20/activity.js";
import { getBrc20Holders } from "./tools/brc20/holders.js";
import { getTxInscriptions } from "./tools/tx/inscriptions.js";
import { getTxRunes } from "./tools/tx/runes.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: MAX_REQUEST_BODY }));

const PORT = process.env.PORT || 3002;
const BASE_URL =
  process.env.ORDINALS_BASE_URL || `http://localhost:${PORT}`;

// Register all actions
const actions: McpAction[] = [
  getInscription, searchInscriptions, getInscriptionContent,
  getInscriptionTransfers, getAddressInscriptions, getBrc20Balances,
  getRuneBalances, getAddressRareSats, getSatInfo, getBrc20Token,
  getRuneInfo, getCollectionInfo, getCollectionInscriptions,
  getCollectionListings, getInscriptionTraits, getRuneMarketInfo,
  listRunes, getRuneHolders, getRuneActivity, getRuneUnlockDate,
  getBrc20Activity, getBrc20Holders, getTxInscriptions, getTxRunes,
];

const handlerMap = new Map<string, McpAction["handler"]>();
for (const action of actions) {
  handlerMap.set(action.tool.name, action.handler);
}

// --- Auth types ---

interface AuthenticatedRequest extends Request {
  tier?: string;
  tierLimits?: { dailyCalls: number; monthlyPrice: number };
  customerId?: string;
}

// --- Middleware: API Key Authentication ---

async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = (req.headers["x-api-key"] as string) || "free";

  const result = await validateApiKey(apiKey);
  if (!result) {
    res
      .status(401)
      .json({ error: "Invalid API key", upgrade: `${BASE_URL}/pricing` });
    return;
  }

  req.tier = result.tier;
  req.tierLimits = result.limits;
  req.customerId = result.customerId;
  next();
}

// --- CORS (configurable origin allowlist) ---

/** Parse ALLOWED_ORIGINS env var into a Set. If unset, no cross-origin requests allowed. */
const allowedOrigins: Set<string> = (() => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
})();

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// --- Public Routes ---

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ordinals-mcp-http",
    version: "0.2.0",
    tools: actions.length,
    tiers: Object.keys(TIERS),
  });
});

app.get("/pricing", (req: Request, res: Response) => {
  res.json({
    tiers: {
      free: {
        price: "$0/month",
        calls: "10/day",
        features: ["All 24 tools", "Bitcoin Ordinals data"],
      },
      pro: {
        price: "$29/month",
        calls: "1,000/day",
        features: ["All 24 tools", "Priority rate limits", "Email support"],
      },
      enterprise: {
        price: "$199/month",
        calls: "Unlimited",
        features: [
          "All 24 tools",
          "Unlimited calls",
          "Dedicated support",
          "SLA guarantee",
        ],
      },
    },
    signup: `${BASE_URL}/checkout`,
  });
});

app.get("/tools", (req: Request, res: Response) => {
  res.json({
    name: "ordinals-mcp",
    version: "0.2.0",
    description:
      "Bitcoin Ordinals MCP — inscriptions, runes, BRC-20, collections, marketplace data",
    authentication: `X-API-Key header (get key at ${BASE_URL}/pricing)`,
    tools: actions.map((a) => ({
      name: a.tool.name,
      description: a.tool.description,
      inputSchema: a.tool.inputSchema,
    })),
  });
});

// --- Checkout & Billing ---

app.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { email, tier = "pro" } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const priceId =
      tier === "enterprise"
        ? process.env.STRIPE_ENTERPRISE_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      res.status(500).json({ error: "Stripe price IDs not configured" });
      return;
    }

    const url = await createCheckoutSession(
      priceId,
      email,
      `${BASE_URL}/checkout/success`,
      `${BASE_URL}/pricing`,
    );
    res.json({ url });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

app.post(
  "/portal",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.customerId || req.customerId === "free") {
        res
          .status(400)
          .json({ error: "No active subscription. Sign up at /checkout" });
        return;
      }
      const url = await createPortalSession(
        req.customerId,
        `${BASE_URL}/account`,
      );
      res.json({ url });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Portal failed",
      });
    }
  },
);

app.get("/checkout/success", (req: Request, res: Response) => {
  res.json({
    message: "Subscription activated! Check your email for your API key.",
    docs: `${BASE_URL}/tools`,
  });
});

// --- Account ---

app.get(
  "/account",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const usage =
        req.customerId && req.customerId !== "free"
          ? getUsage(req.customerId)
          : 0;
      const limit = req.tierLimits?.dailyCalls ?? 10;

      res.json({
        tier: req.tier,
        usage,
        limit: limit === -1 ? "Unlimited" : limit,
        remaining: limit === -1 ? "Unlimited" : Math.max(0, limit - usage),
        period: "daily",
        manage: `${BASE_URL}/portal`,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account info" });
    }
  },
);

// --- Tool Execution ---

app.post(
  "/tools/:toolName",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const toolName = req.params.toolName as string;

    // Check tool exists
    const handler = handlerMap.get(toolName);
    if (!handler) {
      res.status(404).json({
        error: `Unknown tool: ${toolName}`,
        available: Array.from(handlerMap.keys()),
      });
      return;
    }

    // Check usage limit
    if (req.customerId && req.tierLimits) {
      if (!checkUsageLimit(req.customerId, req.tierLimits)) {
        res.status(429).json({
          error: "Daily call limit reached",
          tier: req.tier,
          limit: req.tierLimits.dailyCalls,
          resetsAt: "midnight UTC",
          upgrade: `${BASE_URL}/pricing`,
        });
        return;
      }
    }

    try {
      // Validate arguments with PSM injection checks
      const rawArgs = req.body.arguments || req.body.input || {};
      if (rawArgs && typeof rawArgs === "object") {
        validateArgs(rawArgs as Record<string, unknown>);
      }

      // Build a CallToolRequest-like object for the handler
      const mcpRequest = {
        method: "tools/call" as const,
        params: {
          name: toolName,
          arguments: rawArgs,
        },
      };

      const start = Date.now();
      const result = await handler(mcpRequest);
      const durationMs = Date.now() - start;

      // Track usage after successful call
      if (req.customerId) {
        trackUsage(req.customerId);
      }

      // Audit log via psm-mcp-core-ts
      httpAuditLog.log("HTTP_TOOL_CALL", `${toolName} (${durationMs}ms)`, req.customerId ?? "anonymous");

      // Extract text content from MCP response and filter via PSM OutputFilter
      const content = result.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => {
          const filtered = httpOutputFilter.filter(c.text);
          try {
            return JSON.parse(filtered.text);
          } catch {
            return filtered.text;
          }
        });

      res.json({
        tool: toolName,
        data: content.length === 1 ? content[0] : content,
        tier: req.tier,
        ...(result.isError ? { error: true } : {}),
      });
    } catch (error) {
      const safeMsg = redactError(error instanceof Error ? error.message : String(error));
      console.error(`Tool ${toolName} error:`, safeMsg);
      httpAuditLog.log("HTTP_TOOL_ERROR", `${toolName}: ${safeMsg}`, req.customerId ?? "anonymous");
      res.status(500).json({
        error: safeMsg,
      });
    }
  },
);

// --- Start ---

app.listen(PORT, () => {
  console.log(`Ordinals MCP HTTP Server v0.2.0 running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Tools: http://localhost:${PORT}/tools`);
  console.log(`Pricing: http://localhost:${PORT}/pricing`);
  console.log(
    `Tiers: Free (10/day) | Pro $29 (1,000/day) | Enterprise $199 (unlimited)`,
  );
});
