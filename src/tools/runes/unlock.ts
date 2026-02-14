import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  name: z.string().describe("Rune name to check availability for"),
});

export const getRuneUnlockDate: McpAction = {
  tool: {
    name: "get_rune_unlock_date",
    description:
      "Check when a rune name becomes available for etching. Returns unlock block height and estimated date.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { name } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getRuneUnlockDate(name);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
