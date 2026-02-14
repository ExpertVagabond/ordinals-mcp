import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";
import * as ordiscan from "../../clients/ordiscan.js";
import { config } from "../../config.js";

const schema = z.object({
  address: z.string().describe("Bitcoin address (bc1p..., bc1q..., 1..., 3...)"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page (max 60)"),
});

export const getAddressInscriptions: McpAction = {
  tool: {
    name: "get_address_inscriptions",
    description:
      "Get all Ordinals inscriptions owned by a Bitcoin address. Returns inscription IDs, numbers, content types, and sat rarity.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { address, offset, limit } = schema.parse(request.params.arguments);
    try {
      if (config.hiro.key) {
        const data = await hiro.searchInscriptions({ address, offset, limit });
        return textResult(data);
      }
    } catch (e) {
      if (!config.ordiscan.key) throw e;
    }
    try {
      if (config.ordiscan.key) {
        const data = await ordiscan.getAddressInscriptions(address, offset, limit);
        return textResult(data);
      }
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    return errorResult("No API key configured. Set HIRO_API_KEY or ORDISCAN_API_KEY.");
  },
};
