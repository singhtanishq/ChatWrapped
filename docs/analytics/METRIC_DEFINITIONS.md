# ChatWrapped — Metric Definitions

Every statistic shown in ChatWrapped is calculated from the **normalized
conversation model** produced by the parsers. Nothing is hardcoded or
fabricated. This document defines each metric precisely, including
exclusions, time interpretation, sample-sufficiency rules and edge cases.

The same input always produces the same output: analytics are pure,
deterministic functions with no randomness or hidden state.

---

## 1. The eligible message pool

All metrics are computed over the **eligible message pool** unless stated
otherwise. A message is eligible when **all** of the following hold:

1. Its participant has not been excluded by the user.
2. It is **not a system message** (encryption notices, group events, call
   events, deletion markers) — unless the user explicitly includes them in
   the Privacy Center.
3. It is not excluded as an attachment event, when the user chooses to
   exclude them.
4. Its timestamp falls inside the selected date range, when a range is set.

The dashboard always shows the raw parsed totals next to the eligible totals
so exclusions are transparent.

## 2. Timestamp interpretation

Chat exports store **local wall-clock time with no timezone metadata**.

ChatWrapped interprets every wall-clock timestamp as if it were UTC
("constant-offset interpretation"):

- **Correct durations:** because every timestamp carries the same (zero)
  offset, differences between timestamps equal the true elapsed time.
- **Faithful buckets:** the day, weekday and hour of a message match what
  the sender saw on their clock.
- **No invented timezones:** when the source has no timezone, none is added.

Consequences: relative metrics (response times, gaps, streaks) are exact;
absolute metrics (hours, weekdays) are exact for the exporter's clock and
would shift for a reader in another timezone. This is a display property of
the source data, not an error.

### WhatsApp date-order handling

WhatsApp TXT exports use either `DD/MM/YYYY` (most of the world) or
`MM/DD/YYYY` (US-style locales). ChatWrapped:

1. Scans every timestamp for **unambiguous evidence** — a first component
   greater than 12 proves day-first; a second component greater than 12
   proves month-first.
2. Applies the resolved order to the whole file.
3. When no unambiguous evidence exists (e.g. all dates have both components
   ≤ 12), the file defaults to day-first and a warning is shown. The import
   screen offers an explicit DD/MM ↔ MM/DD toggle that re-parses instantly.

2-digit years are interpreted as 2000+. Four-digit leading components are
treated as year-first (`YYYY/MM/DD`).

### Telegram

Telegram Desktop JSON exports include a local wall-clock `date` string and a
UTC epoch (`date_unixtime`). ChatWrapped uses the wall-clock string (same
constant-offset interpretation) so bucket behavior matches WhatsApp exports.

## 3. Basic statistics

| Metric                        | Definition                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligible messages             | Size of the eligible pool.                                                                                                                                      |
| Total participants            | Distinct non-system participants, after exclusions.                                                                                                             |
| Total words                   | Word-like tokens per ICU word segmentation (locale-aware), including stopwords. Numbers count as words.                                                         |
| Total characters              | Grapheme clusters (user-perceived characters), not UTF-16 code units. Spaces included. Media messages with stripped placeholders contribute their caption only. |
| Average message length        | Total characters ÷ eligible messages.                                                                                                                           |
| Active days                   | Distinct calendar days containing at least one eligible message.                                                                                                |
| First / last eligible message | Earliest / latest eligible timestamp.                                                                                                                           |

Media placeholders (`<Media omitted>`, `(file attached)`, sticker exports,
etc.) are classified as **attachment events**: they count toward media
counts, not toward word/character/emoji analytics (their captions do).

## 4. Participant analytics

- **Messages per participant** — eligible messages attributed to each
  participant. Deleted messages ("You deleted this message") are system
  events attributed to the sender but excluded from totals.
- **Message share** = participant eligible messages ÷ all eligible
  messages × 100.
- **Word count per participant** — words in that participant's eligible text.
- **Average message length** — participant characters ÷ participant messages.
- **Most active participant** — highest eligible message count. Ties are
  labeled as ties.

## 5. Time analytics

- **Busiest month / day** — calendar month / day with the most eligible
  messages. Ties resolve to the earliest, and are labeled in the UI when
  displayed as records.
- **Most active hour** — hour of day (0–23, wall clock) with the most
  eligible messages.
- **Weekday vs weekend** — share of eligible messages on Saturday/Sunday.
- **Monthly / daily trend** — eligible message counts per calendar month/day.
- **Hour × weekday heatmap** — eligible message counts per weekday-hour cell.
- **Longest active-day streak** — longest run of consecutive calendar days
  each containing at least one eligible message.

## 6. Response analytics

Definitions (constants in `src/features/analytics/responses.ts`):

- **Burst window** = **120 seconds**. Consecutive eligible messages by the
  _same_ participant form one burst when each message arrives within 120 s
  of the previous one. A burst is otherwise ended.
- **Response event** — the first eligible message from a _different_
  participant after a burst. Its duration is measured **from the first
  message of the burst** (not the last), so rapid multi-message typing is
  not penalized.
- **Valid response** — duration ≤ **6 hours** and ≥ 0. Valid responses feed
  average, median and fastest-response statistics.
- **Longest response gap** — the largest interval between two consecutive
  eligible messages (any participants, any length), tracked separately with
  both timestamps.
- Per-participant response stats use only responses _given by_ that
  participant (they responded to someone else's burst).

**Limitations:** rapid cross-talk (two people typing simultaneously) can
inflate apparent response times in rare cases; group chats produce
"responses" from any participant; messages with missing timestamps are
excluded. These numbers describe rhythm, not attentiveness or affection.

## 7. Conversation initiation

A **conversation start** is an eligible message that either:

1. Is the first eligible message of the selection, or
2. Follows a lull of **≥ 4 hours** since the previous eligible message.

The participant who sent it is credited with starting the conversation.
Short lulls (≤ 4 h) do not reset the conversation.

## 8. Emoji analytics

- Emoji are extracted as **grapheme clusters** via `Intl.Segmenter`, so
  ZWJ sequences (👨‍👩‍👧), skin-tone modifiers (👍🏽), flags (🇮🇳), keycaps
  (1️⃣) and emoji with variation selectors count as **one emoji each**.
- The symbols ©, ®, ™ are Extended_Pictographic but are **excluded**.
- Emoji are counted per eligible text message; attachment events without
  text do not contribute (sticker emoji content does).
- **Emoji per message** = total emoji ÷ eligible messages.
- Rankings are ordered by count (descending); ties keep first-appearance
  order (deterministic).

## 9. Word analytics

- Word extraction uses `Intl.Segmenter` word segmentation (Unicode-safe for
  scripts like Devanagari, Han, Hangul).
- **Signature words** (rankings) exclude a default English stopword list,
  pure numbers, URLs and email addresses.
- **Most-used expression** = highest-ranked signature word. Displayed as a
  record; ties resolve alphabetically for determinism.
- **Question / exclamation counts** use Unicode-aware matches (`?`/`？`,
  `!`/`！`) on eligible text.

## 10. Conversation records

| Record                    | Definition                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Longest message           | Eligible text message with the most grapheme clusters.                                                |
| Most active day           | Day with the most eligible messages.                                                                  |
| Most / least active month | Calendar month with the most / fewest eligible messages (only shown when more than one month exists). |
| Longest active streak     | See §5.                                                                                               |
| Late-night activity       | Eligible messages between 00:00–04:59.                                                                |
| Early-morning activity    | Eligible messages between 05:00–07:59.                                                                |
| Biggest burst             | The burst (see §6) with the most messages by one participant.                                         |
| Most-used expression      | See §9.                                                                                               |

Records are only created when the data supports them; insufficient data is
stated rather than guessed.

## 11. Awards (Module G)

Awards are playful statistics with explicit thresholds. An award is granted
only if at least one participant **and** the global minimum sample
(≥ 10 eligible messages for the participant) qualify; otherwise it is
omitted. Ties are reported as ties (multiple winners).

| Award                   | Threshold (all required)                                                             |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Night Owl 🦉            | ≥ 15 eligible messages between 00:00–04:59; most in window.                          |
| Early Bird 🌅           | ≥ 15 eligible messages between 05:00–07:59; most in window.                          |
| Emoji Enthusiast 🎭     | ≥ 15 emoji sent total; highest emoji-per-message rate (≥ 0.35).                      |
| Marathon Chatter 🏃     | ≥ 15 eligible messages by one participant on a single day; highest single-day count. |
| Conversation Starter 🚀 | ≥ 3 conversation starts; most starts.                                                |
| Weekend Regular 🛋️      | ≥ 15 weekend messages; highest weekend share (≥ 35%).                                |
| The Storyteller 📜      | ≥ 10 messages; average length ≥ 120 characters; longest average.                     |
| Speed Responder ⚡      | ≥ 5 valid responses; median response time ≤ 5 minutes; fastest median.               |

## 12. Sample sufficiency and honesty rules

- Conversations with fewer than 20 eligible messages show a "small sample"
  note in the dashboard.
- Metrics with missing inputs (e.g. no valid responses) render an explicit
  "not enough data" state — never a fabricated number.
- Ties are always labeled.
- **No metric implies anything about affection, loyalty, personality or
  relationship quality.** ChatWrapped reports counting statistics; stories
  and cards phrase them as playful facts about activity, never judgments
  about people.
