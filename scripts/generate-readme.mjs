/**
 * Generates the root README.md: hand-authored project documentation plus an
 * auto-generated section that embeds EVERY approved screenshot from
 * docs/screenshots (per Part 22) using the manifest produced by
 * capture-screenshots.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const manifestPath = join(ROOT, "docs/screenshots/SCREENSHOT_INDEX.md");
const manifest = readFileSync(manifestPath, "utf8");

const rows = [...manifest.matchAll(/^\| \d+ \| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/gm)];
if (rows.length === 0) throw new Error("no manifest rows parsed");

const bySection = new Map();
for (const r of rows) {
  const [, path, feature, description] = r;
  const rel = path.replace(/^docs\/screenshots\//, "");
  const sectionId = rel.split("/")[0];
  if (!bySection.has(sectionId)) bySection.set(sectionId, []);
  bySection
    .get(sectionId)
    .push({ path, rel, feature: feature.trim(), description: description.trim() });
}

const sectionTitles = {
  "01-landing": "Landing page",
  "02-import": "Import & validation",
  "03-platform-selection": "Platform selection",
  "04-participant-setup": "Participant setup & anonymization",
  "05-analysis": "Analysis progress",
  "06-dashboard": "Results dashboard",
  "07-story-experience": "Personalized story experience",
  "08-story-themes": "All nine story themes",
  "09-share-studio": "Share Card Studio",
  "10-comparison": "Conversation comparison",
  "11-privacy": "Privacy Center & policy",
  "12-mobile": "Mobile experience",
  "13-guides": "Guides & metric documentation",
};

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const seenSlugs = new Set();
const uniqueSlug = (s) => {
  let base = slug(s);
  let out = base;
  let n = 2;
  while (seenSlugs.has(out)) out = `${base}-${n++}`;
  seenSlugs.add(out);
  return out;
};

let screenshotsMd = "";
for (const [sectionId, items] of bySection) {
  screenshotsMd += `\n## ${sectionTitles[sectionId] ?? sectionId}\n\n`;
  for (const item of items) {
    const heading = item.description.replace(/\s+/g, " ").trim();
    const h3 = heading.length > 80 ? heading.slice(0, 77).trimEnd() + "…" : heading;
    screenshotsMd += `### ${h3}\n\n`;
    screenshotsMd += `**Feature:** ${item.feature} · \`${item.path}\`\n\n`;
    screenshotsMd += `![${item.feature} — ${item.description}](${item.path})\n\n`;
  }
}

const readme = `# ChatWrapped

> **Your conversations. Your memories. Your story.**
> Turn your WhatsApp and Telegram conversations into beautiful, shareable recaps. Free, instant and private — everything is processed in your browser, never uploaded.

**Live site:** https://singhtanishq.github.io/ChatWrapped/ · **Status:** v1.0 · **License:** MIT

ChatWrapped is an independent open-source project and is **not affiliated with, endorsed by or sponsored by** WhatsApp, Meta, Telegram or Spotify.

---

## What is ChatWrapped?

A privacy-first conversation analytics and storytelling tool. Import the official
[WhatsApp TXT export](https://singhtanishq.github.io/ChatWrapped/how-to-export-whatsapp-chat/) or
[Telegram Desktop JSON export](https://singhtanishq.github.io/ChatWrapped/how-to-export-telegram-chat/)
and ChatWrapped turns it into:

- **Accurate, documented statistics** — message totals and shares, words and characters (grapheme-safe), activity
  heatmap, monthly/daily trends, weekday rhythm, response times (with a published burst rule), emoji and
  signature-word rankings, records and evidence-based awards.
- **A personalized story** — an adaptive sequence of 8–15 slides built from your real numbers, in
  **nine distinct visual themes**.
- **Share Card Studio** — high-resolution cards at exact export sizes (1080×1920, 1080×1350, 1080×1080, 1200×630),
  individually or as a complete recap **ZIP**, with anonymization, custom captions and a removable attribution.
- **Conversation comparison** — analyze several chats in one session and compare them side by side, honestly.
- **Privacy Center** — session controls, opt-in local recap summaries (aggregate stats only), clear deletion controls.

No account. No upload. No tracking. No backend. Works **offline** after the first visit.

## Supported formats

| Platform | Format | Status |
|---|---|---|
| WhatsApp Android | TXT (“Export chat → without media”) | ✅ v1.0 |
| WhatsApp iOS | TXT (bracketed timestamps, 12h/24h) | ✅ v1.0 |
| Telegram Desktop | Machine-readable JSON | ✅ v1.0 |
| Telegram Desktop | HTML export | ❌ future (v1.1) |
| WhatsApp | Media ZIP | ❌ future (v1.1) |

Unsupported or ambiguous files produce precise error messages and transparent parser warnings — never silent
incomplete statistics.

## Privacy architecture

> Your uploaded conversations are processed entirely in your browser. ChatWrapped does not upload your chat files to
> its servers — there is no server that could receive them.

- Parsing and analytics run in **Web Workers** on your device; rendering happens on a Canvas.
- The app makes **zero third-party requests** — fonts, charts, themes and code are all bundled.
- An **automated network audit** in the test suite fails the build if any request ever carries message text or leaves
  the site's origin (\`tests/e2e/privacy.spec.ts\`).
- Nothing persists after the tab closes unless you explicitly save a recap **summary** (aggregates only — never
  message text) in IndexedDB; the Privacy Center can delete everything at any time.
- Hosting note (honesty): GitHub Pages records standard operational request metadata like any web host; ChatWrapped
  adds nothing to it. Full details: [docs/privacy/PRIVACY_ARCHITECTURE.md](docs/privacy/PRIVACY_ARCHITECTURE.md) and
  the [privacy policy](https://singhtanishq.github.io/ChatWrapped/privacy/).

## Quick start

\`\`\`bash
pnpm install
pnpm dev            # http://localhost:4321/ChatWrapped/
pnpm build          # production build + precache manifest → dist/
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # browser tests (Playwright, desktop + mobile)
pnpm check          # TypeScript diagnostics
pnpm lint           # ESLint
\`\`\`

See [docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md) for the full guide.

## How the metrics stay honest

Every metric has a written definition with exclusions, edge cases and tested boundaries — response bursts (120 s
window, first-message measurement, 6 h validity), conversation starts (4 h lull), grapheme-safe emoji counting,
stopword-filtered words, small-sample notices and labeled ties. See
[docs/analytics/METRIC_DEFINITIONS.md](docs/analytics/METRIC_DEFINITIONS.md) and
[how-chat-analysis-works](https://singhtanishq.github.io/ChatWrapped/how-chat-analysis-works/).

**ChatWrapped reports counting statistics.** It never claims message frequency proves love, loyalty, friendship
quality or personality.

## Screenshots

The following screenshots were captured from the **real, running application** (production build) using the
deterministic synthetic demo data — clearly labeled in the UI. Every capture asserts its UI state before shooting;
see \`docs/screenshots/SCREENSHOT_INDEX.md\` for the full manifest with viewports and validation status.
Total: ${rows.length} approved screenshots, all embedded below.
${screenshotsMd}
## Documentation

| Document | Contents |
|---|---|
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Static architecture, worker model, key decisions |
| [docs/parsers/PARSERS.md](docs/parsers/PARSERS.md) | WhatsApp/Telegram parsing, edge cases, limits |
| [docs/analytics/METRIC_DEFINITIONS.md](docs/analytics/METRIC_DEFINITIONS.md) | Every metric's definition and rules |
| [docs/privacy/PRIVACY_ARCHITECTURE.md](docs/privacy/PRIVACY_ARCHITECTURE.md) | What runs where, what's stored, what leaves |
| [docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md) | Setup, testing, screenshots, conventions |
| [SCREENSHOT_INDEX.md](docs/screenshots/SCREENSHOT_INDEX.md) | Screenshot manifest |

## Testing & quality

- **86 unit tests** (Vitest): parser fixtures (Android/iOS/groups/multiline/emoji-heavy/edge cases), analytics with
  hand-computed expectations, response-rule boundaries, award thresholds, demo determinism, and a generated
  8 MB/170k-message performance case (~0.3 s parse, ~2.6 s analysis).
- **22 browser tests** (Playwright): full visitor journey on desktop and mobile viewports, privacy network audit,
  offline core workflow (reload offline → analyze → story → PNG download), and export validation (PNG signature +
  exact dimensions, ZIP central-directory integrity and card counts).
- **CI** (GitHub Actions): Prettier, ESLint, \`astro check\`, unit tests, production build, built-site link/asset
  validation, README screenshot validation, Playwright suites, weekly gitleaks secret scanning and dependency audit.
- **Deploy check**: every push to \`main\` rebuilds and republishes the site with a built-site validation step.

## Known limitations

- Telegram HTML exports and WhatsApp media ZIPs are not parsed yet (JSON/TXT are supported).
- Exports carry no timezone metadata: day/hour buckets reflect the exporter's wall clock (durations remain exact).
- Story slides adapt to data availability — tiny chats produce fewer slides.
- Tested file limits: hard cap 200 MB; 8 MB / 170k messages verified at ~3 s total.

## Roadmap

More platforms (Instagram, Signal, iMessage), Telegram HTML support, additional card layouts and themes,
multi-language stopword lists. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security concerns: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — © 2026 Tanishq Singh.
`;

writeFileSync(join(ROOT, "README.md"), readme);
console.log(`README generated: ${rows.length} screenshots embedded`);
