import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  address: z.string().optional().describe("Filter by owner Bitcoin address"),
  mime_type: z.string().optional().describe("Filter by MIME type (e.g., image/png, text/plain)"),
  rarity: z
    .enum(["common", "uncommon", "rare", "epic", "legendary", "mythic"])
    .optional()
    .describe("Filter by sat rarity"),
  from_block: z.number().optional().describe("Start block height"),
  to_block: z.number().optional().describe("End block height"),
  from_number: z.number().optional().describe("Start inscription number"),
  to_number: z.number().optional().describe("End inscription number"),
  recursive: z.boolean().optional().describe("Filter recursive inscriptions"),
  cursed: z.boolean().optional().describe("Filter cursed inscriptions"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page (max 60)"),
});

export const searchInscriptions: McpAction = {
  tool: {
    name: "search_inscriptions",
    description:
      "Search and list Bitcoin Ordinals inscriptions with filters. Filter by address, MIME type, sat rarity, block range, inscription number range, recursive/cursed status.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const params = schema.parse(request.params.arguments);
    try {
      const data = await hiro.searchInscriptions(params);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
