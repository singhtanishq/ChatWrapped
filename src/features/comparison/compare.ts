/**
 * Conversation comparison (Module F).
 *
 * Compares aggregate analytics across conversations loaded in the current
 * session. Sample sizes and date ranges are always shown so unlike samples
 * are not compared misleadingly.
 */

import type { AnalyticsResult } from "../analytics/types";
import { formatHour, formatInt, formatMinutes, formatMonthYear } from "@/lib/format";

export interface ComparisonItem {
  id: string;
  label: string;
  analytics: AnalyticsResult;
}

export interface ComparisonMetric {
  id: string;
  label: string;
  hint?: string;
  values: string[];
}

export function compareConversations(items: ComparisonItem[]): ComparisonMetric[] {
  const a = (r: AnalyticsResult) => r;
  return [
    {
      id: "messages",
      label: "Eligible messages",
      values: items.map((i) => formatInt(a(i.analytics).eligibleMessages)),
    },
    {
      id: "words",
      label: "Total words",
      values: items.map((i) => formatInt(a(i.analytics).totalWords)),
    },
    {
      id: "participants",
      label: "Participants",
      values: items.map((i) => formatInt(a(i.analytics).participants.length)),
    },
    {
      id: "active-days",
      label: "Active days",
      values: items.map((i) => formatInt(a(i.analytics).activeDays)),
    },
    {
      id: "range",
      label: "Date range",
      hint: "Comparisons are most meaningful for similar ranges and sample sizes",
      values: items.map((i) => {
        const r = a(i.analytics);
        if (!r.firstMessageTs || !r.lastMessageTs) return "—";
        return `${formatMonthYear(new Date(r.firstMessageTs).getUTCFullYear(), new Date(r.firstMessageTs).getUTCMonth())} – ${formatMonthYear(
          new Date(r.lastMessageTs).getUTCFullYear(),
          new Date(r.lastMessageTs).getUTCMonth(),
        )}`;
      }),
    },
    {
      id: "busiest-day",
      label: "Busiest day",
      values: items.map((i) =>
        a(i.analytics).busiestDay ? formatInt(a(i.analytics).busiestDay!.count) : "—",
      ),
    },
    {
      id: "peak-hour",
      label: "Peak hour",
      values: items.map((i) =>
        a(i.analytics).mostActiveHour !== null ? formatHour(a(i.analytics).mostActiveHour!) : "—",
      ),
    },
    {
      id: "weekend",
      label: "Weekend share",
      values: items.map((i) => `${a(i.analytics).weekendSharePct.toFixed(0)}%`),
    },
    {
      id: "streak",
      label: "Longest streak",
      values: items.map((i) =>
        a(i.analytics).longestStreak ? `${a(i.analytics).longestStreak!.length} days` : "—",
      ),
    },
    {
      id: "response",
      label: "Median response",
      values: items.map((i) =>
        a(i.analytics).response ? formatMinutes(a(i.analytics).response!.medianMs) : "—",
      ),
    },
    {
      id: "top-emoji",
      label: "Top emoji",
      values: items.map((i) => a(i.analytics).emojiRanking[0]?.emoji ?? "—"),
    },
  ];
}
