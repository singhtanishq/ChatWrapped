/**
 * Evidence-based participant awards (Module G).
 *
 * Playful statistics — never psychological assessments. Every award has an
 * explicit threshold and is omitted when no participant qualifies. Ties are
 * reported honestly (multiple winners, `tied: true`).
 */

import type { AnalyticsResult, Award } from "./types";

export const AWARD_THRESHOLDS = {
  /** Minimum eligible messages per participant to qualify for any award. */
  minMessages: 10,
  nightOwl: { minMessagesInWindow: 15 },
  earlyBird: { minMessagesInWindow: 15 },
  emojiEnthusiast: { minRate: 0.35, minEmojiMessages: 15 },
  marathonChatter: { minMessagesInSingleDay: 15 },
  conversationStarter: { minStarts: 3 },
  weekendRegular: { minWeekendShare: 0.35, minWeekendMessages: 15 },
  storyteller: { minAvgChars: 120 },
  speedResponder: { maxMedianMs: 300_000, minResponses: 5 },
} as const;

interface Winner {
  participantId: string;
  displayName: string;
  value: string;
}

function topBy(
  result: AnalyticsResult,
  qualify: (p: AnalyticsResult["participants"][number]) => boolean,
  score: (p: AnalyticsResult["participants"][number]) => number,
  format: (p: AnalyticsResult["participants"][number]) => string,
): Winner[] {
  const qualifying = result.participants.filter(qualify);
  if (qualifying.length === 0) return [];
  const best = Math.max(...qualifying.map(score));
  const winners = qualifying.filter((p) => score(p) === best);
  return winners.map((p) => ({
    participantId: p.participantId,
    displayName: p.displayName,
    value: format(p),
  }));
}

function award(
  id: string,
  title: string,
  emoji: string,
  detail: string,
  winners: Winner[],
  tied: boolean,
): Award | null {
  if (winners.length === 0) return null;
  return {
    id,
    title,
    emoji,
    winnerIds: winners.map((w) => w.participantId),
    winnerNames: winners.map((w) => w.displayName),
    value: winners[0]!.value,
    detail,
    tied: winners.length > 1 ? tied : false,
  };
}

export function computeAwards(
  result: AnalyticsResult,
  extra?: { singleDayCounts?: Map<string, number> },
): Award[] {
  const candidates: Array<Award | null> = [];
  const T = AWARD_THRESHOLDS;
  const eligibleEnough = (p: AnalyticsResult["participants"][number]) =>
    p.messages >= T.minMessages;

  // Night Owl — most messages between 00:00 and 04:59.
  candidates.push(
    award(
      "night-owl",
      "Night Owl",
      "🦉",
      "most messages sent between midnight and 5am",
      topBy(
        result,
        (p) => eligibleEnough(p) && p.nightCount >= T.nightOwl.minMessagesInWindow,
        (p) => p.nightCount,
        (p) => `${p.nightCount} late-night messages`,
      ),
      true,
    ),
  );

  // Early Bird — most messages between 05:00 and 07:59.
  candidates.push(
    award(
      "early-bird",
      "Early Bird",
      "🌅",
      "most messages sent between 5am and 8am",
      topBy(
        result,
        (p) => eligibleEnough(p) && p.earlyCount >= T.earlyBird.minMessagesInWindow,
        (p) => p.earlyCount,
        (p) => `${p.earlyCount} early-morning messages`,
      ),
      true,
    ),
  );

  // Emoji Enthusiast — highest emoji-per-message rate with enough emoji usage.
  candidates.push(
    award(
      "emoji-enthusiast",
      "Emoji Enthusiast",
      "🎭",
      "highest emoji-per-message rate (≥ 0.35, at least 15 emoji messages)",
      topBy(
        result,
        (p) => eligibleEnough(p) && p.emoji >= T.emojiEnthusiast.minEmojiMessages,
        (p) => p.emojiPerMessage,
        (p) => `${p.emojiPerMessage.toFixed(2)} emoji per message`,
      ),
      true,
    ),
  );

  // Marathon Chatter — most messages in a single day.
  if (extra?.singleDayCounts) {
    const winners: Winner[] = [];
    let best = 0;
    const perParticipantMax = new Map<string, number>();
    for (const [ownerId, count] of extra.singleDayCounts) {
      perParticipantMax.set(ownerId, Math.max(perParticipantMax.get(ownerId) ?? 0, count));
    }
    for (const [, count] of perParticipantMax) {
      if (count >= T.marathonChatter.minMessagesInSingleDay && count > best) best = count;
    }
    for (const [winnerId, count] of perParticipantMax) {
      if (count === best && best >= T.marathonChatter.minMessagesInSingleDay) {
        const p = result.participants.find((x) => x.participantId === winnerId);
        if (p)
          winners.push({
            participantId: winnerId,
            displayName: p.displayName,
            value: `${count} messages in one day`,
          });
      }
    }
    candidates.push(
      award(
        "marathon-chatter",
        "Marathon Chatter",
        "🏃",
        "most messages sent on a single day",
        winners,
        true,
      ),
    );
  }

  // Conversation Starter — most conversation starts (gap ≥ 4h).
  candidates.push(
    award(
      "conversation-starter",
      "Conversation Starter",
      "🚀",
      "most conversations started after a 4-hour lull",
      topBy(
        result,
        (p) => p.conversationStarts >= T.conversationStarter.minStarts,
        (p) => p.conversationStarts,
        (p) => `${p.conversationStarts} conversation starts`,
      ),
      true,
    ),
  );

  // Weekend Regular — highest weekend share with enough weekend messages.
  candidates.push(
    award(
      "weekend-regular",
      "Weekend Regular",
      "🛋️",
      "highest share of weekend messages (≥ 35%, at least 15 weekend messages)",
      topBy(
        result,
        (p) => eligibleEnough(p) && p.weekendCount >= T.weekendRegular.minWeekendMessages,
        (p) => p.weekendCount / Math.max(p.messages, 1),
        (p) => `${((p.weekendCount / Math.max(p.messages, 1)) * 100).toFixed(0)}% weekend activity`,
      ),
      true,
    ),
  );

  // The Storyteller — longest average message length.
  candidates.push(
    award(
      "storyteller",
      "The Storyteller",
      "📜",
      "longest average message length (at least 120 characters)",
      topBy(
        result,
        (p) => eligibleEnough(p) && p.avgChars >= T.storyteller.minAvgChars,
        (p) => p.avgChars,
        (p) => `${Math.round(p.avgChars)} characters per message on average`,
      ),
      true,
    ),
  );

  // Speed Responder — fastest median response time with enough responses.
  candidates.push(
    award(
      "speed-responder",
      "Speed Responder",
      "⚡",
      "fastest median response time (≤ 5 minutes, at least 5 valid responses)",
      topBy(
        result,
        (p) =>
          p.responses >= T.speedResponder.minResponses &&
          (p.medianResponseMs ?? Infinity) <= T.speedResponder.maxMedianMs,
        (p) => -(p.medianResponseMs ?? Infinity),
        (p) => `${Math.round((p.medianResponseMs ?? 0) / 1000)}s median response time`,
      ),
      true,
    ),
  );

  return candidates.filter((a): a is Award => a !== null);
}
