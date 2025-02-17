import * as esbuild from "esbuild";

const isDev = process.env.NODE_ENV !== "production";

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  outdir: "dist",
  format: "esm",
  sourcemap: isDev,
  minify: !isDev,
  external: [
    "express",
    "socket.io",
    "dotenv",
    "cors",
    "helmet",
    "redis",
    "zod",
    "@paralleldrive/cuid2",
  ],
  banner: {
    js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);',
  },
  alias: {
    "@": "./src",
  },
  nodePaths: [".", "../shared/src"],
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
} else {
  await esbuild.build(config);
}
