/** Analytics result model. Everything here is derived from normalized messages. */

export interface AnalyticsOptions {
  /** Participants excluded from all calculations. */
  excludedParticipantIds?: string[];
  /** Exclude system messages from "eligible" pool (default true). */
  excludeSystemMessages?: boolean;
  /** Exclude media/attachment events from "eligible" pool (default false). */
  excludeAttachments?: boolean;
  /** Optional date range (epoch ms, inclusive) applied to eligible messages. */
  dateRange?: { from: number; to: number } | null;
  /** Custom stopwords for word rankings. */
  stopwords?: Set<string>;
}

export interface ParticipantStats {
  participantId: string;
  displayName: string;
  /** Eligible messages sent. */
  messages: number;
  /** Share of all eligible messages, 0–100. */
  sharePct: number;
  words: number;
  chars: number;
  /** Average characters per message (grapheme-based). */
  avgChars: number;
  emoji: number;
  emojiPerMessage: number;
  questions: number;
  exclamations: number;
  mediaCount: number;
  /** Valid response events given by this participant (replies to others). */
  responses: number;
  medianResponseMs: number | null;
  avgResponseMs: number | null;
  fastestResponseMs: number | null;
  /** Conversation starts (gap ≥ 4h or first message). */
  conversationStarts: number;
  longestMessageChars: number | null;
  /** Messages sent between 00:00–04:59 local wall clock. */
  nightCount: number;
  /** Messages sent between 05:00–07:59. */
  earlyCount: number;
  /** Messages sent on Saturday/Sunday. */
  weekendCount: number;
  firstTs: number | null;
  lastTs: number | null;
}

export interface MonthlyPoint {
  key: string; // "YYYY-MM"
  year: number;
  month0: number;
  count: number;
}

export interface DayPoint {
  dayTs: number; // UTC midnight of the day
  count: number;
}

export interface StreakInfo {
  length: number;
  startTs: number;
  endTs: number;
}

export interface ResponseSummary {
  /** Number of valid response events (≤ 6h). */
  count: number;
  avgMs: number;
  medianMs: number;
  fastestMs: number;
  /** Longest interval between consecutive eligible messages (any length). */
  longestGapMs: number;
  longestGapFromTs: number;
  longestGapToTs: number;
}

export interface EmojiCount {
  emoji: string;
  count: number;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface RecordEntry {
  id: string;
  label: string;
  value: string;
  detail: string;
  /** True when two or more candidates tied for the record. */
  tied?: boolean;
}

export interface Award {
  id: string;
  title: string;
  emoji: string;
  winnerIds: string[];
  winnerNames: string[];
  value: string;
  detail: string;
  tied: boolean;
}

export interface AnalyticsResult {
  /** Eligible messages after exclusions. */
  eligibleMessages: number;
  /** Raw counts before exclusions, for transparency. */
  totalParsed: number;
  systemCount: number;
  mediaCount: number;
  totalWords: number;
  totalChars: number;
  avgMessageChars: number;
  activeDays: number;
  dateRange: { from: number; to: number } | null;
  firstMessageTs: number | null;
  lastMessageTs: number | null;
  participants: ParticipantStats[];
  monthly: MonthlyPoint[];
  daily: DayPoint[];
  hourly: number[];
  /** [weekday 0=Sun][hour 0–23] */
  heatmap: number[][];
  weekday: number[];
  weekendSharePct: number;
  busiestMonth: MonthlyPoint | null;
  quietestMonth: MonthlyPoint | null;
  busiestDay: DayPoint | null;
  mostActiveHour: number | null;
  longestStreak: StreakInfo | null;
  response: ResponseSummary | null;
  emojiRanking: EmojiCount[];
  wordRanking: WordCount[];
  emojiPerMessage: number;
  questionRate: number;
  burst: { maxMessages: number; maxMessagesTs: number | null; maxParticipantId: string | null };
  longestMessage: { chars: number; participantId: string; ts: number; preview: string } | null;
  sampleNotes: string[];
}
