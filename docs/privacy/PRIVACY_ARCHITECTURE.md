# Privacy Architecture

ChatWrapped’s privacy model is architectural, not promotional: a static site that physically has no server to receive
conversation data.

## Processing locations

| Stage            | Runs in                                      | Notes                                                         |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| File reading     | Browser (File API)                           | Text is decoded in-memory.                                    |
| Format detection | Main thread (first 32 KB sample)             | Content-based sniffing.                                       |
| Parsing          | **Web Worker**                               | WhatsApp TXT / Telegram JSON → normalized model.              |
| Analytics        | Main thread ≤ 20k messages, **Worker** above | Threshold avoids structured-clone overhead for typical files. |
| Story generation | Main thread                                  | Pure functions over the analytics result.                     |
| Card rendering   | Main thread (Canvas)                         | Fonts awaited via `document.fonts`; system emoji fallback.    |
| ZIP export       | Main thread (JSZip)                          | Blobs assembled locally.                                      |
| Persistence      | IndexedDB, **opt-in only**                   | Aggregate recap summaries — never message text.               |

## Network guarantees

- The application makes **zero third-party requests**: no fonts from CDNs (fonts are self-hosted via @fontsource and
  bundled), no analytics, no error reporting, no ads.
- **No request ever contains conversation content.** This is enforced by an automated audit —
  `tests/e2e/privacy.spec.ts` — which runs the full workflow (import → analytics → story → cards) with a network
  listener and fails if:
  - any request leaves the site’s origin, or
  - any request URL or body contains message text, or
  - any non-static-asset request is made, or
  - a WebSocket connection appears.
- Chat content never enters URLs (no query parameters carry message data).

## Storage model

| Data                  | Location                       | Lifetime                                   | Opt-in?                   |
| --------------------- | ------------------------------ | ------------------------------------------ | ------------------------- |
| Parsed conversations  | Tab memory (zustand)           | Until reload/close                         | No — default              |
| Raw export text       | Tab memory                     | Session only (enables date-order re-parse) | No — default              |
| Saved recap summaries | IndexedDB `chatwrapped/recaps` | Until deleted in Privacy Center            | **Yes**                   |
| App shell cache       | Service Worker `caches`        | Until version bump                         | Automatic (app code only) |

Saved recaps contain: name/title, platform, participant display names, message count, active-day count, date range,
top emoji, top word, busiest-day count, streak length. **No message text.** The Privacy Center lists every saved recap
with individual and bulk deletion.

## Hosting reality (honesty requirement)

GitHub Pages serves the static files and, like any web host, records standard operational request metadata (IP
address, user agent, timestamps) under its own policies. ChatWrapped adds nothing to that — no analytics endpoints,
no beacons, no third-party scripts — but we do not claim hosting infrastructure records “absolutely nothing”. The
privacy policy states this explicitly.

## Verification

- Automated: `tests/e2e/privacy.spec.ts` (network audit) and `tests/e2e/offline.spec.ts` (core workflow offline).
- Manual: browser DevTools network inspection during a full workflow shows only same-origin static asset requests.
- Code: no `fetch`/`XMLHttpRequest`/`WebSocket` usage exists outside static-asset needs; the worker client posts via
  `postMessage`, which never touches the network.
