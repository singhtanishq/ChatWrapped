/**
 * ChatWrapped analytics engine.
 *
 * Pure, deterministic functions over the normalized conversation model.
 * No DOM, no randomness — the same input always produces the same result.
 * Every metric follows the definitions in docs/analytics/METRIC_DEFINITIONS.md.
 */

import type { ChatMessage, ParsedConversation } from "../types";
import { graphemeCount, extractEmoji } from "@/lib/emoji";
import { countWords, tokenizeWords, questionCount, exclamationCount } from "@/lib/text";
import { CONVERSATION_START_GAP_MS, MAX_RESPONSE_MS, extractBursts, median } from "./responses";
import type {
  AnalyticsOptions,
  AnalyticsResult,
  DayPoint,
  MonthlyPoint,
  ParticipantStats,
  RecordEntry,
  StreakInfo,
} from "./types";
import { formatMonthYear } from "@/lib/format";

const NIGHT_MAX_HOUR = 5; // 00:00–04:59
const EARLY_MAX_HOUR = 8; // 05:00–07:59

/** Spread-based Math.min overflows the stack for very large arrays. */
function minOf(values: number[]): number {
  let m = Infinity;
  for (const v of values) if (v < m) m = v;
  return m;
}

/** Build the eligible message pool according to user's privacy/filter options. */
export function selectEligible(
  conversation: ParsedConversation,
  options: AnalyticsOptions,
): ChatMessage[] {
  const excluded = new Set(options.excludedParticipantIds ?? []);
  const excludeSystem = options.excludeSystemMessages ?? true;
  const excludeAttachments = options.excludeAttachments ?? false;
  const range = options.dateRange ?? null;

  return conversation.messages.filter((m) => {
    if (excluded.has(m.participantId)) return false;
    if (excludeSystem && m.isSystemMessage) return false;
    if (excludeAttachments && m.hasAttachment) return false;
    if (range && (m.timestamp === null || m.timestamp < range.from || m.timestamp > range.to))
      return false;
    return true;
  });
}

/** UTC-midnight key of a wall-clock epoch. */
export function dayKey(ts: number): number {
  return Math.floor(ts / 86400000) * 86400000;
}

export function monthKey(ts: number): { year: number; month0: number } {
  const d = new Date(ts);
  return { year: d.getUTCFullYear(), month0: d.getUTCMonth() };
}

/** Longest run of consecutive active days. */
export function longestStreak(days: number[]): StreakInfo | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a - b);
  let best: StreakInfo | null = null;
  let runStart = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur !== undefined && cur - prev === 86400000) {
      prev = cur;
      continue;
    }
    // run ended at prev
    const length = Math.round((prev - runStart) / 86400000) + 1;
    if (!best || length > best.length) {
      best = { length, startTs: runStart, endTs: prev };
    }
    if (cur !== undefined) {
      runStart = cur;
      prev = cur;
    }
  }
  return best;
}

export function computeAnalytics(
  conversation: ParsedConversation,
  options: AnalyticsOptions = {},
): AnalyticsResult {
  const eligible = selectEligible(conversation, options);
  const sampleNotes: string[] = [];

  const excluded = new Set(options.excludedParticipantIds ?? []);
  const displayNames = new Map(conversation.participants.map((p) => [p.id, p.displayName]));

  // ---- Basic aggregates ----
  let totalWords = 0;
  let totalChars = 0;
  let mediaCount = 0;
  const hourly = new Array<number>(24).fill(0);
  const weekday = new Array<number>(7).fill(0);
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const dayCounts = new Map<number, number>();
  const monthCounts = new Map<string, MonthlyPoint>();
  const wordCounts = new Map<string, number>();
  const emojiCounts = new Map<string, number>();
  let questionTotal = 0;
  let emojiTotal = 0;

  const perParticipant = new Map<string, ParticipantStats>();
  const ensureStats = (id: string): ParticipantStats => {
    let s = perParticipant.get(id);
    if (!s) {
      s = {
        participantId: id,
        displayName: displayNames.get(id) ?? id,
        messages: 0,
        sharePct: 0,
        words: 0,
        chars: 0,
        avgChars: 0,
        emoji: 0,
        emojiPerMessage: 0,
        questions: 0,
        exclamations: 0,
        mediaCount: 0,
        responses: 0,
        medianResponseMs: null,
        avgResponseMs: null,
        fastestResponseMs: null,
        conversationStarts: 0,
        longestMessageChars: null,
        nightCount: 0,
        earlyCount: 0,
        weekendCount: 0,
        firstTs: null,
        lastTs: null,
      };
      perParticipant.set(id, s);
    }
    return s;
  };

  // Ensure every non-excluded participant appears even with zero messages.
  for (const p of conversation.participants) {
    if (!excluded.has(p.id) && p.id !== "system") ensureStats(p.id);
  }

  const bursts = extractBursts(eligible);
  const burstOwner = new Map<number, string>(); // message index -> burst participant
  bursts.forEach((b) => {
    for (const idx of b.messageIndexes) burstOwner.set(idx, b.participantId);
  });
  const responseValid: Array<{ responderId: string; durationMs: number }> = [];
  const responseByParticipant = new Map<string, number[]>();

  let prevTs: number | null = null;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  let longestGapMs = 0;
  let longestGapFromTs = 0;
  let longestGapToTs = 0;
  let maxBurstMessages = 0;
  let maxBurstTs: number | null = null;
  let maxBurstParticipant: string | null = null;
  let longestMessage: AnalyticsResult["longestMessage"] = null;
  let anyNullTimestamp = false;

  eligible.forEach((m) => {
    if (m.timestamp === null) {
      anyNullTimestamp = true;
    }
    const text = m.text;
    const chars = graphemeCount(text);
    const words = countWords(text);
    totalWords += words;
    totalChars += chars;
    if (m.hasAttachment) mediaCount++;
    if (!m.hasAttachment && !m.isSystemMessage) {
      questionTotal += questionCount(text);
      const emojiList = extractEmoji(text);
      emojiTotal += emojiList.length;
      for (const e of emojiList) emojiCounts.set(e, (emojiCounts.get(e) ?? 0) + 1);
      for (const w of tokenizeWords(
        text,
        options.stopwords ? { stopwords: options.stopwords } : {},
      )) {
        wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      }
    }

    const stats = ensureStats(m.participantId);
    stats.messages++;
    stats.words += words;
    stats.chars += chars;
    if (chars > (stats.longestMessageChars ?? 0)) stats.longestMessageChars = chars;
    stats.questions += questionCount(text);
    stats.exclamations += exclamationCount(text);
    if (m.hasAttachment) stats.mediaCount++;
    if (stats.firstTs === null || (m.timestamp !== null && m.timestamp < stats.firstTs))
      stats.firstTs = m.timestamp;
    if (stats.lastTs === null || (m.timestamp !== null && m.timestamp > stats.lastTs))
      stats.lastTs = m.timestamp;

    if (m.timestamp !== null) {
      const d = new Date(m.timestamp);
      const hour = d.getUTCHours();
      const dow = d.getUTCDay();
      hourly[hour]!++;
      weekday[dow]!++;
      heatmap[dow]![hour]!++;
      if (hour < NIGHT_MAX_HOUR) stats.nightCount++;
      else if (hour < EARLY_MAX_HOUR) stats.earlyCount++;
      if (dow === 0 || dow === 6) stats.weekendCount++;

      const dk = dayKey(m.timestamp);
      dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
      const mk = monthKey(m.timestamp);
      const key = `${mk.year}-${String(mk.month0 + 1).padStart(2, "0")}`;
      const existing = monthCounts.get(key);
      if (existing) existing.count++;
      else monthCounts.set(key, { key, year: mk.year, month0: mk.month0, count: 1 });

      if (firstTs === null) firstTs = m.timestamp;
      lastTs = m.timestamp;

      // Conversation starts
      if (prevTs === null || m.timestamp - prevTs >= CONVERSATION_START_GAP_MS) {
        stats.conversationStarts++;
      }

      // Longest gap between consecutive eligible messages
      if (prevTs !== null) {
        const gap = m.timestamp - prevTs;
        if (gap > longestGapMs) {
          longestGapMs = gap;
          longestGapFromTs = prevTs;
          longestGapToTs = m.timestamp;
        }
      }
      prevTs = m.timestamp;

      // Longest message overall (text only)
      if (chars > 0 && (longestMessage === null || chars > longestMessage.chars)) {
        longestMessage = {
          chars,
          participantId: m.participantId,
          ts: m.timestamp,
          preview: text.slice(0, 140),
        };
      }
    }
  });

  // Responses
  for (let bi = 0; bi < bursts.length - 1; bi++) {
    const burst = bursts[bi]!;
    const nextBurst = bursts[bi + 1]!;
    if (nextBurst.participantId === burst.participantId) continue;
    const duration = nextBurst.startTs - burst.startTs;
    if (duration >= 0 && duration <= MAX_RESPONSE_MS) {
      responseValid.push({ responderId: nextBurst.participantId, durationMs: duration });
      const arr = responseByParticipant.get(nextBurst.participantId) ?? [];
      arr.push(duration);
      responseByParticipant.set(nextBurst.participantId, arr);
    }
    const size = burst.messageIndexes.length;
    if (size > maxBurstMessages) {
      maxBurstMessages = size;
      maxBurstTs = burst.startTs;
      maxBurstParticipant = burst.participantId;
    }
  }

  // Finalize participant stats
  for (const s of perParticipant.values()) {
    s.sharePct = eligible.length > 0 ? (s.messages / eligible.length) * 100 : 0;
    s.avgChars = s.messages > 0 ? s.chars / s.messages : 0;
    s.emojiPerMessage = s.messages > 0 ? s.emoji / s.messages : 0;
  }

  // Recompute emoji per participant precisely (media/system messages excluded).
  for (const s of perParticipant.values()) s.emoji = 0;
  eligible.forEach((m) => {
    if (m.hasAttachment || m.isSystemMessage) return;
    const list = extractEmoji(m.text);
    const stats = perParticipant.get(m.participantId);
    if (stats) stats.emoji += list.length;
  });
  for (const s of perParticipant.values()) {
    s.emojiPerMessage = s.messages > 0 ? s.emoji / s.messages : 0;
  }

  for (const [pid, durations] of responseByParticipant) {
    const s = perParticipant.get(pid);
    if (!s) continue;
    s.responses = durations.length;
    s.medianResponseMs = median(durations);
    s.avgResponseMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    s.fastestResponseMs = minOf(durations);
  }

  const totalDurations = responseValid.map((r) => r.durationMs);
  const response = responseValid.length
    ? {
        count: responseValid.length,
        avgMs: Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length),
        medianMs: median(totalDurations)!,
        fastestMs: minOf(totalDurations),
        longestGapMs,
        longestGapFromTs,
        longestGapToTs,
      }
    : null;

  // Rankings (deterministic: count desc, then insertion order)
  const emojiRanking = [...emojiCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([emoji, count]) => ({ emoji, count }));
  const wordRanking = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([word, count]) => ({ word, count }));

  const monthly = [...monthCounts.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  const daily: DayPoint[] = [...dayCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayTs, count]) => ({ dayTs, count }));

  const busiestMonth = monthly.length
    ? monthly.reduce((best, cur) => (cur.count > best.count ? cur : best))
    : null;
  const quietestMonth = monthly.length
    ? monthly.reduce((best, cur) => (cur.count < best.count ? cur : best))
    : null;
  const busiestDay = daily.length
    ? daily.reduce((best, cur) => (cur.count > best.count ? cur : best))
    : null;
  const mostActiveHour = hourly.some((v) => v > 0)
    ? hourly.reduce((bestIdx, v, idx) => (v > hourly[bestIdx]! ? idx : bestIdx), 0)
    : null;
  const streak = longestStreak([...dayCounts.keys()]);

  const participants = [...perParticipant.values()].sort(
    (a, b) => b.messages - a.messages || a.displayName.localeCompare(b.displayName),
  );

  const weekendMessages = weekday[0]! + weekday[6]!;
  const weekendSharePct = eligible.length > 0 ? (weekendMessages / eligible.length) * 100 : 0;

  if (anyNullTimestamp) {
    sampleNotes.push(
      "Some messages have no timestamp and are excluded from all time-based metrics.",
    );
  }
  if (eligible.length < 20) {
    sampleNotes.push(
      "Small sample: statistics below may be less meaningful for tiny conversations.",
    );
  }

  return {
    eligibleMessages: eligible.length,
    totalParsed: conversation.messages.length,
    systemCount: conversation.messages.filter((m) => m.isSystemMessage).length,
    mediaCount,
    totalWords,
    totalChars,
    avgMessageChars: eligible.length > 0 ? totalChars / eligible.length : 0,
    activeDays: dayCounts.size,
    dateRange: firstTs !== null && lastTs !== null ? { from: firstTs, to: lastTs } : null,
    firstMessageTs: firstTs,
    lastMessageTs: lastTs,
    participants,
    monthly,
    daily,
    hourly,
    heatmap,
    weekday,
    weekendSharePct,
    busiestMonth,
    quietestMonth,
    busiestDay,
    mostActiveHour,
    longestStreak: streak,
    response,
    emojiRanking,
    wordRanking,
    emojiPerMessage: eligible.length > 0 ? emojiTotal / eligible.length : 0,
    questionRate: eligible.length > 0 ? questionTotal / eligible.length : 0,
    burst: {
      maxMessages: maxBurstMessages,
      maxMessagesTs: maxBurstTs,
      maxParticipantId: maxBurstParticipant,
    },
    longestMessage,
    sampleNotes,
  };
}

/** Human-readable records for the dashboard. */
export function buildRecords(result: AnalyticsResult): RecordEntry[] {
  const records: RecordEntry[] = [];
  const fmt = formatMonthYear;

  if (result.longestMessage) {
    const who = result.participants.find(
      (p) => p.participantId === result.longestMessage!.participantId,
    );
    records.push({
      id: "longest-message",
      label: "Longest message",
      value: `${result.longestMessage.chars} characters`,
      detail: `by ${who?.displayName ?? "unknown"} — “${result.longestMessage.preview}”`,
    });
  }
  if (result.busiestDay) {
    records.push({
      id: "busiest-day",
      label: "Most active day",
      value: `${result.busiestDay.count} messages`,
      detail: new Date(result.busiestDay.dayTs).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    });
  }
  if (result.busiestMonth) {
    records.push({
      id: "busiest-month",
      label: "Most active month",
      value: `${result.busiestMonth.count} messages`,
      detail: fmt(result.busiestMonth.year, result.busiestMonth.month0),
    });
  }
  if (result.quietestMonth && result.monthly.length > 1) {
    records.push({
      id: "quietest-month",
      label: "Quietest month",
      value: `${result.quietestMonth.count} messages`,
      detail: fmt(result.quietestMonth.year, result.quietestMonth.month0),
    });
  }
  if (result.longestStreak) {
    records.push({
      id: "streak",
      label: "Longest active streak",
      value: `${result.longestStreak.length} days`,
      detail: `consecutive days with at least one message`,
    });
  }
  const nightMessages = result.hourly.slice(0, 5).reduce((a, b) => a + b, 0);
  if (nightMessages > 0) {
    records.push({
      id: "late-night",
      label: "Late-night messages",
      value: `${nightMessages} between 12am–5am`,
      detail: `${((nightMessages / result.eligibleMessages) * 100).toFixed(1)}% of all eligible messages`,
    });
  }
  const earlyMessages = result.hourly.slice(5, 8).reduce((a, b) => a + b, 0);
  if (earlyMessages > 0) {
    records.push({
      id: "early-morning",
      label: "Early-morning messages",
      value: `${earlyMessages} between 5am–8am`,
      detail: `${((earlyMessages / result.eligibleMessages) * 100).toFixed(1)}% of all eligible messages`,
    });
  }
  if (result.burst.maxMessages > 1 && result.burst.maxParticipantId) {
    const who = result.participants.find((p) => p.participantId === result.burst.maxParticipantId);
    records.push({
      id: "burst",
      label: "Biggest message burst",
      value: `${result.burst.maxMessages} messages in a row`,
      detail: `by ${who?.displayName ?? "unknown"} (messages sent within ${2} minutes of each other)`,
    });
  }
  if (result.wordRanking[0]) {
    records.push({
      id: "top-expression",
      label: "Most-used expression",
      value: `“${result.wordRanking[0].word}”`,
      detail: `used ${result.wordRanking[0].count} times (stopwords excluded)`,
    });
  }
  return records;
}
