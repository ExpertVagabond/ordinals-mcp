import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  ticker: z.string().optional().describe("Filter by BRC-20 ticker"),
  address: z.string().optional().describe("Filter by Bitcoin address"),
  operation: z
    .enum(["deploy", "mint", "transfer", "transfer_send"])
    .optional()
    .describe("Filter by operation type"),
  offset: z.number().optional().default(0).describe("Pagination offset"),
  limit: z.number().optional().default(20).describe("Results per page"),
});

export const getBrc20Activity: McpAction = {
  tool: {
    name: "get_brc20_activity",
    description:
      "Get BRC-20 token activity (deploy, mint, transfer events). Filter by ticker, address, or operation type.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const params = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getBrc20Activity(params);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
