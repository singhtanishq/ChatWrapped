/**
 * Story generation engine (Module C).
 *
 * Builds an adaptive sequence of 8–15 slides from calculated analytics.
 * Slides for unavailable metrics are skipped — never fabricated. All values
 * come from the AnalyticsResult; text is playful but factual.
 */

import type { AnalyticsResult, ParticipantStats } from "../analytics/types";
import {
  formatHour,
  formatInt,
  formatMinutes,
  formatMonthYear,
  formatDayShort,
  plural,
} from "@/lib/format";
import type { ThemeTokens } from "../themes/themes";

export type SlideVisual =
  | { kind: "none" }
  | { kind: "share"; parts: Array<{ label: string; pct: number; color: string }> }
  | { kind: "trend"; points: Array<{ label: string; count: number }>; highlight: string }
  | { kind: "hour"; hour: number; share: number }
  | { kind: "emoji"; emoji: string; count: number; sharePct: number }
  | { kind: "streak"; length: number; startLabel: string; endLabel: string }
  | { kind: "starts"; rows: Array<{ label: string; count: number; pct: number }>; color: string }
  | { kind: "response"; median: string; avg: string; fastest: string }
  | { kind: "day"; count: number; label: string }
  | { kind: "words"; words: Array<{ word: string; count: number }> }
  | { kind: "burst"; count: number; label: string };

export interface StorySlide {
  id: string;
  kicker: string;
  title: string;
  value: string;
  detail: string;
  visual: SlideVisual;
}

export interface StoryInput {
  analytics: AnalyticsResult;
  /** Effective (possibly anonymized) display names by participant id. */
  names: Record<string, string>;
  conversationTitle: string;
  isDemo: boolean;
}

const CHART_COLORS = (theme: ThemeTokens) => theme.chartPalette;

function shareParts(result: AnalyticsResult, names: Record<string, string>, theme: ThemeTokens) {
  const palette = CHART_COLORS(theme);
  const parts = result.participants.map((p, i) => ({
    label: names[p.participantId] ?? p.displayName,
    pct: p.sharePct,
    color: palette[i % palette.length]!,
  }));
  return parts;
}

export function generateStory(input: StoryInput, theme: ThemeTokens): StorySlide[] {
  const { analytics: r, names } = input;
  const slides: StorySlide[] = [];
  const top = (list: ParticipantStats[]) => list[0];

  // 1 — Intro
  const rangeLabel =
    r.dateRange && r.firstMessageTs && r.lastMessageTs
      ? `${formatMonthYear(new Date(r.firstMessageTs).getUTCFullYear(), new Date(r.firstMessageTs).getUTCMonth())} – ${formatMonthYear(
          new Date(r.lastMessageTs).getUTCFullYear(),
          new Date(r.lastMessageTs).getUTCMonth(),
        )}`
      : "your chat";
  slides.push({
    id: "intro",
    kicker: input.isDemo ? "Sample data" : input.conversationTitle,
    title: "Your conversation,\nunwrapped",
    value: rangeLabel,
    detail: input.isDemo
      ? "This is synthetic sample data — no real chats here."
      : `${plural(r.participants.length, "participant")}`,
    visual: { kind: "none" },
  });

  if (r.eligibleMessages > 0) {
    // 2 — Total messages
    slides.push({
      id: "messages",
      kicker: "Chapter one",
      title: "You exchanged",
      value: formatInt(r.eligibleMessages),
      detail: `messages · ${formatInt(r.totalWords)} words · ${formatInt(r.totalChars)} characters`,
      visual: { kind: "none" },
    });

    // 3 — Who sent more
    if (r.participants.length >= 2) {
      const first = top(r.participants)!;
      const second = r.participants[1]!;
      slides.push({
        id: "share",
        kicker: "The scoreboard",
        title: `${names[first.participantId] ?? first.displayName} sent ${first.sharePct.toFixed(0)}%`,
        value: `${first.sharePct.toFixed(0)}% / ${second.sharePct.toFixed(0)}%`,
        detail: `${names[first.participantId] ?? first.displayName} vs ${names[second.participantId] ?? second.displayName}`,
        visual: { kind: "share", parts: shareParts(r, names, theme) },
      });
    }

    // 4 — Busiest month + trend
    if (r.monthly.length >= 2 && r.busiestMonth) {
      slides.push({
        id: "busiest-month",
        kicker: "Peak season",
        title: `${formatMonthYear(r.busiestMonth.year, r.busiestMonth.month0)} was your busiest month`,
        value: plural(r.busiestMonth.count, "message"),
        detail: r.monthly.length > 1 ? `${plural(r.monthly.length, "month")} of conversation` : "",
        visual: {
          kind: "trend",
          points: r.monthly.map((m) => ({
            label: formatMonthYear(m.year, m.month0),
            count: m.count,
          })),
          highlight: r.busiestMonth.key,
        },
      });
    }

    // 5 — Favorite hour
    if (r.mostActiveHour !== null) {
      const hourCount = r.hourly[r.mostActiveHour]!;
      const share = (hourCount / Math.max(r.eligibleMessages, 1)) * 100;
      slides.push({
        id: "favorite-hour",
        kicker: "The golden hour",
        title: `${formatHour(r.mostActiveHour)} is when you talk the most`,
        value: formatHour(r.mostActiveHour),
        detail: `${share.toFixed(0)}% of all messages land in this hour`,
        visual: { kind: "hour", hour: r.mostActiveHour, share },
      });
    }

    // 6 — Top emoji
    if (r.emojiRanking.length > 0) {
      const e = r.emojiRanking[0]!;
      const totalEmoji = r.emojiRanking.reduce((a, x) => a + x.count, 0);
      slides.push({
        id: "emoji",
        kicker: "The signature",
        title: `Your most-used emoji is ${e.emoji}`,
        value: e.emoji,
        detail: `used ${plural(e.count, "time")} — that's ${((e.count / Math.max(totalEmoji, 1)) * 100).toFixed(0)}% of all emoji`,
        visual: {
          kind: "emoji",
          emoji: e.emoji,
          count: e.count,
          sharePct: (e.count / Math.max(totalEmoji, 1)) * 100,
        },
      });
    }

    // 7 — Streak
    if (r.longestStreak && r.longestStreak.length >= 3) {
      slides.push({
        id: "streak",
        kicker: "Unbreakable",
        title: `You checked in ${plural(r.longestStreak.length, "day")} in a row`,
        value: plural(r.longestStreak.length, "day"),
        detail: `${formatDayShort(
          new Date(r.longestStreak.startTs).getUTCFullYear(),
          new Date(r.longestStreak.startTs).getUTCMonth(),
          new Date(r.longestStreak.startTs).getUTCDate(),
        )} → ${formatDayShort(
          new Date(r.longestStreak.endTs).getUTCFullYear(),
          new Date(r.longestStreak.endTs).getUTCMonth(),
          new Date(r.longestStreak.endTs).getUTCDate(),
        )} without missing a day`,
        visual: { kind: "streak", length: r.longestStreak.length, startLabel: "", endLabel: "" },
      });
    }

    // 8 — Conversation starters
    const starters = [...r.participants]
      .filter((p) => p.conversationStarts > 0)
      .sort((a, b) => b.conversationStarts - a.conversationStarts);
    if (
      r.participants.length >= 2 &&
      starters.length >= 1 &&
      starters[0]!.conversationStarts >= 1
    ) {
      const totalStarts = starters.reduce((a, p) => a + p.conversationStarts, 0);
      slides.push({
        id: "starters",
        kicker: "Who breaks the silence",
        title: `${names[starters[0]!.participantId] ?? starters[0]!.displayName} starts conversations most often`,
        value: plural(starters[0]!.conversationStarts, "start"),
        detail: `${((starters[0]!.conversationStarts / Math.max(totalStarts, 1)) * 100).toFixed(0)}% of all conversation starts`,
        visual: {
          kind: "starts",
          rows: starters.slice(0, 4).map((p, i) => ({
            label: names[p.participantId] ?? p.displayName,
            count: p.conversationStarts,
            pct: (p.conversationStarts / Math.max(totalStarts, 1)) * 100,
            ...(i === 0 ? {} : {}),
          })) as Array<{ label: string; count: number; pct: number }>,
          color: theme.accent,
        },
      });
    }

    // 9 — Response times
    if (r.response) {
      slides.push({
        id: "response",
        kicker: "The rhythm",
        title: "Median reply time",
        value: formatMinutes(r.response.medianMs),
        detail: `fastest reply ${formatMinutes(r.response.fastestMs)} · average ${formatMinutes(r.response.avgMs)}`,
        visual: {
          kind: "response",
          median: formatMinutes(r.response.medianMs),
          avg: formatMinutes(r.response.avgMs),
          fastest: formatMinutes(r.response.fastestMs),
        },
      });
    }

    // 10 — Biggest day
    if (r.busiestDay) {
      const d = new Date(r.busiestDay.dayTs);
      slides.push({
        id: "biggest-day",
        kicker: "The big day",
        title: "Your biggest conversation day",
        value: plural(r.busiestDay.count, "message"),
        detail: d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }),
        visual: { kind: "day", count: r.busiestDay.count, label: "" },
      });
    }

    // 11 — Signature words
    if (r.wordRanking.length >= 3) {
      slides.push({
        id: "words",
        kicker: "Your dictionary",
        title: "Words you own",
        value: `“${r.wordRanking[0]!.word}”`,
        detail: `top words: ${r.wordRanking
          .slice(0, 5)
          .map((w) => w.word)
          .join(", ")}`,
        visual: { kind: "words", words: r.wordRanking.slice(0, 5) },
      });
    }

    // 12 — Biggest burst
    if (r.burst.maxMessages >= 3 && r.burst.maxParticipantId) {
      slides.push({
        id: "burst",
        kicker: "Machine-gun mode",
        title: `Longest message streak in one go`,
        value: plural(r.burst.maxMessages, "message"),
        detail: `sent back-to-back within 2 minutes by ${names[r.burst.maxParticipantId] ?? r.burst.maxParticipantId}`,
        visual: {
          kind: "burst",
          count: r.burst.maxMessages,
          label: names[r.burst.maxParticipantId] ?? "",
        },
      });
    }
  }

  // Finale
  slides.push({
    id: "finale",
    kicker: "That's a wrap",
    title: "Your conversation,\nunwrapped.",
    value: rangeLabel,
    detail: "Make a share card to keep the memory — or start another recap.",
    visual: { kind: "none" },
  });

  return slides;
}
