# Development Guide

## Prerequisites

- Node.js ≥ 22.23 (tested with v24)
- pnpm ≥ 9 (tested with 12.18; `corepack enable pnpm` works)

## Commands

```bash
pnpm install            # install dependencies from the lockfile
pnpm dev                # dev server at http://localhost:4321/ChatWrapped/
pnpm build              # production build + precache manifest → dist/
pnpm preview            # serve dist/ locally (used by e2e)
pnpm check              # astro check (TypeScript diagnostics)
pnpm lint               # eslint
pnpm format             # prettier write / format:check for CI
pnpm test               # Vitest unit suites
pnpm test:e2e           # Playwright suites (desktop + mobile)
pnpm e2e:install        # one-time: install Playwright Chromium
pnpm screenshots        # capture real app screenshots (see below)
pnpm validate:readme    # verify every screenshot is embedded in README
```

## Testing

- **Unit (Vitest):** `tests/unit/` — parser fixtures, analytics with hand-computed expectations, response-rule
  boundaries, award thresholds, demo determinism, and a generated 8 MB performance case.
- **Browser (Playwright):** `tests/e2e/` — visitor journey (desktop + mobile viewports), privacy network audit,
  offline core workflow, export validation (PNG dimensions, ZIP integrity).
- E2E runs against the production build via `astro preview` (configured in `playwright.config.ts`).

## Screenshots

`scripts/capture-screenshots.mjs` drives the real application with the deterministic demo data and writes PNGs to
`docs/screenshots/…` plus `docs/screenshots/SCREENSHOT_INDEX.md` entries. Re-run it after UI changes.
`scripts/validate-readme-screenshots.py` cross-checks that every approved screenshot is embedded in the README and
that every referenced image exists (CI runs this).

## Offline verification

After `pnpm build && pnpm preview`, load the app once (the service worker precaches the build), then disconnect the
network and reload — the full import → analyze → story → card-download workflow must work. This exact flow is
automated in `tests/e2e/offline.spec.ts`.

## Adding a theme

1. Add a `ThemeTokens` entry in `src/features/themes/themes.ts`.
2. Pick a decoration type (or add one CSS class `theme-decor-…` in `src/styles/global.css` and the matching branch in
   `drawDecor` in the card renderer).
3. The dashboard, story viewer and card studio pick it up automatically.

## Adding a metric

1. Compute it in `src/features/analytics/engine.ts` (deterministic, no randomness).
2. Document it in `docs/analytics/METRIC_DEFINITIONS.md` — definition, exclusions, edge cases.
3. Add unit tests with hand-computed expected values (not implementation echoes).

## Conventions

- Conventional Commits (`feat(parser): …`), pushed per meaningful change.
- Prettier formatting (CI checks), ESLint for code quality, `astro check` for TypeScript.
- Never commit real chat exports — fixtures are synthetic (fictional names, generated text).
