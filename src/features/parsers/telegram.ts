/**
 * Telegram Desktop JSON export parser.
 *
 * Handles personal chats, private groups and "Saved Messages" exports.
 * Message `text` may be a plain string or an array of formatted parts
 * (plain / link / mention / custom_emoji …). Attachments (photo, video,
 * voice, sticker …) are detected from their dedicated fields. Service
 * messages (type "service") become system events and are excluded from
 * ordinary message totals by default.
 *
 * Telegram exports carry local wall-clock dates ("date") plus a UTC epoch
 * ("date_unixtime"). We use the wall-clock string interpreted as UTC for the
 * same constant-offset reasons as the WhatsApp parser (see types.ts).
 */

import type { ChatMessage, ParseResult, Participant } from "../types";
import { ParseError } from "../types";

interface TelegramTextPart {
  type: string;
  text: string;
  emoji?: string;
}

interface TelegramMessage {
  id: number;
  type: "message" | "service";
  date?: string;
  date_unixtime?: string;
  edited_date?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  actor_id?: string;
  action?: string;
  text?: string | TelegramTextPart[];
  forwarded_from?: string;
  photo?: string;
  sticker_emoji?: string;
  animation?: string;
  video?: string;
  video_note?: string;
  voice_message?: string;
  audio_file?: string;
  file?: string;
  poll?: { question: string };
  reply_to_message_id?: number;
  thumbnail?: unknown;
  [key: string]: unknown;
}

interface TelegramExport {
  name?: string;
  type?: string;
  messages?: TelegramMessage[];
  personal_information?: unknown;
  chats?: unknown;
}

function flattenText(text: TelegramMessage["text"]): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text
    .map((part) => part.text)
    .join("")
    .trim();
}

/** Parse an ISO wall-clock date like "2023-01-15T18:30:00" as UTC. */
export function parseTelegramDate(date: string | undefined): number | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?$/.exec(date);
  if (!m) return null;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0),
  );
}

export function parseTelegram(raw: string, _options: { fileName?: string } = {}): ParseResult {
  let data: TelegramExport;
  try {
    data = JSON.parse(raw) as TelegramExport;
  } catch {
    throw new ParseError(
      "This file could not be read as JSON. Make sure you exported with Telegram Desktop and selected “Machine-readable JSON” output.",
      "malformed-json",
    );
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.messages)) {
    throw new ParseError(
      "This JSON file does not contain a Telegram message export (no “messages” array found).",
      "unsupported-format",
    );
  }

  const warnings: string[] = [];
  const participants = new Map<string, Participant>();
  const messages: ChatMessage[] = [];
  let missingTimestamp = 0;
  let serviceCount = 0;
  let warnedAboutForwards = false;

  const resolveParticipant = (name: string): Participant => {
    let p = participants.get(name);
    if (!p) {
      p = { id: name, displayName: name };
      participants.set(name, p);
    }
    return p;
  };

  let idCounter = 0;
  for (const tm of data.messages) {
    if (!tm || typeof tm !== "object") {
      warnings.push("One malformed export entry was skipped.");
      continue;
    }

    const timestamp = parseTelegramDate(tm.date);
    if (timestamp === null) missingTimestamp++;

    if (tm.type === "service" || (!tm.from && !tm.actor && tm.action)) {
      serviceCount++;
      const actor = tm.actor ?? "system";
      const text = [tm.actor ? `${tm.actor} ` : "", tm.action ?? flattenText(tm.text)]
        .filter(Boolean)
        .join("");
      messages.push({
        id: `t-${idCounter++}`,
        participantId: tm.actor ? resolveParticipant(actor).id : "system",
        timestamp,
        text,
        type: "system",
        isSystemMessage: true,
        hasAttachment: false,
        sourceIndex: tm.id ?? idCounter,
      });
      continue;
    }

    const from = tm.from ?? tm.actor ?? "Unknown";
    const p = resolveParticipant(from);
    const text = flattenText(tm.text);
    const hasAttachment = Boolean(
      tm.photo ||
      tm.sticker_emoji ||
      tm.animation ||
      tm.video ||
      tm.video_note ||
      tm.voice_message ||
      tm.audio_file ||
      tm.file,
    );
    const isPoll = Boolean(tm.poll);

    let textClean = text;
    if (hasAttachment) {
      // For stickers, the emoji itself is the content.
      if (tm.sticker_emoji && !textClean) textClean = tm.sticker_emoji;
    }

    messages.push({
      id: `t-${idCounter++}`,
      participantId: p.id,
      timestamp,
      text: isPoll ? (tm.poll?.question ?? textClean) : textClean,
      type: hasAttachment ? "media" : "text",
      isSystemMessage: false,
      hasAttachment,
      sourceIndex: tm.id ?? idCounter,
    });

    if (tm.forwarded_from && !warnedAboutForwards) {
      warnedAboutForwards = true;
      warnings.push(
        "Forwarded messages are counted for the participant who forwarded them, not the original author.",
      );
    }
  }

  if (messages.length === 0) {
    throw new ParseError("The export contains no messages to analyze.", "no-messages");
  }
  if (missingTimestamp > 0) {
    warnings.push(
      `${missingTimestamp} message(s) had no usable timestamp and are excluded from time-based metrics.`,
    );
  }
  if (serviceCount > 0) {
    warnings.push(
      `${serviceCount} service event(s) (joins, pins, calls) were detected and excluded from message totals by default.`,
    );
  }

  return {
    conversation: {
      platform: "telegram",
      ...(data.name !== undefined ? { title: data.name } : {}),
      participants: [...participants.values()],
      messages,
      dateOrder: "year-first",
      dateOrderAmbiguous: false,
      importWarnings: warnings,
    },
    sourceCount: data.messages.length,
  };
}
