import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  txid: z.string().describe("Bitcoin transaction ID"),
});

export const getTxRunes: McpAction = {
  tool: {
    name: "get_tx_runes",
    description:
      "Get all Rune transfers in a Bitcoin transaction. Returns rune names, amounts, addresses, and operation types.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { txid } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getTxRunes(txid);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
