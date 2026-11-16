import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWhatsApp } from "@/features/parsers/whatsapp";
import { ParseError } from "@/features/types";

const FIX = (p: string) => readFileSync(join(process.cwd(), "tests/fixtures/whatsapp", p), "utf8");

/** Eligible = non-system messages (excludes encryption notices, deletions, calls). */
function eligible(text: string) {
  const { conversation } = parseWhatsApp(text);
  return conversation.messages.filter((m) => !m.isSystemMessage);
}

describe("WhatsApp Android TXT parser (android-small.txt)", () => {
  const text = FIX("android-small.txt");
  const { conversation } = parseWhatsApp(text);

  it("detects two participants", () => {
    expect(conversation.participants.map((p) => p.displayName).sort()).toEqual(["Alice", "Bob"]);
  });

  it("counts eligible vs system messages", () => {
    expect(conversation.messages).toHaveLength(9); // 8 eligible + 1 encryption notice
    expect(eligible(text)).toHaveLength(8);
    expect(conversation.messages.filter((m) => m.isSystemMessage)).toHaveLength(1);
  });

  it("resolves month-first order from unambiguous evidence (12/25)", () => {
    expect(conversation.dateOrder).toBe("month-first");
    expect(conversation.dateOrderAmbiguous).toBe(false);
  });

  it("normalizes timestamps to UTC-epoch wall clock", () => {
    // 12/25/2023, 10:05 local → Date.UTC(2023, 11, 25, 10, 5)
    const first = eligible(text)[0]!;
    expect(first.timestamp).toBe(Date.UTC(2023, 11, 25, 10, 5, 0));
  });

  it("treats attachment placeholders as media events without polluting text", () => {
    const media = conversation.messages.filter((m) => m.hasAttachment);
    expect(media).toHaveLength(1);
    expect(media[0]!.text).toBe("");
    expect(media[0]!.type).toBe("media");
  });

  it("keeps hour buckets faithful to the source clock", () => {
    const hours = eligible(text).map((m) => new Date(m.timestamp!).getUTCHours());
    expect(hours).toEqual([10, 10, 10, 10, 10, 9, 9, 9]);
  });
});

describe("WhatsApp iOS TXT parser (ios-small.txt)", () => {
  const text = FIX("ios-small.txt");
  const { conversation } = parseWhatsApp(text);

  it("parses the bracketed iOS format with seconds", () => {
    const first = eligible(text)[0]!;
    expect(first.timestamp).toBe(Date.UTC(2023, 11, 25, 10, 5, 12));
    expect(first.participantId).toBe("Alice");
    expect(first.text).toContain("Happy birthday");
  });

  it("resolves day-first order from unambiguous evidence (25/12)", () => {
    expect(conversation.dateOrder).toBe("day-first");
    expect(conversation.dateOrderAmbiguous).toBe(false);
  });

  it("counts 9 eligible messages across two days", () => {
    expect(eligible(text)).toHaveLength(9);
  });
});

describe("WhatsApp group TXT parser (group-small.txt)", () => {
  const text = FIX("group-small.txt");
  const { conversation } = parseWhatsApp(text);

  it("extracts three participants plus system events", () => {
    expect(conversation.participants.map((p) => p.displayName).sort()).toEqual([
      "Dev",
      "Maya",
      "Sofia",
    ]);
    expect(eligible(text)).toHaveLength(13);
    expect(conversation.messages.filter((m) => m.isSystemMessage)).toHaveLength(2);
  });

  it("does not count system events in participant totals", () => {
    const byMaya = conversation.messages.filter((m) => m.participantId === "Maya");
    const systemMaya = byMaya.filter((m) => m.isSystemMessage);
    expect(byMaya.length - systemMaya.length).toBe(6); // 8 lines from Maya, 2 are group-creation events
  });
});

describe("WhatsApp multiline TXT parser (multiline.txt)", () => {
  const text = FIX("multiline.txt");
  const { conversation } = parseWhatsApp(text);

  it("merges continuation lines into the preceding message", () => {
    const msgs = eligible(text);
    // Bob's "Reading it now..." should contain the quoted paragraph inline.
    const merged = msgs.find((m) => m.text.startsWith("Reading it now"));
    expect(merged).toBeDefined();
    expect(merged!.text).toContain("The researchers found");
    expect(merged!.text).toContain("\n");
  });

  it("keeps colons inside message content", () => {
    const msgs = eligible(text);
    const withColon = msgs.find((m) => m.text.includes("section about typos"));
    expect(withColon).toBeDefined();
    expect(withColon!.text).toContain('"Participants with more typos replied faster');
    expect(withColon!.participantId).toBe("Bob");
  });

  it("produces 9 eligible messages (quoted lines merge into their predecessors)", () => {
    expect(eligible(text)).toHaveLength(9);
    expect(conversation.participants.map((p) => p.displayName).sort()).toEqual(["Alice", "Bob"]);
  });
});

describe("WhatsApp emoji-heavy TXT parser (emoji-heavy.txt)", () => {
  it("counts combined emoji sequences as single emoji", async () => {
    const { extractEmoji } = await import("@/lib/emoji");
    const { conversation } = parseWhatsApp(FIX("emoji-heavy.txt"));
    const eligible = conversation.messages.filter((m) => !m.isSystemMessage);

    const m1 = extractEmoji(eligible[0]!.text); // skin tones + ZWJ astronaut
    expect(m1).toEqual(["👍🏽", "👎🏻", "👏", "👏🏿", "🧑‍🚀", "🧑🏽‍🚀"]);

    const m2 = extractEmoji(eligible[1]!.text); // flags + keycaps + ZWJ
    expect(m2).toEqual(["🇮🇳", "🇯🇵", "🇧🇷", "1️⃣", "2️⃣", "3️⃣", "❤️‍🔥", "🏳️‍🌈"]);

    const all = eligible.flatMap((m) => extractEmoji(m.text));
    expect(all).toHaveLength(19); // 6 + 8 + 1 + 1 + 3
    expect(new Set(all).size).toBe(16); // distinct emoji
  });
});

describe("WhatsApp edge-case TXT parser (edge-cases.txt)", () => {
  const text = FIX("edge-cases.txt");
  const { conversation, sourceCount } = parseWhatsApp(text);

  it("flags ambiguous date order (4/4 and 5/4 give no decisive evidence)", () => {
    expect(conversation.dateOrderAmbiguous).toBe(true);
    expect(conversation.importWarnings.some((w) => w.includes("day-first"))).toBe(true);
  });

  it("respects a forced month-first override", () => {
    const { conversation: mf } = parseWhatsApp(text, { dateOrder: "month-first" });
    expect(mf.dateOrder).toBe("month-first");
    expect(mf.dateOrderAmbiguous).toBe(false);
  });

  it("skips header lines before the first timestamp", () => {
    const msgs = conversation.messages;
    expect(msgs[0]!.text).not.toContain("WhatsApp chat with Carol");
  });

  it("parses 12-hour AM/PM boundaries (12:00 AM → 00:00, 12:30 PM → 12:30)", () => {
    const first = conversation.messages[0]!;
    expect(first.timestamp).toBe(Date.UTC(2024, 3, 4, 0, 0, 0)); // 12:00 AM
    const lunch = conversation.messages.find((m) => m.text.startsWith("Sure, but I already ate"));
    expect(lunch!.timestamp).toBe(Date.UTC(2024, 3, 4, 12, 30, 0)); // 12:30 PM
  });

  it("strips bidi marks around media placeholders", () => {
    const media = conversation.messages.filter((m) => m.hasAttachment);
    expect(media).toHaveLength(1);
    expect(media[0]!.participantId).toBe("Dan");
  });

  it("detects deleted messages as system events attributed to the sender", () => {
    const deleted = conversation.messages.filter(
      (m) => m.isSystemMessage && m.participantId !== "system",
    );
    expect(deleted.length).toBeGreaterThanOrEqual(2); // Carol deleted + Dan deleted
    expect(deleted.every((m) => m.type === "system")).toBe(true);
  });

  it("detects missed-call events as system messages", () => {
    const calls = conversation.messages.filter(
      (m) => m.isSystemMessage && m.text.toLowerCase().includes("missed"),
    );
    expect(calls).toHaveLength(1); // the real "Missed voice call" event
    // Dan's "Sorry I missed your call" is regular text, not a system event:
    expect(calls.some((m) => m.participantId === "Dan")).toBe(false);
    expect(calls[0]!.participantId).toBe("Carol");
  });

  it("warns about out-of-order timestamps", () => {
    expect(conversation.importWarnings.some((w) => w.includes("out of chronological order"))).toBe(
      true,
    );
  });

  it("reports the number of source lines (trailing newline yields an extra empty line)", () => {
    expect(sourceCount).toBe(18);
  });
});

describe("WhatsApp parser error handling", () => {
  it("throws unsupported-format for files without timestamps", () => {
    expect(() => parseWhatsApp("just some text\nwithout any timestamps")).toThrow(ParseError);
  });

  it("throws for empty input", () => {
    expect(() => parseWhatsApp("")).toThrow(ParseError);
  });

  it("throws for a JSON blob misrouted to the WhatsApp parser", () => {
    expect(() => parseWhatsApp('{"messages": []}')).toThrow(/No timestamped messages/);
  });
});
