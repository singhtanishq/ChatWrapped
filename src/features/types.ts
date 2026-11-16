/**
 * Normalized internal conversation model.
 *
 * Every parser (WhatsApp TXT, Telegram JSON) emits this structure. All
 * downstream analytics, stories and cards consume only this shape.
 *
 * Timestamp convention: source wall-clock time expressed as a UTC epoch.
 * Chat exports are local time with no timezone metadata; treating the wall
 * clock as UTC keeps a *constant* offset across the whole conversation, so
 * inter-message durations stay correct and day/hour buckets reflect what the
 * user actually saw on their clock. See docs/analytics/METRIC_DEFINITIONS.md.
 */

export type Platform = "whatsapp" | "telegram";

export type MessageType = "text" | "media" | "system" | "unknown";

export interface Participant {
  id: string;
  displayName: string;
  isCurrentUser?: boolean;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  /** UTC epoch ms of the source wall-clock time, or null when unavailable. */
  timestamp: number | null;
  text: string;
  type: MessageType;
  isSystemMessage: boolean;
  hasAttachment: boolean;
  sourceIndex: number;
}

export interface ParsedConversation {
  platform: Platform;
  title?: string;
  participants: Participant[];
  messages: ChatMessage[];
  /** "day-first" | "month-first" | "year-first" — only meaningful for WhatsApp TXT. */
  dateOrder: "day-first" | "month-first" | "year-first";
  /** True when the order was inferred without unambiguous evidence. */
  dateOrderAmbiguous: boolean;
  /** Present for Telegram: participants resolved from export metadata. */
  timezone?: string;
  importWarnings: string[];
}

/** Result of parsing raw file content. */
export interface ParseResult {
  conversation: ParsedConversation;
  /** Number of source lines consumed (TXT) / JSON entries (Telegram). */
  sourceCount: number;
}

export interface ParseOptions {
  /** Force day/month interpretation for ambiguous dates. Defaults to inference with day-first fallback. */
  dateOrder?: "day-first" | "month-first" | "year-first" | "auto";
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "empty-file"
      | "unsupported-format"
      | "malformed-json"
      | "no-messages"
      | "too-large"
      | "unknown-timestamp-format" = "unsupported-format",
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export const FILE_LIMITS = {
  /** Hard rejection limit. Parsing beyond this risks OOM in browsers. */
  hardMaxBytes: 200 * 1024 * 1024,
  /** Above this, show a warning that processing may take a while. */
  warnBytes: 10 * 1024 * 1024,
} as const;
