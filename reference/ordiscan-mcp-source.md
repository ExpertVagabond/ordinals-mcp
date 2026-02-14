# ordiscan-mcp Source Reference

> Key source code from the existing ordiscan-mcp for reference when building

## Package Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.8.0",
    "ordiscan": "^1.1.0",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "esbuild": "^0.25.2",
    "typescript": "^5.3.3"
  }
}
```

## Build Script (esbuild bundle)

```
tsc && esbuild build/index.js --bundle --platform=node --outfile=build/index.bundled.js && mv build/index.bundled.js build/index.js && node -e "require('fs').chmodSync('build/index.js', '755')"
```

## Client Wrapper (`src/ordiscan-client.ts`)

```typescript
import { Ordiscan } from "ordiscan";

export const getOrdiscanClient = () => {
  if (!process.env.ORDISCAN_API_KEY) {
    console.error("Error: ORDISCAN_API_KEY environment variable is required");
    process.exit(1);
  }
  return new Ordiscan(process.env.ORDISCAN_API_KEY);
};

export const ORDISCAN_URL = "https://ordiscan.com";
```

## Type Pattern (`src/types.ts`)

```typescript
import {
  CallToolRequest,
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";

type Tool = ListToolsResult["tools"][0];
export type ToolInputSchema = Tool["inputSchema"];

export interface McpAction {
  tool: Tool;
  handler: (request: CallToolRequest) => Promise<CallToolResult>;
}
```

## Source Structure

```
src/
  index.ts              # Server entry
  ordiscan-client.ts    # API client wrapper
  types.ts              # McpAction interface
  actions/
    {category}/         # One file per tool
```

## Key Patterns to Reuse

1. **McpAction interface** — Clean tool+handler pattern
2. **Zod schemas** for input validation
3. **esbuild bundle** for single-file distribution
4. **Environment variable gating** for optional API keys
5. **Category-based tool organization** in subdirectories
