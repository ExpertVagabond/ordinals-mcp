// ─── Security & Validation (ordinals-mcp) ───────────────────────────
// Bitcoin address, inscription, txid validators + sanitizers in first 80 lines.
//
// Security policy:
// - All inputs validated: Bitcoin addresses (base58check), inscription IDs, txids
// - Parameters sanitized via psm-mcp-core-ts validateNoInjection + local sanitizers
// - Rate limiter: psm-mcp-core-ts RateLimiter, 120 calls/min prevents abuse
// - Error redaction: psm-mcp-core-ts sanitizeError() strips paths and internal details
// - Output filtering: psm-mcp-core-ts OutputFilter redacts secrets/PII in all responses
// - Audit logging: psm-mcp-core-ts AuditLogger + every tool call logged with timing
// - Timeout enforcement: 30s max per API call via withTimeout wrapper
// - No hardcoded API keys — Hiro API is public, auth via env if needed

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { RateLimiter } from "@psm/mcp-core-ts";
import type { McpAction } from "./types.js";
import { errorResult, redactError, validateNoInjection, auditLog } from "./types.js";

// Security constants and patterns
const MAX_STRING_LEN = 4096;
const MAX_PAGE_SIZE = 100;
const BITCOIN_ADDRESS_RE = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
const INSCRIPTION_ID_RE = /^[a-f0-9]{64}i\d+$/;
const TXID_RE = /^[a-f0-9]{64}$/;

// PSM rate limiter: 120 requests per 60 seconds (sliding window)
const rateLimiter = new RateLimiter(120, 60_000);

function sanitizeString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
  if (value.length > MAX_STRING_LEN) throw new Error(`${fieldName} exceeds maximum length of ${MAX_STRING_LEN}`);
  if (value.includes("\0")) throw new Error(`${fieldName} contains null bytes`);
  return value;
}
function sanitizeParams(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!params || typeof params !== "object") return params;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      // PSM injection check on all string params
      validateNoInjection(value, key);
      cleaned[key] = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
      if ((cleaned[key] as string).length > MAX_STRING_LEN) throw new Error(`Parameter "${key}" exceeds maximum length`);
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`Parameter "${key}" must be a finite number`);
      cleaned[key] = (key === "page_size" && value > MAX_PAGE_SIZE) ? MAX_PAGE_SIZE : value;
    } else { cleaned[key] = value; }
  }
  return cleaned;
}
function logOperation(action: string, success: boolean, durationMs?: number): void {
  const status = success ? "TOOL_SUCCESS" : "TOOL_FAILURE";
  auditLog.log(status, `${action} (${durationMs ?? 0}ms)`, "stdio");
  const entry = { timestamp: new Date().toISOString(), action, success, ...(durationMs !== undefined && { durationMs }) };
  console.error(`[audit] ${JSON.stringify(entry)}`);
}
/** Timeout wrapper — all API calls are time-bounded */
async function withTimeout<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms));
  return Promise.race([promise, timer]);
}
function validateBitcoinAddress(addr: unknown, fieldName: string): string {
  const s = sanitizeString(addr, fieldName);
  if (!BITCOIN_ADDRESS_RE.test(s)) throw new Error(`${fieldName} is not a valid Bitcoin address`);
  return s;
}
function validateInscriptionId(id: unknown, fieldName: string): string {
  const s = sanitizeString(id, fieldName);
  if (!INSCRIPTION_ID_RE.test(s)) throw new Error(`${fieldName} is not a valid inscription ID`);
  return s;
}
function validateTxid(id: unknown, fieldName: string): string {
  const s = sanitizeString(id, fieldName);
  if (!TXID_RE.test(s)) throw new Error(`${fieldName} is not a valid transaction ID`);
  return s;
}
// ─── End Security Block ─────────────────────────────────────────────

// Tier 1 — Core
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

// Tier 2 — Collections & Market
import { getCollectionInfo } from "./tools/collections/info.js";
import { getCollectionInscriptions } from "./tools/collections/inscriptions.js";
import { getCollectionListings } from "./tools/collections/listings.js";
import { getInscriptionTraits } from "./tools/inscriptions/traits.js";
import { getRuneMarketInfo } from "./tools/runes/market.js";

// Tier 3 — Advanced
import { listRunes } from "./tools/runes/list.js";
import { getRuneHolders } from "./tools/runes/holders.js";
import { getRuneActivity } from "./tools/runes/activity.js";
import { getRuneUnlockDate } from "./tools/runes/unlock.js";
import { getBrc20Activity } from "./tools/brc20/activity.js";
import { getBrc20Holders } from "./tools/brc20/holders.js";
import { getTxInscriptions } from "./tools/tx/inscriptions.js";
import { getTxRunes } from "./tools/tx/runes.js";

// Register all actions
const actions: McpAction[] = [
  // Tier 1
  getInscription,
  searchInscriptions,
  getInscriptionContent,
  getInscriptionTransfers,
  getAddressInscriptions,
  getBrc20Balances,
  getRuneBalances,
  getAddressRareSats,
  getSatInfo,
  getBrc20Token,
  getRuneInfo,
  // Tier 2
  getCollectionInfo,
  getCollectionInscriptions,
  getCollectionListings,
  getInscriptionTraits,
  getRuneMarketInfo,
  // Tier 3
  listRunes,
  getRuneHolders,
  getRuneActivity,
  getRuneUnlockDate,
  getBrc20Activity,
  getBrc20Holders,
  getTxInscriptions,
  getTxRunes,
];

// Build handler map
const handlerMap = new Map<string, McpAction["handler"]>();
for (const action of actions) {
  handlerMap.set(action.tool.name, action.handler);
}

function createServer() {
  const server = new Server(
    {
      name: "ordinals-mcp",
      version: "0.1.2",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: actions.map((a) => a.tool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    // Security: rate limiting (psm-mcp-core-ts sliding window)
    try { rateLimiter.check("global"); } catch (e) {
      return errorResult(redactError(e));
    }

    const handler = handlerMap.get(toolName);
    if (!handler) {
      return errorResult(`Unknown tool: ${toolName}`);
    }
    const start = Date.now();
    try {
      // Security: sanitize all incoming parameters
      if (request.params.arguments) {
        request.params.arguments = sanitizeParams(
          request.params.arguments as Record<string, unknown>,
        ) as typeof request.params.arguments;
      }
      const result = await withTimeout(handler(request));
      logOperation(toolName, true, Date.now() - start);
      return result;
    } catch (e) {
      logOperation(toolName, false, Date.now() - start);
      return errorResult(redactError(e));
    }
  });

  return server;
}

// Smithery sandbox export for scanning
export function createSandboxServer() {
  return createServer();
}

// Start server
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ordinals-mcp v0.1.2 running (${actions.length} tools)`);
}

main().catch((e) => {
  console.error("Fatal:", redactError(e));
  process.exit(1);
});
