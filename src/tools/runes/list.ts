import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page (max 60)"),
});

export const listRunes: McpAction = {
  tool: {
    name: "list_runes",
    description:
      "List Bitcoin Runes with pagination. Returns rune name, symbol, supply, divisibility, mint terms, and etching info.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.listRunes({ offset, limit });
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
