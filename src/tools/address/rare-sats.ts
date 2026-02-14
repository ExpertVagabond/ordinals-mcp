import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  address: z.string().describe("Bitcoin address"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page"),
});

export const getAddressRareSats: McpAction = {
  tool: {
    name: "get_address_rare_sats",
    description:
      "Get rare satoshis held by a Bitcoin address. Returns sat ordinal number, rarity level (uncommon/rare/epic/legendary/mythic), and UTXO location.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { address, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getAddressRareSats(address, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
