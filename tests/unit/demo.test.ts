import { describe, expect, it } from "vitest";
import { generateDemoConversation, DEMO_CONFIGS } from "@/features/demo/demoData";
import { computeAnalytics } from "@/features/analytics";

describe("Demo data generator", () => {
  it("is deterministic", () => {
    const a = generateDemoConversation("friends");
    const b = generateDemoConversation("friends");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces rich analytics for the friends demo", () => {
    const conv = generateDemoConversation("friends");
    const result = computeAnalytics(conv);
    expect(result.eligibleMessages).toBeGreaterThan(800);
    expect(result.participants).toHaveLength(2);
    expect(result.activeDays).toBeGreaterThan(150);
    expect(result.emojiRanking.length).toBeGreaterThan(5);
    expect(result.response).not.toBeNull();
    expect(result.longestStreak!.length).toBeGreaterThan(10);
    expect(result.monthly.length).toBeGreaterThanOrEqual(7);
    console.info(
      `friends demo: ${result.eligibleMessages} msgs, ${result.activeDays} active days, streak ${result.longestStreak?.length}`,
    );
  });

  it("covers all three demo configurations", () => {
    for (const id of Object.keys(DEMO_CONFIGS) as Array<keyof typeof DEMO_CONFIGS>) {
      const conv = generateDemoConversation(id);
      expect(conv.messages.length).toBeGreaterThan(400);
      const result = computeAnalytics(conv);
      expect(result.eligibleMessages).toBeGreaterThan(300);
    }
  });
});
