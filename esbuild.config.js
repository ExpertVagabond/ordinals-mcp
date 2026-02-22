import { build } from "esbuild";
import { chmodSync, existsSync } from "fs";
import { renameSync } from "fs";

// Bundle main MCP stdio server
await build({
  entryPoints: ["build/index.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "build/index.bundled.js",
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [],
});

renameSync("build/index.bundled.js", "build/index.js");
chmodSync("build/index.js", 0o755);
console.log("Build complete: build/index.js");

// HTTP proxy server uses tsc output directly (not bundled)
// Express uses CJS require() internally which breaks ESM bundling
if (existsSync("build/http-server.js")) {
  console.log("HTTP server: build/http-server.js (tsc, unbundled)");
}
