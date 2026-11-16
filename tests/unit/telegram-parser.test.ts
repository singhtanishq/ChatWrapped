import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTelegram, parseTelegramDate } from "@/features/parsers/telegram";
import { detectFormat, parseConversation } from "@/features/parsers/detect";
import { ParseError } from "@/features/types";

const FIX = (p: string) => readFileSync(join(process.cwd(), "tests/fixtures/telegram", p), "utf8");

describe("Telegram JSON parser (result-small.json)", () => {
  const raw = FIX("result-small.json");
  const { conversation } = parseTelegram(raw);

  it("uses the export name as the conversation title", () => {
    expect(conversation.title).toBe("Elena");
    expect(conversation.platform).toBe("telegram");
  });

  it("extracts participants", () => {
    expect(conversation.participants.map((p) => p.displayName).sort()).toEqual(["Elena", "Sam"]);
  });

  it("counts eligible and service messages", () => {
    expect(conversation.messages).toHaveLength(8);
    expect(conversation.messages.filter((m) => !m.isSystemMessage)).toHaveLength(7);
    expect(conversation.messages.filter((m) => m.isSystemMessage)).toHaveLength(1);
  });

  it("flattens formatted text parts including links", () => {
    const menu = conversation.messages.find((m) => m.text.includes("menu"));
    expect(menu!.text).toBe("Look at this menu I found the other day 😄");
  });

  it("marks photo attachments as media and keeps the caption", () => {
    const photo = conversation.messages.find((m) => m.hasAttachment && m.text.includes("pancakes"));
    expect(photo).toBeDefined();
    expect(photo!.type).toBe("media");
    expect(photo!.participantId).toBe("Sam");
  });

  it("uses the sticker emoji as media content", () => {
    const stickerMsg = conversation.messages.find((m) => m.text === "🐼");
    expect(stickerMsg).toBeDefined();
    expect(stickerMsg!.hasAttachment).toBe(true);
  });

  it("parses wall-clock dates as UTC epochs", () => {
    expect(parseTelegramDate("2024-05-10T09:00:00")).toBe(Date.UTC(2024, 4, 10, 9, 0, 0));
    const first = conversation.messages[0]!;
    expect(first.timestamp).toBe(Date.UTC(2024, 4, 10, 9, 0, 0));
  });

  it("warns once about forwarded messages", () => {
    const fw = conversation.importWarnings.filter((w) => w.includes("Forwarded"));
    expect(fw).toHaveLength(1);
  });
});

describe("Telegram JSON parser (group-small.json)", () => {
  const { conversation } = parseTelegram(FIX("group-small.json"));

  it("reads the group title and all three participants", () => {
    expect(conversation.title).toBe("Dribble Club");
    expect(conversation.participants.map((p) => p.displayName).sort()).toEqual([
      "Jules",
      "Marco",
      "Priya",
    ]);
  });

  it("counts 12 eligible messages and 2 service events", () => {
    expect(conversation.messages.filter((m) => !m.isSystemMessage)).toHaveLength(12);
    expect(conversation.messages.filter((m) => m.isSystemMessage)).toHaveLength(2);
  });

  it("attributes service events to the acting participant", () => {
    const created = conversation.messages.find((m) => m.text.includes("created the group"));
    expect(created!.participantId).toBe("Priya");
    expect(created!.isSystemMessage).toBe(true);
  });

  it("detects voice messages as attachments", () => {
    const voice = conversation.messages.find((m) => m.hasAttachment && m.text === "");
    expect(voice).toBeDefined();
    expect(voice!.participantId).toBe("Marco");
  });
});

describe("Telegram JSON parser (edge-cases.json)", () => {
  const { conversation } = parseTelegram(FIX("edge-cases.json"));

  it("flattens mentions, hashtags, custom emoji and bot commands", () => {
    const formatted = conversation.messages.find((m) => m.text.includes("Formatted"));
    expect(formatted!.text).toBe("Formatted @Iris with a #victory and 😎 plus a /done");
  });

  it("keeps messages without dates with a null timestamp and warns", () => {
    const noDate = conversation.messages.find((m) => m.text.startsWith("This entry has no date"));
    expect(noDate).toBeDefined();
    expect(noDate!.timestamp).toBeNull();
    expect(
      conversation.importWarnings.some((w) => w.includes("1 message(s) had no usable timestamp")),
    ).toBe(true);
  });

  it("resolves anonymous admin messages via the actor field", () => {
    const anon = conversation.messages.find((m) => m.text.includes("anonymous admin"));
    expect(anon!.participantId).toBe("Noah");
  });

  it("keeps multilingual unicode intact", () => {
    const uni = conversation.messages.find((m) => m.text.includes("汉字"));
    expect(uni!.text).toContain("देवनागरी");
    expect(uni!.text).toContain("한글");
  });

  it("uses poll questions as message text", () => {
    const poll = conversation.messages.find((m) => m.text === "Lunch place?");
    expect(poll).toBeDefined();
    expect(poll!.hasAttachment).toBe(false);
  });

  it("skips malformed non-object entries with a warning", () => {
    expect(conversation.importWarnings.some((w) => w.includes("malformed"))).toBe(true);
  });

  it("counts 7 eligible messages", () => {
    expect(conversation.messages.filter((m) => !m.isSystemMessage)).toHaveLength(7);
  });
});

describe("Telegram parser error handling", () => {
  it("throws malformed-json for broken JSON", () => {
    expect(() => parseTelegram("{not json")).toThrow(ParseError);
  });

  it("throws unsupported-format for JSON without messages", () => {
    expect(() => parseTelegram('{"foo": 1}')).toThrow(/does not contain a Telegram message export/);
  });

  it("throws no-messages for an empty export", () => {
    expect(() => parseTelegram('{"name": "X", "messages": []}')).toThrow(/no messages/);
  });
});

describe("Format detection", () => {
  it("detects WhatsApp by content", () => {
    const sample = FIX("../whatsapp/android-small.txt");
    expect(detectFormat(sample).format).toBe("whatsapp");
  });

  it("detects WhatsApp iOS bracketed format", () => {
    expect(detectFormat(FIX("../whatsapp/ios-small.txt")).format).toBe("whatsapp");
  });

  it("detects Telegram JSON by content, even without a BOM", () => {
    expect(detectFormat(FIX("result-small.json")).format).toBe("telegram-json");
  });

  it("routes detected formats through parseConversation", () => {
    const res = parseConversation(FIX("result-small.json"), "telegram-json");
    expect(res.conversation.platform).toBe("telegram");
  });

  it("rejects unknown content", () => {
    expect(detectFormat("hello world, this is not a chat").format).toBe("unknown");
  });
});
