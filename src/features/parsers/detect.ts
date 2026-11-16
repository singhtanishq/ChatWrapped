/**
 * Format detection for uploaded files.
 *
 * Detection is content-based (not extension-based) so that misnamed files
 * still work, while extensions help produce precise error messages.
 */

import { parseTelegram } from "./telegram";
import { parseWhatsApp } from "./whatsapp";
import type { ParseOptions, ParseResult } from "../types";
import { ParseError } from "../types";

export type DetectedFormat = "whatsapp" | "telegram-json" | "unknown";

/** Content sniffing on the first chunk of the file. */
export function detectFormat(sample: string): { format: DetectedFormat; detail?: string } {
  const head = sample.slice(0, 32 * 1024);
  const trimmed = head.replace(/^\uFEFF/, "").trimStart();

  // Telegram JSON export: starts with an object, has a messages array.
  if (trimmed.startsWith("{")) {
    try {
      const probe = JSON.parse(
        trimmed.endsWith("}") ? trimmed : trimmed.slice(0, trimmed.lastIndexOf("}") + 1),
      );
      if (
        probe &&
        typeof probe === "object" &&
        Array.isArray((probe as { messages?: unknown }).messages)
      ) {
        return { format: "telegram-json" };
      }
    } catch {
      // Incomplete JSON in sample — check heuristically.
      if (/"messages"\s*:/.test(trimmed) && /"type"|"from"|"date"/.test(trimmed)) {
        return { format: "telegram-json" };
      }
    }
    return {
      format: "unknown",
      detail: "The file looks like JSON but is not a Telegram chat export.",
    };
  }

  // WhatsApp TXT: timestamped lines.
  const lines = trimmed.split(/\r\n|\r|\n/).filter((l) => l.trim());
  const waLike = lines.filter((l) =>
    /^\[?\d{1,4}[./]\d{1,2}[./]\d{2,4}[,]?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?\]?\s*(?:[-–]\s*)?\S/.test(
      l.replace(/[\u200e\u200f]/g, ""),
    ),
  );
  if (lines.length > 0 && waLike.length / lines.length > 0.5) {
    return { format: "whatsapp" };
  }

  if (/<html|<!doctype/i.test(trimmed) && /telegram|persistence/i.test(trimmed)) {
    return {
      format: "unknown",
      detail:
        "This looks like a Telegram HTML export. HTML exports are not supported yet — export as JSON from Telegram Desktop instead.",
    };
  }
  if (/^From: /m.test(trimmed) && /^Subject: /m.test(trimmed)) {
    return {
      format: "unknown",
      detail: "This looks like an email/mbox export, which is not supported.",
    };
  }

  return { format: "unknown" };
}

export function parseConversation(
  content: string,
  format: DetectedFormat,
  options: ParseOptions = {},
): ParseResult {
  if (format === "whatsapp") return parseWhatsApp(content, options);
  if (format === "telegram-json") return parseTelegram(content);
  throw new ParseError("The file format could not be recognized.", "unsupported-format");
}
