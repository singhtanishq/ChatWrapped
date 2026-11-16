/**
 * Generates PWA icons and the social preview image from the app SVG,
 * using headless Chromium (no native image deps required).
 *
 * Outputs:
 *   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
 *   public/images/og-default.png (1200x630)
 */
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const svg = readFileSync(join(ROOT, "public/favicon.svg"), "utf8");

const iconHtml = (size, maskable) => `<!doctype html>
<html><head><style>html,body{margin:0;padding:0;}</style></head>
<body>
<div id="wrap" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${maskable ? "linear-gradient(135deg,#2e1065,#4c0d3c)" : "transparent"};">
  <div style="width:${maskable ? size * 0.62 : size}px;height:${maskable ? size * 0.62 : size}px">${svg.replace("<svg ", `<svg width="100%" height="100%" `)}</div>
</div>
</body></html>`;

const ogHtml = `<!doctype html>
<html><head><style>
html,body{margin:0;padding:0;background:#0b0910;width:1200px;height:630px;overflow:hidden}
*{box-sizing:border-box}
</style></head>
<body style="width:1200px;height:630px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;font-family:sans-serif">
<div style="position:absolute;top:-160px;right:-120px;width:520px;height:520px;border-radius:50%;background:#7c3aed;filter:blur(130px);opacity:.55"></div>
<div style="position:absolute;bottom:-160px;left:-120px;width:520px;height:520px;border-radius:50%;background:#fb923c;filter:blur(130px);opacity:.4"></div>
<div style="display:flex;align-items:center;gap:28px;z-index:2">
  <div style="width:150px;height:150px">${svg.replace("<svg ", `<svg width="100%" height="100%" `)}</div>
  <div>
    <div style="color:#fff;font-size:92px;font-weight:800;letter-spacing:-2px">ChatWrapped</div>
    <div style="color:#e879f9;font-size:34px;font-weight:600;margin-top:10px">Your chats have a story. Let's unwrap it.</div>
    <div style="color:#a1a1aa;font-size:26px;margin-top:16px">Private · local · free — WhatsApp & Telegram recaps</div>
  </div>
</div>
</body></html>`;

async function shoot(html, outPath, width, height) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log("wrote", outPath);
}

const jobs = [
  [iconHtml(192, false), join(ROOT, "public/icons/icon-192.png"), 192, 192],
  [iconHtml(512, false), join(ROOT, "public/icons/icon-512.png"), 512, 512],
  [iconHtml(512, true), join(ROOT, "public/icons/icon-maskable-512.png"), 512, 512],
  [ogHtml, join(ROOT, "public/images/og-default.png"), 1200, 630],
];

for (const [html, out, w, h] of jobs) {
  mkdirSync(dirname(out), { recursive: true });
  await shoot(html, out, w, h);
}
console.log("done");
