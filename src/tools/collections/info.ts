import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  slug: z.string().describe("Collection slug/symbol (e.g., bitcoin-puppets, nodemonkes)"),
});

export const getCollectionInfo: McpAction = {
  tool: {
    name: "get_collection_info",
    description:
      "Get details for an Ordinals collection. Returns name, description, inscription count, floor price, volume, and owner count.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { slug } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getCollectionInfo(slug);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
