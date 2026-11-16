# Parser Documentation

Both parsers produce the same normalized model (`src/features/types.ts`):

```ts
interface ChatMessage {
  id: string;
  participantId: string;
  timestamp: number | null; // wall-clock-as-UTC epoch ms
  text: string;
  type: "text" | "media" | "system" | "unknown";
  isSystemMessage: boolean;
  hasAttachment: boolean;
  sourceIndex: number;
}
```

Timestamps are interpreted as **source wall-clock time expressed as UTC** — a constant-offset scheme that keeps
durations correct and buckets faithful without inventing a timezone. See METRIC_DEFINITIONS.md for the full rationale.

## WhatsApp TXT (`src/features/parsers/whatsapp.ts`)

### Line shapes

| Platform       | Shape                                   | Example                            |
| -------------- | --------------------------------------- | ---------------------------------- |
| iOS            | `[DD/MM/YY, HH:MM[:SS]] Sender: text`   | `[25/12/2023, 10:05:12] Alice: Hi` |
| Android        | `M/D/YYYY, H:MM[ AM/PM] - Sender: text` | `12/25/2023, 9:14 PM - Bob: Hey`   |
| Dotted locales | `DD.MM.YYYY, HH:MM - …`                 | `25.12.2023, 21:14 - …`            |

### Behavior

- **Continuation lines** (no timestamp prefix) are appended to the previous message — multiline and pasted text stay
  intact. Lines before the first timestamped line are treated as export headers (up to 5, then warned).
- **Bare date separators** (old Android exports) are skipped and counted in a warning.
- **Date order** (day-first vs month-first): all timestamps are pre-scanned; a first component > 12 proves DD/MM, a
  second component > 12 proves MM/DD. Ambiguous files default to day-first **and surface a warning plus an in-app
  DD/MM ↔ MM/DD toggle** that re-parses instantly. Four-digit leading components are treated as year-first.
- **Sender detection**: content is split at the _first_ `": "` so colons inside messages don’t create phantom senders.
- **System events**: encryption notices, group events, missed calls and deletion markers (including sender-prefixed
  “You deleted this message”) are marked `isSystemMessage` and excluded from eligible totals by default.
- **Attachments**: `<Media omitted>`, `image omitted`, `(file attached)` and friends are classified as media events;
  the placeholder is stripped so captions can still be analyzed.
- **Unicode**: bidi marks (`U+200E`/`U+200F`, embedding controls) are stripped; emoji pass through untouched.
- **Chronology warnings**: big backwards jumps produce a warning suggesting the date-order toggle.

## Telegram JSON (`src/features/parsers/telegram.ts`)

- Validates the file is a Telegram export (`messages` array); otherwise raises clear errors for malformed JSON or
  foreign JSON.
- Flattens `text` parts (plain, links, mentions, hashtags, custom emoji, bot commands) into analyzable text.
- Attachment fields (`photo`, `video`, `video_note`, `voice_message`, `audio_file`, `sticker_emoji`, `animation`,
  `file`) mark media events; sticker emoji becomes the message text; captions are preserved.
- `type: "service"` entries become system events, attributed to the `actor` when present.
- Anonymous admins (`from_id` without `from`) resolve via `actor`.
- Messages with missing dates are kept with `timestamp: null` and excluded from time metrics with a warning.
- Forwarded messages are attributed to the forwarder; one warning notes this policy.
- Malformed (non-object) entries are skipped with a warning.

## Detection (`src/features/parsers/detect.ts`)

Content-based (not extension-based):

1. Leading `{` → try a JSON probe; a `messages` array means Telegram JSON.
2. Otherwise, timestamped-line ratio > 50% means WhatsApp TXT.
3. Telegram HTML and email/mbox shapes produce precise “not supported” messages.
4. Anything else → `unknown` with a generic explanation.

## Limits

- Hard limit: **200 MB** (rejected with a clear error).
- Soft notice above **10 MB**.
- Tested performance: an 8 MB / 170k-message WhatsApp export parses in ~0.3 s and analyzes in ~2.6 s
  (see `tests/unit/large-file.test.ts`).

## Fixtures & tests

`tests/fixtures/` contains **synthetic** conversations only (fictional names, generated messages) covering Android,
iOS, groups, multiline, emoji-heavy (ZWJ/skins/flags/keycaps), and edge cases; the Telegram side covers personal,
group and edge-case exports. 54 parser assertions live in `tests/unit/whatsapp-parser.test.ts` and
`tests/unit/telegram-parser.test.ts`.
