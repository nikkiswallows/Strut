#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite into `_libs/electric-sql__pglite.mjs`
 * but does not copy the sibling WASM/data files it loads via import.meta.url.
 * Production `vite preview` (no DATABASE_URL) needs those files next to the
 * bundle so PGLite can boot.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@electric-sql/pglite/dist");
const dest = join(root, ".vercel/output/functions/__server.func/_libs");

if (!existsSync(dest)) {
  console.warn("[pglite-assets] skip — nitro output not present");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const file of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("[pglite-assets] copied wasm/data next to bundled pglite");
