import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult, redactError } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  slug: z.string().min(1).max(128).describe("Collection slug/symbol"),
  offset: z.number().int().min(0).optional().default(0).describe("Pagination offset"),
  limit: z.number().int().min(1).max(60).optional().default(20).describe("Results per page"),
});

export const getCollectionInscriptions: McpAction = {
  tool: {
    name: "get_collection_inscriptions",
    description:
      "List inscriptions in an Ordinals collection. Returns inscription IDs, numbers, content types, and owners.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { slug, offset, limit } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getCollectionInscriptions(slug, offset, limit);
      return textResult(data);
    } catch (e) {
      return errorResult(redactError(e));
    }
  },
};
