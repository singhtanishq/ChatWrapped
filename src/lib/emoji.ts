/**
 * Unicode-aware emoji utilities.
 *
 * Uses Intl.Segmenter grapheme clusters so combined emoji (ZWJ sequences,
 * skin tones, flags, keycaps) count as one emoji, never misleading pieces.
 * Trademark/copyright symbols are excluded (Extended_Pictographic but not
 * user-perceived emoji).
 */

let graphemeSegmenter: Intl.Segmenter | null = null;
let wordSegmenter: Intl.Segmenter | null = null;

function getGraphemes(): Intl.Segmenter {
  graphemeSegmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
  return graphemeSegmenter;
}

export function getWordSegmenter(locale = "en"): Intl.Segmenter {
  wordSegmenter ??= new Intl.Segmenter(locale, { granularity: "word" });
  return wordSegmenter;
}

const EXCLUDED_SYMBOLS = new Set(["©", "®", "™"]);
// Extended_Pictographic + variation selectors + ZWJ + keycaps + regional pairs.
const emojiLike = /(\p{Extended_Pictographic}|\p{Emoji_Component}|[\u{FE0E}\u{FE0F}\u{200D}])/u;

export function isEmojiSegment(segment: string): boolean {
  if (segment.length === 0) return false;
  if (EXCLUDED_SYMBOLS.has(segment)) return false;
  if (!emojiLike.test(segment)) return false;
  // Pure ASCII digits/letters with no VS/ZWJ/keycap are not emoji.
  if (/^[\p{L}\p{N}\s]+$/u.test(segment)) return false;
  return true;
}

/** Extract the distinct emoji grapheme clusters in a text, in order. */
export function extractEmoji(text: string): string[] {
  const out: string[] = [];
  for (const { segment } of getGraphemes().segment(text)) {
    if (isEmojiSegment(segment)) out.push(segment);
  }
  return out;
}

export function countEmoji(text: string): number {
  return extractEmoji(text).length;
}

export function hasEmoji(text: string): boolean {
  for (const { segment } of getGraphemes().segment(text)) {
    if (isEmojiSegment(segment)) return true;
  }
  return false;
}

/** Count grapheme clusters (user-perceived characters), not code units. */
export function graphemeCount(text: string): number {
  let n = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of getGraphemes().segment(text)) n++;
  return n;
}
