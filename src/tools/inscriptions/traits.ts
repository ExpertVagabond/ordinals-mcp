import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as ordiscan from "../../clients/ordiscan.js";

const schema = z.object({
  id: z.string().describe("Inscription ID ({txid}i{index})"),
});

export const getInscriptionTraits: McpAction = {
  tool: {
    name: "get_inscription_traits",
    description:
      "Get trait information for a collection inscription. Returns trait types and values (e.g., background, body, eyes).",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { id } = schema.parse(request.params.arguments);
    try {
      const data = await ordiscan.getInscriptionTraits(id);
      return textResult(data);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
