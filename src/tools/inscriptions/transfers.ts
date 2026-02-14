import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  id: z.string().describe("Inscription ID ({txid}i{index}) or inscription number"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page (max 60)"),
});

export const getInscriptionTransfers: McpAction = {
  tool: {
    name: "get_inscription_transfers",
    description:
      "Get the transfer history for a Bitcoin Ordinals inscription. Shows each transfer with block, address, transaction, and timestamp.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { id, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getInscriptionTransfers(id, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
