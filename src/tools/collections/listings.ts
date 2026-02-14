import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as magicEden from "../../clients/magic-eden.js";

const schema = z.object({
  collection_symbol: z.string().describe("Collection symbol on Magic Eden"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page"),
});

export const getCollectionListings: McpAction = {
  tool: {
    name: "get_collection_listings",
    description:
      "Get active marketplace listings for an Ordinals collection on Magic Eden. Returns listed inscriptions with prices in BTC.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { collection_symbol, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await magicEden.getCollectionListings(collection_symbol, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
