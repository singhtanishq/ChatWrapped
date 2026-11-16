/**
 * WhatsApp TXT export parser (Android and iOS).
 *
 * Supported line shapes (after stripping Unicode directionality marks):
 *
 *   iOS:      [12/25/2023, 21:14:33] Sender: Message      (bracketed, often with seconds)
 *   Android:  12/25/2023, 21:14 - Sender: Message         (dash, optional 12h meridiem)
 *   Dots:     25.12.2023, 21:14 - Sender: Message         (de/tr locale separators)
 *
 * Any line that does not carry a timestamp prefix is a continuation of the
 * previous message (multiline text, pasted content). System events carry a
 * timestamp but no "Sender:" part. Date-order (day-first vs month-first) is
 * inferred from unambiguous values; otherwise it is flagged as ambiguous so
 * the UI can offer an explicit toggle.
 */

import type { ChatMessage, ParseOptions, ParseResult, Participant } from "../types";
import { ParseError } from "../types";

// Unicode bidi marks inserted by WhatsApp/Android around exports.
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

const SYSTEM_MARKERS = [
  /^Messages and calls are end-to-end encrypted/i,
  /^This chat is now end-to-end encrypted/i,
  /^.* (?:changed|set|removed) the group (?:description|icon|settings)\.?$/i,
  /^.* (?:added|removed|joined|left|re-added|kicked)\b/i,
  /^You (?:added|removed|joined|left|created|changed|deleted|unblocked|blocked|were)/i,
  /^You created this group/i,
  /^.* created (?:this )?group "?[^"]*"?$/i,
  /^(?:Group created|Subject changed|Group icon changed|Description changed)/i,
  /^Missed (?:voice|video) call\.?$/i,
  /^(?:Voice|Video) call(?:,| (?:was )?(?:started|ended|jumped|declined|missed|no answer))/i,
  /^.*'?(?:s|') (?:message|contact) was deleted\.?$/i,
  /^This message was deleted\.?$/i,
  /^You deleted this message\.?$/i,
  /^.* security code changed\.?$/i,
  /^.* enabled disappearing messages/i,
  /^Disappearing messages? (?:are now )?(?:set to|enabled|disabled)/i,
  /^Real-time location shared\.?$/i,
  /^Live location shared\.?$/i,
  /^.* turned on (?:vanished-mode|disappearing)/i,
  /^Vanished-mode message sent/i,
  /^You are now classmates/i,
];

const MEDIA_PATTERNS = [
  /<(?:media|image|video|sticker|GIF|audio|document|contact|location|poll)\s+omitted>$/i,
  /(?:image|video|audio|sticker|document|GIF|Contact card|map)\s+omitted$/i,
  /\((?:file|voice message(?:\s*\(\d+:\d+\))?) attached\)$/i,
  /^(?:IMG|VID|AUD|DOC|STK|PTT)-?\d{4,}.*\.(?:jpe?g|png|webp|mp4|opus|oga|pdf|txt|vcf|webm|m4a|aac)\s*\(file attached\)$/i,
  /^\d{2,3}(?:\.\d)?(?:\s*|,\s*)?(?:MB|KB|GB)?$/i, // bare attachment sizes ("5.3 MB")
];

function looksLikeSystem(text: string): boolean {
  return SYSTEM_MARKERS.some((re) => re.test(text));
}

function looksLikeMedia(text: string): boolean {
  return MEDIA_PATTERNS.some((re) => re.test(text.trim()));
}

export interface WhatsAppTimestamp {
  /** First date component, raw (day, month or year depending on locale). */
  comp1: number;
  /** Second date component, raw. */
  comp2: number;
  /** Third component (usually the year, or the day in year-first locales). */
  yearSlot: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Parse the leading timestamp of a WhatsApp line.
 * Returns null when the line does not start with a recognizable timestamp.
 */
export function parseWhatsAppLineStart(
  line: string,
): { timestamp: WhatsAppTimestamp; rest: string; bracketed: boolean } | null {
  const m =
    /^[\u200e\u200f]*\u200e?\[?(\d{1,4})[./](\d{1,2})[./](\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm|a\.m\.|p\.m\.|A\.M\.|P\.M\.))?\]?\s*(?:[-–—]\s*)?/.exec(
      line,
    );
  if (!m) return null;
  const comp1 = Number(m[1]);
  const comp2 = Number(m[2]);
  const yearSlot = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  let meridiem = m[7] ?? null;
  if (meridiem) meridiem = meridiem.toUpperCase().replace(/\./g, "");

  // Sanity check on raw components before any order interpretation.
  if (comp2 < 1 || comp2 > 31 || comp1 < 1 || hour > 23 || minute > 59 || second > 59) return null;

  let h = hour;
  if (meridiem === "AM") {
    if (h === 12) h = 0;
  } else if (meridiem === "PM") {
    if (h !== 12) h += 12;
  }

  return {
    timestamp: { comp1, comp2, yearSlot, hour: h, minute, second },
    rest: line.slice(m[0].length),
    bracketed: /^\u200e?\[/.test(line),
  };
}

/** Decide date order from all parsed timestamps, or use the forced option. */
function resolveDateOrder(
  stamps: WhatsAppTimestamp[],
  option: NonNullable<ParseOptions["dateOrder"]>,
): { order: "day-first" | "month-first" | "year-first"; ambiguous: boolean } {
  if (option !== "auto") return { order: option, ambiguous: false };
  let dayFirstEvidence = 0;
  let monthFirstEvidence = 0;
  let yearFirstEvidence = 0;
  for (const s of stamps) {
    if (s.comp1 > 31)
      yearFirstEvidence++; // four-digit leading year (e.g. 2023/12/25)
    else if (s.comp1 > 12)
      dayFirstEvidence++; // DD/MM
    else if (s.comp2 > 12) monthFirstEvidence++; // MM/DD
  }
  if (yearFirstEvidence > 0 && dayFirstEvidence + monthFirstEvidence === 0) {
    return { order: "year-first", ambiguous: false };
  }
  if (dayFirstEvidence > 0 && monthFirstEvidence === 0)
    return { order: "day-first", ambiguous: false };
  if (monthFirstEvidence > 0 && dayFirstEvidence === 0)
    return { order: "month-first", ambiguous: false };
  if (dayFirstEvidence > 0 && monthFirstEvidence > 0) {
    // Mixed evidence cannot happen with correct data — prefer day-first.
    return { order: "day-first", ambiguous: true };
  }
  return { order: "day-first", ambiguous: true };
}

/** Convert raw components + resolved order into an epoch ms (UTC interpretation). */
export function toEpoch(
  t: WhatsAppTimestamp,
  order: "day-first" | "month-first" | "year-first",
): number {
  let year: number;
  let month0: number;
  let day: number;
  if (order === "year-first") {
    year = t.comp1;
    month0 = t.comp2 - 1;
    day = t.yearSlot;
  } else if (order === "month-first") {
    year = t.yearSlot < 100 ? t.yearSlot + 2000 : t.yearSlot;
    month0 = t.comp1 - 1;
    day = t.comp2;
  } else {
    year = t.yearSlot < 100 ? t.yearSlot + 2000 : t.yearSlot;
    month0 = t.comp2 - 1;
    day = t.comp1;
  }
  return Date.UTC(year, month0, day, t.hour, t.minute, t.second);
}

export function parseWhatsApp(text: string, options: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  const participants = new Map<string, Participant>();
  const messages: ChatMessage[] = [];
  const stamps: WhatsAppTimestamp[] = [];
  const forced = options.dateOrder ?? "auto";

  let sourceIndex = 0;
  let headerLines = 0;
  let continuationsWithoutAnchor = 0;
  let dateSeparatorLines = 0;

  // Pre-scan for date-order resolution: collect raw timestamp components in a
  // cheap first pass (start-anchored regex only), then map lines.
  for (const raw of lines) {
    const line = raw.replace(BIDI_MARKS, "").replace(/^\uFEFF/, "");
    if (!line.trim()) continue;
    const m =
      /^[\u200e\u200f]*\[?(\d{1,4})[./](\d{1,2})[./](\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.))?\]?/.exec(
        line,
      );
    if (m) {
      const comp1 = Number(m[1]);
      const comp2 = Number(m[2]);
      if (comp2 >= 1 && comp2 <= 31 && comp1 >= 1) {
        stamps.push({
          comp1,
          comp2,
          yearSlot: Number(m[3]),
          hour: Number(m[4]),
          minute: Number(m[5]),
          second: m[6] ? Number(m[6]) : 0,
        });
      }
    }
  }
  if (stamps.length === 0) {
    throw new ParseError(
      "No timestamped messages were found. This does not look like a WhatsApp chat export (expected lines like “12/25/2023, 21:14 - Sender: Message”).",
      "unknown-timestamp-format",
    );
  }

  const { order, ambiguous } = resolveDateOrder(stamps, forced);
  if (ambiguous && forced === "auto") {
    warnings.push(
      "Date format could not be determined unambiguously — dates were interpreted as day-first (DD/MM). Use the date-order control below if your export uses month-first (MM/DD).",
    );
  }

  let last: ChatMessage | null = null;
  let prevEpoch: number | null = null;
  let idCounter = 0;

  for (const raw of lines) {
    sourceIndex++;
    const line = raw.replace(BIDI_MARKS, "").replace(/^\uFEFF/, "");
    if (!line.trim()) continue;

    const start = parseWhatsAppLineStart(line);
    if (!start) {
      // Bare date separator (old Android exports): a line that is only a date.
      if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}\s*$/.test(line)) {
        dateSeparatorLines++;
        continue;
      }
      if (last) {
        last.text += (last.text ? "\n" : "") + line;
        continue;
      }
      if (headerLines < 5) {
        // Content before the first message (system/encryption preamble or export header)
        headerLines++;
        continue;
      }
      continuationsWithoutAnchor++;
      continue;
    }

    const epoch = toEpoch(start.timestamp, order);
    // Guard against impossible transitions caused by wrong date-order (e.g. a
    // parsed sequence going backwards by years). Only flag, don't reorder.
    if (prevEpoch !== null && epoch < prevEpoch) {
      // Allow same-instant duplicates and small clock glitches (up to 1 day backwards
      // is possible with month/day confusion). Anything more is suspicious.
      if (prevEpoch - epoch > 24 * 3600 * 1000) {
        warnings.push(
          "Some messages appear out of chronological order. If timestamps look wrong, try switching the date-order interpretation.",
        );
      }
    }
    prevEpoch = epoch;

    // New-day separator detection for bare system lines like a new date without text
    const rest = start.rest.trim();
    if (rest === "") {
      dateSeparatorLines++;
      continue;
    }

    // Split sender from content at the first ": " — content may contain colons.
    const colonMatch = /^([^:\n]{1,120}):\s([\s\S]*)$/.exec(rest);
    let participantId: string;
    let text: string;
    let isSystem: boolean;

    if (colonMatch) {
      const name = colonMatch[1]!.trim();
      text = colonMatch[2] ?? "";
      let p = participants.get(name);
      if (!p) {
        p = { id: name, displayName: name };
        participants.set(name, p);
      }
      participantId = p.id;
      // Even sender-prefixed lines can be system events (e.g. "You deleted
      // this message", call events on some platforms).
      isSystem = looksLikeSystem(text);
    } else {
      // No "Sender:" part → system event (encryption notices, group events, calls).
      participantId = "system";
      text = rest;
      isSystem = true;
    }

    const isMedia = !isSystem && looksLikeMedia(text);
    const type: ChatMessage["type"] = isSystem ? "system" : isMedia ? "media" : "text";
    const hasAttachment = isMedia;

    if (isMedia) {
      // Strip the placeholder from text so captions can still be analyzed.
      let clean = text.trim();
      for (const re of MEDIA_PATTERNS) clean = clean.replace(re, "").trim();
      text = clean;
    }

    const msg: ChatMessage = {
      id: `w-${idCounter++}`,
      participantId,
      timestamp: epoch,
      text,
      type,
      isSystemMessage: isSystem,
      hasAttachment,
      sourceIndex,
    };
    messages.push(msg);
    last = msg;
  }

  if (messages.length === 0) {
    throw new ParseError(
      "The file was read but no messages could be extracted from it.",
      "no-messages",
    );
  }
  if (continuationsWithoutAnchor > 0) {
    warnings.push(
      `${continuationsWithoutAnchor} line(s) before the first timestamped message were skipped.`,
    );
  }
  if (dateSeparatorLines > 0) {
    warnings.push(`${dateSeparatorLines} bare date-separator line(s) were skipped.`);
  }

  const participantsArr = [...participants.values()];
  return {
    conversation: {
      platform: "whatsapp",
      participants: participantsArr,
      messages,
      dateOrder: order,
      dateOrderAmbiguous: ambiguous,
      importWarnings: warnings,
    },
    sourceCount: sourceIndex,
  };
}
