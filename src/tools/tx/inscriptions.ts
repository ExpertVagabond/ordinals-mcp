import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  txid: z.string().describe("Bitcoin transaction ID"),
});

export const getTxInscriptions: McpAction = {
  tool: {
    name: "get_tx_inscriptions",
    description:
      "Get all Ordinals inscriptions contained in a Bitcoin transaction. Returns inscription IDs, numbers, and content types.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { txid } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getTxInscriptions(txid);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
