import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";
import * as ordiscan from "../../clients/ordiscan.js";
import { config } from "../../config.js";

const schema = z.object({
  name: z.string().describe("Rune name (e.g., UNCOMMON•GOODS or UNCOMMONGOODS)"),
});

export const getRuneInfo: McpAction = {
  tool: {
    name: "get_rune_info",
    description:
      "Get details for a Bitcoin Rune by name. Returns symbol, divisibility, supply, premine, mint terms, and etching transaction.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { name } = schema.parse(request.params.arguments);
    try {
      if (config.hiro.key) {
        const data = await hiro.getRuneInfo(name);
        return textResult(data);
      }
    } catch (e) {
      if (!config.ordiscan.key) throw e;
    }
    try {
      if (config.ordiscan.key) {
        const data = await ordiscan.getRuneInfo(name);
        return textResult(data);
      }
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
    return errorResult("No API key configured. Set HIRO_API_KEY or ORDISCAN_API_KEY.");
  },
};
