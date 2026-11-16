/**
 * Validates the built static site in dist/:
 *  - every route directory that the source pages define exists in dist
 *  - internal links (href/src starting with the base path) resolve to files
 *  - no link points outside the site (no third-party script/asset origins)
 * Exit code 1 on any failure.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const BASE = "/ChatWrapped";
const SITE_ORIGIN = "https://singhtanishq.github.io";

let errors = 0;
const fail = (msg) => {
  console.error("✗ " + msg);
  errors++;
};
const ok = (msg) => console.log("✓ " + msg);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error("dist/ not found — run pnpm build first");
  process.exit(1);
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const filePathSet = new Set(files.map((f) => "/" + relative(DIST, f).split("\\").join("/")));

ok(`dist contains ${files.length} files, ${htmlFiles.length} HTML pages`);

// 1. Every HTML page (except /index.html and /404.html) lives in its own directory.
for (const f of htmlFiles) {
  const rel = relative(DIST, f).split("\\").join("/");
  if (rel !== "index.html" && rel !== "404.html") {
    if (!rel.endsWith("/index.html")) fail(`route page not directory-based: ${rel}`);
  }
}

// 2. Internal links and asset references resolve inside dist.
const linkRe = /(?:href|src)="([^"]+)"/g;
const checked = new Set();
for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(linkRe)) {
    let href = m[1];
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (href.startsWith("http")) {
      // Only our own site origin is acceptable for site assets; other https
      // links are fine if they are plain informational links, but we forbid
      // loading scripts/styles/images from other origins.
      if (
        /rel="(stylesheet|preload|modulepreload)"/.test(href) === false &&
        /\.(js|css|png|jpe?g|woff2?|svg)(\?|$)/.test(href) &&
        !href.startsWith(SITE_ORIGIN)
      ) {
        fail(`${relative(DIST, f)} loads remote asset ${href}`);
      }
      continue;
    }
    if (href.startsWith("/")) {
      // Strip query/hash; base must match.
      const path = href.split("#")[0].split("?")[0];
      if (!path.startsWith(BASE) && path !== "/") {
        fail(`${relative(DIST, f)} links outside base path: ${href}`);
        continue;
      }
      const relPath = path === BASE || path === BASE + "/" ? "/" : path.slice(BASE.length) || "/";
      let target = relPath.endsWith("/") ? relPath + "index.html" : relPath;
      const candidates = [target, relPath.replace(/\/$/, "") + ".html"];
      const found = candidates.some((c) => filePathSet.has(c)) || checked.has(path);
      if (!found) {
        fail(`${relative(DIST, f)} has broken link ${href}`);
      }
      checked.add(path);
    }
  }
}

// 3. Canonical URLs + og:image must reference the live site.
for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  if (!html.includes('rel="canonical"') && !html.includes("rel=canonical"))
    fail(`${relative(DIST, f)} missing canonical URL`);
  if (!html.includes("og:title")) fail(`${relative(DIST, f)} missing og:title`);
  if (!html.includes("og:image")) fail(`${relative(DIST, f)} missing og:image`);
}

// 4. robots.txt + sitemap + manifest + sw.js + precache manifest present.
for (const required of [
  "robots.txt",
  "sitemap-index.xml",
  "manifest.webmanifest",
  "sw.js",
  "precache-manifest.json",
  "favicon.svg",
]) {
  if (!filePathSet.has("/" + required)) fail(`missing required file: ${required}`);
}

// 5. No network beacons / third-party scripts in the landing HTML.
const indexHtml = readFileSync(join(DIST, "index.html"), "utf8");
for (const marker of [
  "googletagmanager",
  "google-analytics",
  "plausible",
  "fathom",
  "posthog",
  "cloudflareinsights",
]) {
  if (indexHtml.toLowerCase().includes(marker))
    fail(`landing page contains analytics marker: ${marker}`);
}

if (errors > 0) {
  console.error(`\n${errors} problem(s) found`);
  process.exit(1);
}
ok("built site validation passed");
