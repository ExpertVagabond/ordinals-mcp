import { build } from "esbuild";
import { chmodSync } from "fs";

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

import { renameSync } from "fs";
renameSync("build/index.bundled.js", "build/index.js");
chmodSync("build/index.js", 0o755);

console.log("Build complete: build/index.js");
