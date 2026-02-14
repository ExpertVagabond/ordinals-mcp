import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { McpAction } from "./types.js";
import { errorResult } from "./types.js";

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
    const handler = handlerMap.get(request.params.name);
    if (!handler) {
      return errorResult(`Unknown tool: ${request.params.name}`);
    }
    try {
      return await handler(request);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
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
  console.error("Fatal:", e);
  process.exit(1);
});
