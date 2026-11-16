/**
 * Post-build step: writes dist/precache-manifest.json listing every built
 * asset so the service worker can precache the complete app on install.
 * Run after `astro build`.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const BASE = "/ChatWrapped/";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const all = walk(DIST);
const assets = all
  .filter((f) => /\/_astro\//.test(f))
  .map((f) => BASE + relative(DIST, f).split("\\").join("/"));
const shell = [
  BASE,
  `${BASE}app/`,
  `${BASE}favicon.svg`,
  `${BASE}manifest.webmanifest`,
  `${BASE}robots.txt`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-maskable-512.png`,
];

writeFileSync(join(DIST, "precache-manifest.json"), JSON.stringify([...shell, ...assets]));
console.log(`precache manifest: ${shell.length} shell + ${assets.length} asset URLs`);
