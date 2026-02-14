import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";
import * as ordiscan from "../../clients/ordiscan.js";
import { config } from "../../config.js";

const schema = z.object({
  id: z.string().describe("Inscription ID ({txid}i{index}) or inscription number"),
});

export const getInscription: McpAction = {
  tool: {
    name: "get_inscription",
    description:
      "Get detailed metadata for a Bitcoin Ordinals inscription by its ID or number. Returns owner address, content type, sat rarity, genesis info, and more.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { id } = schema.parse(request.params.arguments);
    try {
      if (config.hiro.key) {
        const data = await hiro.getInscription(id);
        return textResult(data);
      }
    } catch (e) {
      if (!config.ordiscan.key) throw e;
      // Fall through to Ordiscan
    }
    try {
      if (config.ordiscan.key) {
        const data = await ordiscan.getInscription(id);
        return textResult(data);
      }
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    return errorResult("No API key configured. Set HIRO_API_KEY or ORDISCAN_API_KEY.");
  },
};
