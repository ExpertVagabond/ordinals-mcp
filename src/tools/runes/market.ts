import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  name: z.string().describe("Rune name (e.g., UNCOMMON•GOODS or UNCOMMONGOODS)"),
});

export const getRuneMarketInfo: McpAction = {
  tool: {
    name: "get_rune_market_info",
    description:
      "Get market data for a Bitcoin Rune. Returns price in USD, market cap, and 24h volume.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { name } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getRuneMarketInfo(name);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
