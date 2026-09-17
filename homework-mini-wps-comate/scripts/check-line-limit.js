#!/usr/bin/env node
/**
 * Fail if any source file exceeds 1000 lines.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const LIMIT = 1000;
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".mjs", ".cjs"]);
const SKIP = new Set(["node_modules", "dist", ".git", "build-resources"]);

/** @type {Array<{ file: string, lines: number }>} */
const offenders = [];
/** @type {Array<{ file: string, lines: number }>} */
const ranked = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXTS.has(path.extname(name))) continue;
    const text = fs.readFileSync(full, "utf8");
    const lines = text.length ? text.split(/\r?\n/).length : 0;
    const rel = path.relative(ROOT, full);
    ranked.push({ file: rel, lines });
    if (lines > LIMIT) offenders.push({ file: rel, lines });
  }
}

walk(ROOT);
ranked.sort((a, b) => b.lines - a.lines);

console.log(`Line limit: ${LIMIT}`);
console.log("Top files:");
for (const item of ranked.slice(0, 10)) {
  console.log(`  ${String(item.lines).padStart(4)}  ${item.file}`);
}

if (offenders.length) {
  console.error("\nExceeds limit:");
  for (const item of offenders) {
    console.error(`  ${item.lines}  ${item.file}`);
  }
  process.exit(1);
}

console.log("\nOK: no file exceeds 1000 lines.");
