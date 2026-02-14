import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  ordinal: z.string().describe("Satoshi ordinal number (e.g., 1857578125803250)"),
});

export const getSatInfo: McpAction = {
  tool: {
    name: "get_sat_info",
    description:
      "Get information about a specific satoshi by its ordinal number. Returns rarity level, epoch, cycle, period, name, and any inscription on it.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { ordinal } = schema.parse(request.params.arguments);
    try {
      const data = await hiro.getSatInfo(ordinal);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
