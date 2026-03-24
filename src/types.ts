import type {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import {
  sanitizeError as psmSanitizeError,
  OutputFilter,
  defaultFilter,
  AuditLogger,
  validateNoInjection,
} from "@psm/mcp-core-ts";

// Re-export psm-mcp-core-ts utilities for use across the codebase
export { validateNoInjection, OutputFilter, defaultFilter, AuditLogger };
export type { FilterResult, Redaction } from "@psm/mcp-core-ts";

type Tool = ListToolsResult["tools"][0];

export type ToolInputSchema = Tool["inputSchema"];

export interface McpAction {
  tool: Tool;
  handler: (request: CallToolRequest) => Promise<CallToolResult>;
}

/** Shared OutputFilter instance — redacts secrets and PII from all tool output. */
export const outputFilter = new OutputFilter(true, true);

/** Shared AuditLogger instance for cross-tool audit trail. */
export const auditLog = new AuditLogger();

export function textResult(data: unknown): CallToolResult {
  const raw = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const filtered = outputFilter.filter(raw);
  return {
    content: [
      {
        type: "text",
        text: filtered.text,
      },
    ],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Redact file paths and internal details from error messages.
 * Delegates to psm-mcp-core-ts sanitizeError() for consistent redaction.
 */
export function redactError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return psmSanitizeError(msg, 500);
}
