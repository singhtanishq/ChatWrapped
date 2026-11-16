/**
 * Text tokenization and stopword handling for word analytics.
 *
 * Words are extracted with Intl.Segmenter (locale-aware, Unicode-safe),
 * lowercased, and filtered: pure numbers, URLs and email addresses are
 * excluded from "signature words" since they carry little conversational
 * meaning. Stopwords are configurable.
 */

import { getWordSegmenter } from "./emoji";

export const DEFAULT_STOPWORDS = new Set([
  // English
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "just",
  "like",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "she",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  "yours",
  "ok",
  "okay",
  "oh",
  "yeah",
  "yes",
  "nope",
  "hi",
  "hey",
  "hello",
  "hmm",
  "haha",
  "hahaha",
  "lol",
  "lmao",
  "omg",
  "u",
  "ur",
  "im",
  "dont",
  "didnt",
  "cant",
  "wont",
  "isnt",
  "arent",
  "thats",
  "its",
  "ive",
  "id",
  "ill",
  "youre",
  "gonna",
  "wanna",
  "gotta",
  "lemme",
  "kinda",
  "sorta",
  "ya",
  "na",
  "nah",
  "yep",
  "yup",
  "k",
  "kk",
  "am",
  "pm",
  "do",
  "does",
  "did",
  "done",
  "get",
  "got",
  "go",
  "going",
  "went",
  "can",
  "could",
  "should",
  "shall",
  "may",
  "might",
  "must",
  "about",
  "after",
  "all",
  "also",
  "any",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "did",
  "each",
  "even",
  "ever",
  "every",
  "few",
  "give",
  "good",
  "great",
  "he's",
  "how",
  "into",
  "know",
  "let",
  "make",
  "many",
  "more",
  "most",
  "much",
  "need",
  "new",
  "now",
  "only",
  "other",
  "over",
  "own",
  "same",
  "see",
  "seem",
  "some",
  "still",
  "such",
  "take",
  "thank",
  "thanks",
  "thank-you",
  "think",
  "time",
  "under",
  "until",
  "use",
  "used",
  "very",
  "want",
  "way",
  "well",
  "one",
  "two",
  "really",
  "right",
  "sure",
  "thing",
]);

const URL_RE = /^(?:https?:\/\/|www\.)[^\s]*$/i;
const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export interface TokenizeOptions {
  stopwords?: Set<string>;
  locale?: string;
}

/**
 * Extract word-like tokens for frequency analysis.
 * Pure numbers, URLs, emails and stopwords are excluded.
 */
export function tokenizeWords(text: string, options: TokenizeOptions = {}): string[] {
  const stopwords = options.stopwords ?? DEFAULT_STOPWORDS;
  const out: string[] = [];
  for (const { segment, isWordLike } of getWordSegmenter(options.locale).segment(text)) {
    if (!isWordLike) continue;
    const w = segment.toLowerCase();
    if (!w || stopwords.has(w)) continue;
    if (/^[\p{N}]+(?:[.,:]\p{N}+)*$/u.test(w)) continue; // pure numbers
    if (URL_RE.test(segment.trim()) || EMAIL_RE.test(w)) continue;
    out.push(w);
  }
  return out;
}

/** Total word count including stopwords (for "total words" metrics). */
export function countWords(text: string, locale = "en"): number {
  let n = 0;
  for (const { isWordLike } of getWordSegmenter(locale).segment(text)) {
    if (isWordLike) n++;
  }
  return n;
}

/** Count question marks and exclamation marks per text. */
export function questionCount(text: string): number {
  return (text.match(/[?？]/g) ?? []).length;
}

export function exclamationCount(text: string): number {
  return (text.match(/[!！]/g) ?? []).length;
}
