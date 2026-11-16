# ChatWrapped Architecture

ChatWrapped is a **fully static** client-side application. There is no backend, no remote database, no server-side
rendering and no third-party API dependency. Everything a visitor does happens in their browser.

```
Static Astro site (SEO pages, guides, landing)
        │
        ▼
React island  ──►  /app analyzer SPA (hash-routed steps)
        │
        ▼
Import (File API, drag & drop)
        │
        ▼
Format detection (content-based)
        │
        ▼
Parser Worker  ──►  WhatsApp TXT / Telegram JSON
        │
        ▼
Normalized conversation model (src/features/types.ts)
        │
        ▼
Analytics (sync for small data, Worker for >20k messages)
        │
        ├─►  Dashboard (custom SVG charts)
        ├─►  Story engine (adaptive slides, 9 themes)
        ├─►  Card Studio (Canvas renderer → PNG / ZIP)
        └─►  Comparison view
```

## Key decisions

| Decision                                               | Rationale                                                                                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro 7 + React islands**                            | Static SEO pages with a single hydrated analyzer island; minimal shipped JS for content pages.                                                                                                                                    |
| **One SPA for the workflow**                           | The import → setup → dashboard → story → cards flow shares state (zustand) and avoids full page loads. Hash routing works on GitHub Pages without server rewrites.                                                                |
| **Web Workers for parsing & analytics**                | Keeps the UI responsive for large exports; typed, versioned protocol (`src/workers/protocol.ts`). Analytics runs in the main thread for ≤ 20k messages to avoid expensive structured-clone round trips, in the worker above that. |
| **Custom SVG charts, no chart library**                | Charts must match the theme system exactly and be reusable inside the Canvas card renderer; dependencies stay lean.                                                                                                               |
| **Canvas card renderer reading theme tokens directly** | Exported PNGs are pixel-identical in layout to the live viewer — one source of truth (`src/features/themes/themes.ts`).                                                                                                           |
| **Wall-clock-as-UTC timestamps**                       | Exports carry local wall-clock time with no timezone. Interpreting it as UTC gives correct durations and faithful day/hour buckets without inventing a timezone. See `docs/analytics/METRIC_DEFINITIONS.md`.                      |
| **In-memory by default, IndexedDB opt-in**             | Privacy: nothing persists unless the user explicitly saves a recap summary (aggregates only, never message text).                                                                                                                 |
| **Service worker with build-time precache manifest**   | `scripts/write-precache.mjs` lists every built asset after `astro build`; the worker precaches it on install, making the core workflow fully offline-capable.                                                                     |

## Repository layout

```
src/
  app/            React SPA (store, shell, step components)
  components/
    astro/        Shared site nav/footer, content typography
    ui/           Accessible primitives (buttons, dialogs, toggles…)
    charts/       Custom SVG charts
  features/
    parsers/      WhatsApp TXT, Telegram JSON, detection
    analytics/    Engine, response rules, awards
    stories/      Adaptive slide generation
    themes/       9 theme token sets (single source of truth)
    sharing/      Canvas card renderer, PNG/ZIP export
    comparison/   Cross-conversation comparison
    privacy/      Opt-in IndexedDB recap store
    demo/         Deterministic synthetic sample data
  workers/        parser.worker.ts, analytics.worker.ts, protocol.ts
  lib/            Emoji/word utilities, formatting, worker client, RNG
  layouts/        PageLayout.astro (SEO metadata, chrome)
  pages/          Static routes (landing, guides, privacy, 404…)
  styles/         Global CSS (design tokens, theme surfaces)
public/           sw.js, icons, manifest, robots.txt
tests/
  fixtures/       Synthetic parser fixtures (never real chats)
  unit/           Vitest suites (parsers, analytics, demo, perf)
  e2e/            Playwright journey, offline, privacy-audit, export specs
scripts/          Build helpers (precache manifest, icon generation,
                  screenshot capture, README validation)
docs/             Architecture, metrics, parsers, privacy, development
```

## Data flow guarantees

- **No network request contains conversation content.** Verified by an automated Playwright audit
  (`tests/e2e/privacy.spec.ts`) that fails the build if any request body/URL contains message text or any
  non-same-origin request occurs during the full workflow.
- **No persistence by default.** Parsed conversations live in React state only.
- **Deterministic demo data.** The sample conversations are generated from a seeded PRNG, making screenshots and
  tests repeatable.

## Build & deploy

`pnpm build` → `astro build` + `scripts/write-precache.mjs`. GitHub Actions (`.github/workflows/deploy.yml`) builds and
deploys `dist/` to GitHub Pages with the official `actions/deploy-pages` action. The site is served from
`https://singhtanishq.github.io/ChatWrapped/`.
