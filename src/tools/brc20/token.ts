import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  ticker: z.string().describe("BRC-20 token ticker (e.g., ordi, sats)"),
});

export const getBrc20Token: McpAction = {
  tool: {
    name: "get_brc20_token",
    description:
      "Get details for a BRC-20 token by ticker. Returns max supply, minted supply, mint limit, decimals, deploy inscription, and transaction count.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { ticker } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getBrc20Token(ticker);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
