import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWhatsApp } from "@/features/parsers/whatsapp";
import { parseTelegram } from "@/features/parsers/telegram";
import {
  computeAnalytics,
  buildRecords,
  computeAwards,
  selectEligible,
} from "@/features/analytics";
import type { ParsedConversation, ChatMessage } from "@/features/types";

const FIX = (p: string) => readFileSync(join(process.cwd(), "tests/fixtures", p), "utf8");

/** Build a synthetic conversation inline for precise boundary tests. */
function makeConversation(
  messages: Array<[participantId: string, ts: number | null, text: string]>,
): ParsedConversation {
  const ids = [...new Set(messages.map((m) => m[0]))];
  return {
    platform: "whatsapp",
    participants: ids.map((id) => ({ id, displayName: id })),
    dateOrder: "day-first",
    dateOrderAmbiguous: false,
    importWarnings: [],
    messages: messages.map((m, i): ChatMessage => ({
      id: `m-${i}`,
      participantId: m[0],
      timestamp: m[1],
      text: m[2],
      type: "text",
      isSystemMessage: false,
      hasAttachment: false,
      sourceIndex: i,
    })),
  };
}

describe("Analytics on android-small.txt", () => {
  const { conversation } = parseWhatsApp(FIX("whatsapp/android-small.txt"));
  const result = computeAnalytics(conversation);

  it("computes eligible message totals and shares", () => {
    expect(result.eligibleMessages).toBe(8);
    expect(result.totalParsed).toBe(9);
    expect(result.systemCount).toBe(1);
    const alice = result.participants.find((p) => p.displayName === "Alice")!;
    const bob = result.participants.find((p) => p.displayName === "Bob")!;
    expect(alice.messages).toBe(5);
    expect(bob.messages).toBe(3);
    expect(alice.sharePct).toBeCloseTo(62.5, 5);
    expect(bob.sharePct).toBeCloseTo(37.5, 5);
    expect(result.mediaCount).toBe(1);
  });

  it("counts words including stopwords", () => {
    // Hand-counted with ICU word segmentation:
    // 10 + 9 + 9 + 0 + 5 + 9 + 6 + 5 = 53
    expect(result.totalWords).toBe(53);
  });

  it("counts grapheme-based characters", () => {
    // Hand-counted: 52 + 49 + 51 + 0 + 30 + 61 + 27 + 27 = 297
    expect(result.totalChars).toBe(297);
    expect(result.avgMessageChars).toBeCloseTo(37.125, 5);
  });

  it("computes time metrics", () => {
    expect(result.activeDays).toBe(2);
    expect(result.hourly[10]).toBe(5);
    expect(result.hourly[9]).toBe(3);
    expect(result.mostActiveHour).toBe(10);
    expect(result.weekday[1]).toBe(5); // Monday
    expect(result.weekday[2]).toBe(3); // Tuesday
    expect(result.weekendSharePct).toBe(0);
    expect(result.longestStreak!.length).toBe(2);
    expect(result.busiestDay!.count).toBe(5);
    expect(result.busiestMonth!.key).toBe("2023-12");
  });

  it("computes response statistics with the burst rule", () => {
    // Bursts: A@10:05, B@10:07, A@10:09+10:09, B@10:11, B(next day)@09:15, A@09:18+09:19
    // Events: A→B 2m, B→A 2m, A→B 2m, B→A 3m  (B→B transition produces none)
    expect(result.response!.count).toBe(4);
    expect(result.response!.medianMs).toBe(120_000);
    expect(result.response!.avgMs).toBe(135_000);
    expect(result.response!.fastestMs).toBe(120_000);
    const alice = result.participants.find((p) => p.displayName === "Alice")!;
    const bob = result.participants.find((p) => p.displayName === "Bob")!;
    expect(alice.responses).toBe(2);
    expect(alice.medianResponseMs).toBe(150_000);
    expect(bob.responses).toBe(2);
    expect(bob.medianResponseMs).toBe(120_000);
  });

  it("computes conversation starts (first message + gaps ≥ 4h)", () => {
    const alice = result.participants.find((p) => p.displayName === "Alice")!;
    const bob = result.participants.find((p) => p.displayName === "Bob")!;
    expect(alice.conversationStarts).toBe(1);
    expect(bob.conversationStarts).toBe(1);
  });

  it("computes emoji metrics", () => {
    expect(result.emojiRanking).toHaveLength(3); // 🧺 🎉 👋 all used once
    expect(result.emojiPerMessage).toBeCloseTo(0.375, 5);
    const alice = result.participants.find((p) => p.displayName === "Alice")!;
    const bob = result.participants.find((p) => p.displayName === "Bob")!;
    expect(alice.emoji).toBe(2);
    expect(bob.emoji).toBe(1);
  });

  it("computes word ranking (stopwords excluded)", () => {
    expect(result.wordRanking[0]!.word).toBe("picnic");
    expect(result.wordRanking[0]!.count).toBe(2);
    expect(result.wordRanking.every((w) => !["the", "and", "you"].includes(w.word))).toBe(true);
  });

  it("computes punctuation rates and the longest message", () => {
    expect(result.questionRate).toBeCloseTo(0.25, 5); // 2 questions / 8 messages
    expect(result.longestMessage!.chars).toBe(61);
    expect(result.longestMessage!.participantId).toBe("Bob");
    expect(result.burst.maxMessages).toBe(2);
    expect(result.burst.maxParticipantId).toBe("Alice");
  });

  it("adds a small-sample note", () => {
    expect(result.sampleNotes.some((n) => n.includes("Small sample"))).toBe(true);
  });

  it("builds human-readable records", () => {
    const records = buildRecords(result);
    expect(records.find((r) => r.id === "top-expression")!.value).toBe("“picnic”");
    expect(records.find((r) => r.id === "streak")!.value).toBe("2 days");
  });
});

describe("Analytics exclusions and date ranges", () => {
  const { conversation } = parseWhatsApp(FIX("whatsapp/android-small.txt"));

  it("excludes participants entirely", () => {
    const result = computeAnalytics(conversation, { excludedParticipantIds: ["Bob"] });
    expect(result.eligibleMessages).toBe(5);
    expect(result.participants.map((p) => p.displayName)).toEqual(["Alice"]);
    expect(result.participants[0]!.sharePct).toBe(100);
  });

  it("filters by date range (12/26 only)", () => {
    const from = Date.UTC(2023, 11, 26, 0, 0, 0);
    const to = Date.UTC(2023, 11, 26, 23, 59, 59);
    const result = computeAnalytics(conversation, { dateRange: { from, to } });
    expect(result.eligibleMessages).toBe(3);
    expect(result.activeDays).toBe(1);
  });

  it("can exclude attachment events", () => {
    const result = computeAnalytics(conversation, { excludeAttachments: true });
    expect(result.eligibleMessages).toBe(7);
    expect(result.mediaCount).toBe(0);
  });

  it("determinism: identical inputs produce identical output", () => {
    const a = computeAnalytics(conversation);
    const b = computeAnalytics(conversation);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("Response rules on synthetic boundary cases", () => {
  const base = Date.UTC(2024, 0, 1, 8, 0, 0);

  it("groups rapid consecutive messages into a single burst (120s window)", () => {
    const conv = makeConversation([
      ["A", base, "one"],
      ["A", base + 60_000, "two"],
      ["A", base + 115_000, "three"], // within 120s of previous → same burst
      ["B", base + 400_000, "reply"],
    ]);
    const result = computeAnalytics(conv);
    expect(result.response!.count).toBe(1);
    expect(result.response!.medianMs).toBe(400_000); // measured from burst START
    expect(result.burst.maxMessages).toBe(3);
  });

  it("splits bursts when the gap exceeds 120s", () => {
    const conv = makeConversation([
      ["A", base, "one"],
      ["A", base + 121_000, "two"], // > 120s → new burst
      ["B", base + 240_000, "reply"],
    ]);
    const result = computeAnalytics(conv);
    expect(result.response!.count).toBe(1);
    expect(result.response!.medianMs).toBe(240_000 - 121_000); // from second burst start
  });

  it("excludes responses beyond 6h from averages but keeps longest gap", () => {
    const conv = makeConversation([
      ["A", base, "hello?"],
      ["B", base + 7 * 3600_000, "sorry, was asleep"],
      ["A", base + 7 * 3600_000 + 60_000, "np"],
    ]);
    const result = computeAnalytics(conv);
    expect(result.response!.count).toBe(1); // the 1-min reply from A to B
    expect(result.response!.longestGapMs).toBe(7 * 3600_000);
    expect(result.response!.longestGapFromTs).toBe(base);
  });

  it("boundary: exactly 6 hours is a valid response", () => {
    const conv = makeConversation([
      ["A", base, "a"],
      ["B", base + 6 * 3600_000, "b"], // exactly 6h → valid (inclusive)
      ["A", base + 7 * 3600_000, "c"], // 1h → valid
    ]);
    const result = computeAnalytics(conv);
    expect(result.response!.count).toBe(2);
    expect(result.response!.fastestMs).toBe(3_600_000);
  });

  it("boundary: 6h + 1ms is not a valid response", () => {
    const conv = makeConversation([
      ["A", base, "a"],
      ["B", base + 6 * 3600_000 + 1, "b"], // 6h+1ms → invalid
      ["A", base + 7 * 3600_000, "c"], // 1h → valid
    ]);
    const result = computeAnalytics(conv);
    expect(result.response!.count).toBe(1);
  });

  it("conversation start requires a ≥ 4h gap", () => {
    const conv = makeConversation([
      ["A", base, "1"],
      ["B", base + 4 * 3600_000 - 1000, "2"], // just under 4h → same conversation
      ["A", base + 8 * 3600_000, "3"], // ≥ 4h → new conversation
    ]);
    const result = computeAnalytics(conv);
    const a = result.participants.find((p) => p.participantId === "A")!;
    const b = result.participants.find((p) => p.participantId === "B")!;
    expect(a.conversationStarts).toBe(2); // first message + the new conversation
    expect(b.conversationStarts).toBe(0);
  });

  it("streak calculation across synthetic days", () => {
    const days = [1, 2, 3, 7, 8, 20].map((d) => Date.UTC(2024, 0, d));
    const conv = makeConversation(days.map((ts) => ["A", ts, "hi"] as [string, number, string]));
    const result = computeAnalytics(conv);
    expect(result.longestStreak!.length).toBe(3);
  });
});

describe("Analytics on Telegram fixtures", () => {
  it("computes analytics for result-small.json", () => {
    const { conversation } = parseTelegram(FIX("telegram/result-small.json"));
    const result = computeAnalytics(conversation);
    expect(result.eligibleMessages).toBe(7);
    const elena = result.participants.find((p) => p.displayName === "Elena")!;
    const sam = result.participants.find((p) => p.displayName === "Sam")!;
    expect(elena.messages).toBe(4);
    expect(sam.messages).toBe(3);
    // Valid responses: 4min, 66min, 2.5min, 1min, 1min (27h48m reply excluded)
    expect(result.response!.count).toBe(5);
    expect(result.response!.medianMs).toBe(150_000);
    expect(result.response!.fastestMs).toBe(60_000);
    // Sticker counts as media with emoji content
    expect(result.mediaCount).toBe(2);
  });

  it("computes analytics for group-small.json", () => {
    const { conversation } = parseTelegram(FIX("telegram/group-small.json"));
    const result = computeAnalytics(conversation);
    expect(result.eligibleMessages).toBe(12);
    expect(result.systemCount).toBe(2);
    expect(result.participants).toHaveLength(3);
    expect(result.participants.every((p) => p.sharePct > 0)).toBe(true);
    expect(result.weekendSharePct).toBeGreaterThan(0); // June 1-2, 2024 = Sat/Sun
  });
});

describe("Awards", () => {
  it("withholds awards when data is insufficient", () => {
    const conv = makeConversation([
      ["A", Date.UTC(2024, 0, 1), "hi"],
      ["B", Date.UTC(2024, 0, 1, 0, 1), "hey"],
    ]);
    const result = computeAnalytics(conv);
    const awards = computeAwards(result);
    expect(awards).toHaveLength(0); // minMessages = 10 not reached by anyone
  });

  it("grants Night Owl and Speed Responder on qualifying synthetic data", () => {
    const night = Date.UTC(2024, 0, 1, 0, 30, 0); // 00:30
    const msgs: Array<[string, number, string]> = [];
    // A sends 20 night messages alone (00:30–01:49).
    for (let i = 0; i < 20; i++) msgs.push(["A", night + i * 60_000, `night message ${i} 🌙`]);
    // Then 6 daytime bursts where B replies within 30s. A's replies take ~1h (never ≤ 5min).
    for (let i = 0; i < 6; i++) {
      const t = Date.UTC(2024, 0, 1, 9 + i, 0, 0);
      msgs.push(["A", t, `day ping ${i}`]);
      msgs.push(["B", t + 30_000, `quick reply ${i}`]);
    }
    const conv = makeConversation(msgs);
    const result = computeAnalytics(conv);
    const awards = computeAwards(result);
    const nightOwl = awards.find((a) => a.id === "night-owl");
    expect(nightOwl).toBeDefined();
    expect(nightOwl!.winnerNames).toEqual(["A"]);
    const speed = awards.find((a) => a.id === "speed-responder");
    expect(speed).toBeDefined();
    expect(speed!.winnerNames).toEqual(["B"]);
    const starter = awards.find((a) => a.id === "conversation-starter");
    expect(starter).toBeUndefined(); // 2 conversation starts, needs ≥ 3
  });

  it("reports ties honestly", () => {
    const msgs: Array<[string, number, string]> = [];
    const base = Date.UTC(2024, 0, 1, 0, 30, 0);
    // A and B send identical night message counts
    for (let i = 0; i < 20; i++) {
      msgs.push(["A", base + i * 120_000, `night ${i}`]);
      msgs.push(["B", base + i * 120_000 + 30_000, `night ${i}`]);
    }
    const conv = makeConversation(msgs);
    const result = computeAnalytics(conv);
    const nightOwl = computeAwards(result).find((a) => a.id === "night-owl");
    expect(nightOwl!.tied).toBe(true);
    expect(nightOwl!.winnerNames.sort()).toEqual(["A", "B"]);
  });

  it("selectEligible applies all exclusions together", () => {
    const { conversation } = parseWhatsApp(FIX("whatsapp/group-small.txt"));
    const eligible = selectEligible(conversation, {
      excludedParticipantIds: ["Dev"],
      excludeSystemMessages: true,
      excludeAttachments: false,
    });
    expect(eligible.every((m) => m.participantId !== "Dev" && !m.isSystemMessage)).toBe(true);
    expect(eligible).toHaveLength(9); // 13 eligible − 4 Dev messages
  });
});
