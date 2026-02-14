import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  ticker: z.string().describe("BRC-20 token ticker (e.g., ordi, sats)"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page"),
});

export const getBrc20Holders: McpAction = {
  tool: {
    name: "get_brc20_holders",
    description:
      "Get top holders of a BRC-20 token. Returns addresses and balances sorted by amount held.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { ticker, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getBrc20Holders(ticker, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
