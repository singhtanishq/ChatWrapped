import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "@/features/parsers/whatsapp";
import { computeAnalytics } from "@/features/analytics";
import { mulberry32 } from "@/lib/rng";

/**
 * Large-file behavior test. The export is generated in-memory (never
 * committed) to measure real parsing performance within documented limits.
 */
describe("Large file performance", () => {
  it("parses a ~10 MB WhatsApp export in reasonable time", () => {
    const rng = mulberry32(42);
    const senders = ["Ava", "Ben", "Chloe", "Dev", "Eli", "Fay"];
    const phrases = [
      "hey are you coming tonight",
      "that sounds great! 🎉",
      "I'll send you the details later",
      "lol that's hilarious 😂",
      "can we move the meeting to 3pm?",
      "just finished the report, sending now",
      "what do you think about the new design?",
      "on my way 🚗",
      "perfect, see you then",
      "the weather is amazing today ☀️",
    ];
    // ~55 bytes per line → 170k messages ≈ 9.5 MB
    const count = 170_000;
    const start = Date.UTC(2023, 0, 1, 8, 0, 0);
    const lines: string[] = [];
    let ts = start;
    for (let i = 0; i < count; i++) {
      ts += Math.floor(rng() * 240_000); // up to 4 minutes apart
      const sender = senders[Math.floor(rng() * senders.length)]!;
      const msg = phrases[Math.floor(rng() * phrases.length)]!;
      const d = new Date(ts);
      const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
      const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      lines.push(`${date}, ${time} - ${sender}: ${msg}`);
    }
    const text = lines.join("\n");
    expect(text.length).toBeGreaterThan(8 * 1024 * 1024);
    expect(text.length).toBeLessThan(12 * 1024 * 1024);

    const t0 = performance.now();
    const { conversation } = parseWhatsApp(text);
    const parseMs = performance.now() - t0;

    expect(conversation.messages.length).toBe(count);
    expect(conversation.participants).toHaveLength(6);

    const t1 = performance.now();
    const result = computeAnalytics(conversation);
    const analyticsMs = performance.now() - t1;

    expect(result.eligibleMessages).toBe(count);
    // Documented limits: parsing 10 MB must stay well under 30 s (typically < 2 s).
    expect(parseMs).toBeLessThan(30_000);
    expect(analyticsMs).toBeLessThan(30_000);
    console.info(
      `perf: ${(text.length / 1024 / 1024) | 0} MB parsed in ${parseMs | 0}ms, analytics in ${analyticsMs | 0}ms`,
    );
  });
});
