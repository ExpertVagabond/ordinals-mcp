import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult, redactError } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  name: z.string().min(1).max(128).describe("Rune name (e.g., UNCOMMON•GOODS or UNCOMMONGOODS)"),
  offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
  limit: z.number().int().min(1).max(60).optional().default(20).describe("Results per page"),
});

export const getRuneHolders: McpAction = {
  tool: {
    name: "get_rune_holders",
    description:
      "Get top holders of a Bitcoin Rune. Returns addresses and balances sorted by amount held.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { name, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getRuneHolders(name, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(redactError(e));
    }
  },
};
