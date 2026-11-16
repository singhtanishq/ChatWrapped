# Contributing to ChatWrapped

Thank you for helping make chat recaps better! ChatWrapped is an independent, open-source, privacy-first project.

## Ground rules

1. **Never commit real chat exports.** All fixtures under `tests/fixtures/` must be synthetic (fictional names,
   generated text). Do not open issues with attached conversations — use the existing fixtures or craft a minimal
   synthetic reproduction.
2. **Keep privacy architectural.** No feature may introduce a network request containing conversation content, or any
   third-party script. The automated network audit (`tests/e2e/privacy.spec.ts`) must keep passing.
3. **Keep metrics honest.** New metrics need a written definition in `docs/analytics/METRIC_DEFINITIONS.md` and unit
   tests with hand-computed expected values. Never imply statistics measure affection or personality.

## Workflow

```bash
pnpm install
pnpm dev          # work against http://localhost:4321/ChatWrapped/
pnpm check        # TypeScript diagnostics
pnpm lint         # ESLint
pnpm format:check # Prettier
pnpm test         # unit tests
pnpm build && pnpm preview
pnpm test:e2e     # browser suites (needs `pnpm e2e:install` once)
```

- Branch from `main`, use Conventional Commit messages (`feat(parser): …`).
- Update documentation when behavior changes.
- Run the full check suite before opening a PR; CI mirrors it (lint, typecheck, unit tests, build, e2e where
  configured, secret scan, README screenshot validation).

## Good first contributions

- Parser fixtures for locales/devices not covered yet (synthetic only).
- Additional visual themes (see `docs/development/DEVELOPMENT.md`).
- Stopword lists for more languages (used by word rankings).
- Documentation improvements — export guides especially, as platform UIs change.
