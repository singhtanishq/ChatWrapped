/**
 * Response-time analysis with documented, deterministic rules.
 *
 * Definitions (see docs/analytics/METRIC_DEFINITIONS.md):
 *  - Burst: a run of consecutive eligible messages by the SAME participant
 *    where each message follows the previous within BURST_WINDOW_MS (120 s).
 *  - Response event: the first eligible message from a DIFFERENT participant
 *    after a burst ends. Its duration is measured from the burst's first
 *    message.
 *  - Valid response: 0 ms ≤ duration ≤ MAX_RESPONSE_MS (6 h). Longer gaps are
 *    tracked for the "longest gap" record but excluded from averages/medians.
 */

import type { ChatMessage } from "../types";

export const BURST_WINDOW_MS = 120_000;
export const MAX_RESPONSE_MS = 6 * 3600_000;
/** A conversation "starts" after this much inactivity. */
export const CONVERSATION_START_GAP_MS = 4 * 3600_000;

export interface Burst {
  participantId: string;
  startTs: number;
  endTs: number;
  messageIndexes: number[];
}

export interface ResponseEvent {
  /** Participant who sent the burst (was responded to). */
  initiatorId: string;
  /** Participant who responded. */
  responderId: string;
  /** Response duration in ms (from burst start to response message). */
  durationMs: number;
  ts: number;
}

/** Group a chronologically ordered eligible message list into bursts. */
export function extractBursts(messages: ChatMessage[]): Burst[] {
  const bursts: Burst[] = [];
  let current: Burst | null = null;
  messages.forEach((m, i) => {
    if (m.timestamp === null) return;
    if (
      current &&
      current.participantId === m.participantId &&
      m.timestamp - current.endTs <= BURST_WINDOW_MS
    ) {
      current.endTs = m.timestamp;
      current.messageIndexes.push(i);
    } else {
      current = {
        participantId: m.participantId,
        startTs: m.timestamp,
        endTs: m.timestamp,
        messageIndexes: [i],
      };
      bursts.push(current);
    }
  });
  return bursts;
}

/** Derive response events from bursts + the ordered message list. */
export function extractResponses(messages: ChatMessage[]): ResponseEvent[] {
  const events: ResponseEvent[] = [];
  const bursts = extractBursts(messages);
  for (let bi = 0; bi < bursts.length - 1; bi++) {
    const burst = bursts[bi]!;
    const nextBurst = bursts[bi + 1]!;
    if (nextBurst.participantId === burst.participantId) continue; // shouldn't happen by construction
    const durationMs = nextBurst.startTs - burst.startTs;
    events.push({
      initiatorId: burst.participantId,
      responderId: nextBurst.participantId,
      durationMs,
      ts: nextBurst.startTs,
    });
  }
  return events;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted[mid]!;
  return sorted.length % 2 === 0 ? Math.round((m + sorted[mid - 1]!) / 2) : m;
}
