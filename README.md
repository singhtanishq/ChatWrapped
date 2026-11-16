# ChatWrapped

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

| Platform         | Format                              | Status           |
| ---------------- | ----------------------------------- | ---------------- |
| WhatsApp Android | TXT (“Export chat → without media”) | ✅ v1.0          |
| WhatsApp iOS     | TXT (bracketed timestamps, 12h/24h) | ✅ v1.0          |
| Telegram Desktop | Machine-readable JSON               | ✅ v1.0          |
| Telegram Desktop | HTML export                         | ❌ future (v1.1) |
| WhatsApp         | Media ZIP                           | ❌ future (v1.1) |

Unsupported or ambiguous files produce precise error messages and transparent parser warnings — never silent
incomplete statistics.

## Privacy architecture

> Your uploaded conversations are processed entirely in your browser. ChatWrapped does not upload your chat files to
> its servers — there is no server that could receive them.

- Parsing and analytics run in **Web Workers** on your device; rendering happens on a Canvas.
- The app makes **zero third-party requests** — fonts, charts, themes and code are all bundled.
- An **automated network audit** in the test suite fails the build if any request ever carries message text or leaves
  the site's origin (`tests/e2e/privacy.spec.ts`).
- Nothing persists after the tab closes unless you explicitly save a recap **summary** (aggregates only — never
  message text) in IndexedDB; the Privacy Center can delete everything at any time.
- Hosting note (honesty): GitHub Pages records standard operational request metadata like any web host; ChatWrapped
  adds nothing to it. Full details: [docs/privacy/PRIVACY_ARCHITECTURE.md](docs/privacy/PRIVACY_ARCHITECTURE.md) and
  the [privacy policy](https://singhtanishq.github.io/ChatWrapped/privacy/).

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:4321/ChatWrapped/
pnpm build          # production build + precache manifest → dist/
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # browser tests (Playwright, desktop + mobile)
pnpm check          # TypeScript diagnostics
pnpm lint           # ESLint
```

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
see `docs/screenshots/SCREENSHOT_INDEX.md` for the full manifest with viewports and validation status.
Total: 45 approved screenshots, all embedded below.

## Landing page

### Hero with headline, privacy badge and the two CTAs (Create my ChatWrapped / S…

**Feature:** Landing page · `docs/screenshots/01-landing/landing-hero.png`

![Landing page — Hero with headline, privacy badge and the two CTAs (Create my ChatWrapped / See an example).](docs/screenshots/01-landing/landing-hero.png)

### Example recap preview cards and supported-platform positioning (illustrative…

**Feature:** Landing page · `docs/screenshots/01-landing/landing-example-cards.png`

![Landing page — Example recap preview cards and supported-platform positioning (illustrative values, clearly labeled).](docs/screenshots/01-landing/landing-example-cards.png)

### FAQ section with the privacy promise banner.

**Feature:** Landing page · `docs/screenshots/01-landing/landing-faq.png`

![Landing page — FAQ section with the privacy promise banner.](docs/screenshots/01-landing/landing-faq.png)

### Complete landing page: hero, example cards, platforms, how-it-works, FAQ and…

**Feature:** Landing page · `docs/screenshots/01-landing/landing-full.png`

![Landing page — Complete landing page: hero, example cards, platforms, how-it-works, FAQ and footer with independence disclaimer.](docs/screenshots/01-landing/landing-full.png)

## Import & validation

### Analyzer import screen with drag-and-drop zone and file guidance.

**Feature:** Import flow · `docs/screenshots/02-import/import-empty.png`

![Import flow — Analyzer import screen with drag-and-drop zone and file guidance.](docs/screenshots/02-import/import-empty.png)

### Precise error state for an unrecognized file (no vague errors).

**Feature:** Import flow — validation · `docs/screenshots/02-import/import-invalid-file.png`

![Import flow — validation — Precise error state for an unrecognized file (no vague errors).](docs/screenshots/02-import/import-invalid-file.png)

### Import result for a real WhatsApp group fixture with parser warnings and part…

**Feature:** Import flow — result preview · `docs/screenshots/02-import/import-result-warnings.png`

![Import flow — result preview — Import result for a real WhatsApp group fixture with parser warnings and participant counts.](docs/screenshots/02-import/import-result-warnings.png)

## Platform selection

### WhatsApp and Telegram platform cards with per-platform export instructions be…

**Feature:** Platform selection · `docs/screenshots/03-platform-selection/platform-cards.png`

![Platform selection — WhatsApp and Telegram platform cards with per-platform export instructions before choosing a file.](docs/screenshots/03-platform-selection/platform-cards.png)

## Participant setup & anonymization

### Setup screen: include/exclude participants, rename for presentation, mark you…

**Feature:** Participant setup · `docs/screenshots/04-participant-setup/setup-participants.png`

![Participant setup — Setup screen: include/exclude participants, rename for presentation, mark yourself, date range and filters.](docs/screenshots/04-participant-setup/setup-participants.png)

### Anonymization enabled: names become “Participant A/B” across the setup screen.

**Feature:** Participant setup — anonymization · `docs/screenshots/04-participant-setup/setup-anonymized.png`

![Participant setup — anonymization — Anonymization enabled: names become “Participant A/B” across the setup screen.](docs/screenshots/04-participant-setup/setup-anonymized.png)

## Analysis progress

### Parsing/analysis progress bar while workers process a 15 MB export.

**Feature:** Analysis progress · `docs/screenshots/05-analysis/analysis-progress.png`

![Analysis progress — Parsing/analysis progress bar while workers process a 15 MB export.](docs/screenshots/05-analysis/analysis-progress.png)

## Results dashboard

### Overview: message totals, monthly activity trend and participant share bar.

**Feature:** Results dashboard · `docs/screenshots/06-dashboard/dashboard-overview.png`

![Results dashboard — Overview: message totals, monthly activity trend and participant share bar.](docs/screenshots/06-dashboard/dashboard-overview.png)

### Participant comparison bars and the full per-participant breakdown table.

**Feature:** Participant statistics · `docs/screenshots/06-dashboard/dashboard-participants.png`

![Participant statistics — Participant comparison bars and the full per-participant breakdown table.](docs/screenshots/06-dashboard/dashboard-participants.png)

### Hour × weekday activity heatmap with weekday rhythm and hourly pulse charts.

**Feature:** Activity heatmap · `docs/screenshots/06-dashboard/dashboard-heatmap.png`

![Activity heatmap — Hour × weekday activity heatmap with weekday rhythm and hourly pulse charts.](docs/screenshots/06-dashboard/dashboard-heatmap.png)

### Most-used emoji ranking and stopword-filtered signature words with punctuatio…

**Feature:** Emoji & word insights · `docs/screenshots/06-dashboard/dashboard-emoji-words.png`

![Emoji & word insights — Most-used emoji ranking and stopword-filtered signature words with punctuation rates.](docs/screenshots/06-dashboard/dashboard-emoji-words.png)

### Response statistics with median/average/fastest values, leaderboard and the d…

**Feature:** Response-time analysis · `docs/screenshots/06-dashboard/dashboard-responses.png`

![Response-time analysis — Response statistics with median/average/fastest values, leaderboard and the documented burst-rule explainer.](docs/screenshots/06-dashboard/dashboard-responses.png)

### Records (longest message, busiest day, streak) and evidence-based participant…

**Feature:** Conversation records & awards · `docs/screenshots/06-dashboard/dashboard-records-awards.png`

![Conversation records & awards — Records (longest message, busiest day, streak) and evidence-based participant awards with explicit thresholds.](docs/screenshots/06-dashboard/dashboard-records-awards.png)

### Dashboard after applying a date range — totals update transparently.

**Feature:** Date-range filtering · `docs/screenshots/06-dashboard/dashboard-date-filtered.png`

![Date-range filtering — Dashboard after applying a date range — totals update transparently.](docs/screenshots/06-dashboard/dashboard-date-filtered.png)

## Personalized story experience

### Story opening slide with progress indicators, theme controls and navigation.

**Feature:** Story viewer · `docs/screenshots/07-story-experience/story-intro.png`

![Story viewer — Story opening slide with progress indicators, theme controls and navigation.](docs/screenshots/07-story-experience/story-intro.png)

### A mid-story slide driven by real calculated values (most-used emoji with share).

**Feature:** Story viewer · `docs/screenshots/07-story-experience/story-emoji-slide.png`

![Story viewer — A mid-story slide driven by real calculated values (most-used emoji with share).](docs/screenshots/07-story-experience/story-emoji-slide.png)

### Slide selector chips, autoplay control and progress state near the story finale.

**Feature:** Story navigation · `docs/screenshots/07-story-experience/story-slide-selector.png`

![Story navigation — Slide selector chips, autoplay control and progress state near the story finale.](docs/screenshots/07-story-experience/story-slide-selector.png)

### Full-screen story mode with keyboard navigation active.

**Feature:** Story fullscreen mode · `docs/screenshots/07-story-experience/story-fullscreen.png`

![Story fullscreen mode — Full-screen story mode with keyboard navigation active.](docs/screenshots/07-story-experience/story-fullscreen.png)

### The story experience working with the network disconnected — served entirely…

**Feature:** Offline support · `docs/screenshots/07-story-experience/offline-story.png`

![Offline support — The story experience working with the network disconnected — served entirely from the service worker cache.](docs/screenshots/07-story-experience/offline-story.png)

## All nine story themes

### Story viewer rendered with the Wrapped Neon theme (slide content from calcula…

**Feature:** Theme: Wrapped Neon · `docs/screenshots/08-story-themes/theme-wrapped-neon.png`

![Theme: Wrapped Neon — Story viewer rendered with the Wrapped Neon theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-wrapped-neon.png)

### Story viewer rendered with the Editorial theme (slide content from calculated…

**Feature:** Theme: Editorial · `docs/screenshots/08-story-themes/theme-editorial.png`

![Theme: Editorial — Story viewer rendered with the Editorial theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-editorial.png)

### Story viewer rendered with the Playful theme (slide content from calculated d…

**Feature:** Theme: Playful · `docs/screenshots/08-story-themes/theme-playful.png`

![Theme: Playful — Story viewer rendered with the Playful theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-playful.png)

### Story viewer rendered with the Midnight theme (slide content from calculated…

**Feature:** Theme: Midnight · `docs/screenshots/08-story-themes/theme-midnight.png`

![Theme: Midnight — Story viewer rendered with the Midnight theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-midnight.png)

### Story viewer rendered with the Retro theme (slide content from calculated dem…

**Feature:** Theme: Retro · `docs/screenshots/08-story-themes/theme-retro.png`

![Theme: Retro — Story viewer rendered with the Retro theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-retro.png)

### Story viewer rendered with the Pastel theme (slide content from calculated de…

**Feature:** Theme: Pastel · `docs/screenshots/08-story-themes/theme-pastel.png`

![Theme: Pastel — Story viewer rendered with the Pastel theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-pastel.png)

### Story viewer rendered with the Monochrome theme (slide content from calculate…

**Feature:** Theme: Monochrome · `docs/screenshots/08-story-themes/theme-monochrome.png`

![Theme: Monochrome — Story viewer rendered with the Monochrome theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-monochrome.png)

### Story viewer rendered with the Minimal Dark theme (slide content from calcula…

**Feature:** Theme: Minimal Dark · `docs/screenshots/08-story-themes/theme-minimal-dark.png`

![Theme: Minimal Dark — Story viewer rendered with the Minimal Dark theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-minimal-dark.png)

### Story viewer rendered with the Celebration theme (slide content from calculat…

**Feature:** Theme: Celebration · `docs/screenshots/08-story-themes/theme-celebration.png`

![Theme: Celebration — Story viewer rendered with the Celebration theme (slide content from calculated demo data).](docs/screenshots/08-story-themes/theme-celebration.png)

## Share Card Studio

### Card studio with live canvas preview, size selector, theme grid and customiza…

**Feature:** Share Card Studio · `docs/screenshots/09-share-studio/card-studio-portrait.png`

![Share Card Studio — Card studio with live canvas preview, size selector, theme grid and customization controls.](docs/screenshots/09-share-studio/card-studio-portrait.png)

### Customized card: headline override, caption and attribution toggle with the E…

**Feature:** Card customization · `docs/screenshots/09-share-studio/card-studio-customized.png`

![Card customization — Customized card: headline override, caption and attribution toggle with the Editorial theme.](docs/screenshots/09-share-studio/card-studio-customized.png)

### Square 1080×1080 card preview with export actions (PNG, native share, ZIP, co…

**Feature:** Card sizes · `docs/screenshots/09-share-studio/card-studio-square.png`

![Card sizes — Square 1080×1080 card preview with export actions (PNG, native share, ZIP, copy caption).](docs/screenshots/09-share-studio/card-studio-square.png)

## Conversation comparison

### Side-by-side comparison of two conversations (sample + an imported fixture) w…

**Feature:** Conversation comparison · `docs/screenshots/10-comparison/comparison-two-conversations.png`

![Conversation comparison — Side-by-side comparison of two conversations (sample + an imported fixture) with honest sample-size rows.](docs/screenshots/10-comparison/comparison-two-conversations.png)

## Privacy Center & policy

### Privacy Center dialog: local-processing guarantee, offline status, opt-in rec…

**Feature:** Privacy Center · `docs/screenshots/11-privacy/privacy-center.png`

![Privacy Center — Privacy Center dialog: local-processing guarantee, offline status, opt-in recap saving and session controls.](docs/screenshots/11-privacy/privacy-center.png)

### The full privacy policy page with storage model and hosting-transparency sect…

**Feature:** Privacy policy · `docs/screenshots/11-privacy/privacy-policy-page.png`

![Privacy policy — The full privacy policy page with storage model and hosting-transparency sections.](docs/screenshots/11-privacy/privacy-policy-page.png)

## Mobile experience

### Landing page on a phone viewport — hero, CTAs and navigation.

**Feature:** Mobile landing · `docs/screenshots/12-mobile/mobile-landing.png`

![Mobile landing — Landing page on a phone viewport — hero, CTAs and navigation.](docs/screenshots/12-mobile/mobile-landing.png)

### Import screen on mobile with touch-friendly upload zone.

**Feature:** Mobile import · `docs/screenshots/12-mobile/mobile-import.png`

![Mobile import — Import screen on mobile with touch-friendly upload zone.](docs/screenshots/12-mobile/mobile-import.png)

### Results dashboard adapts to the phone viewport with stacked stat cards.

**Feature:** Mobile dashboard · `docs/screenshots/12-mobile/mobile-dashboard.png`

![Mobile dashboard — Results dashboard adapts to the phone viewport with stacked stat cards.](docs/screenshots/12-mobile/mobile-dashboard.png)

### Full-screen story experience on mobile with swipe navigation and progress bars.

**Feature:** Mobile story · `docs/screenshots/12-mobile/mobile-story.png`

![Mobile story — Full-screen story experience on mobile with swipe navigation and progress bars.](docs/screenshots/12-mobile/mobile-story.png)

## Guides & metric documentation

### Step-by-step WhatsApp export instructions for Android and iPhone with HowTo s…

**Feature:** WhatsApp export guide · `docs/screenshots/13-guides/guide-whatsapp-export.png`

![WhatsApp export guide — Step-by-step WhatsApp export instructions for Android and iPhone with HowTo structured data.](docs/screenshots/13-guides/guide-whatsapp-export.png)

### Telegram Desktop JSON export walkthrough with troubleshooting section.

**Feature:** Telegram export guide · `docs/screenshots/13-guides/guide-telegram-export.png`

![Telegram export guide — Telegram Desktop JSON export walkthrough with troubleshooting section.](docs/screenshots/13-guides/guide-telegram-export.png)

### Public explanation of the normalized model, response burst rules, conversatio…

**Feature:** Metric documentation · `docs/screenshots/13-guides/how-analysis-works.png`

![Metric documentation — Public explanation of the normalized model, response burst rules, conversation starts and emoji counting.](docs/screenshots/13-guides/how-analysis-works.png)

## Documentation

| Document                                                                     | Contents                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)       | Static architecture, worker model, key decisions |
| [docs/parsers/PARSERS.md](docs/parsers/PARSERS.md)                           | WhatsApp/Telegram parsing, edge cases, limits    |
| [docs/analytics/METRIC_DEFINITIONS.md](docs/analytics/METRIC_DEFINITIONS.md) | Every metric's definition and rules              |
| [docs/privacy/PRIVACY_ARCHITECTURE.md](docs/privacy/PRIVACY_ARCHITECTURE.md) | What runs where, what's stored, what leaves      |
| [docs/development/DEVELOPMENT.md](docs/development/DEVELOPMENT.md)           | Setup, testing, screenshots, conventions         |
| [SCREENSHOT_INDEX.md](docs/screenshots/SCREENSHOT_INDEX.md)                  | Screenshot manifest                              |

## Testing & quality

- **86 unit tests** (Vitest): parser fixtures (Android/iOS/groups/multiline/emoji-heavy/edge cases), analytics with
  hand-computed expectations, response-rule boundaries, award thresholds, demo determinism, and a generated
  8 MB/170k-message performance case (~0.3 s parse, ~2.6 s analysis).
- **22 browser tests** (Playwright): full visitor journey on desktop and mobile viewports, privacy network audit,
  offline core workflow (reload offline → analyze → story → PNG download), and export validation (PNG signature +
  exact dimensions, ZIP central-directory integrity and card counts).
- **CI** (GitHub Actions): Prettier, ESLint, `astro check`, unit tests, production build, built-site link/asset
  validation, README screenshot validation, Playwright suites, weekly gitleaks secret scanning and dependency audit.
- **Deploy check**: every push to `main` rebuilds and republishes the site with a built-site validation step.

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
