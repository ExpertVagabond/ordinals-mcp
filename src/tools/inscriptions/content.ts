import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import * as hiro from "../../clients/hiro.js";

const schema = z.object({
  id: z.string().describe("Inscription ID ({txid}i{index}) or inscription number"),
});

export const getInscriptionContent: McpAction = {
  tool: {
    name: "get_inscription_content",
    description:
      "Get the raw content of a Bitcoin Ordinals inscription. Returns text content directly or base64-encoded binary data with content type.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const { id } = schema.parse(request.params.arguments);
    try {
      const { contentType, data } = await hiro.getInscriptionContent(id);
      return textResult({ content_type: contentType, data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};
