/**
 * Deterministic synthetic demo conversations (Part 17).
 *
 * Everything is generated from a seeded PRNG so the demo experience,
 * story screenshots and browser tests are perfectly repeatable.
 * All names and messages are fictional.
 */

import type { ChatMessage, ParsedConversation, Participant } from "../types";
import { mulberry32, pick, randInt } from "@/lib/rng";

export interface DemoConfig {
  id: "friends" | "family" | "team";
  title: string;
  seed: number;
  participants: Array<{
    name: string;
    weight: number;
    nightOwl?: boolean;
    earlyBird?: boolean;
    verbose?: boolean;
    emojiHeavy?: boolean;
  }>;
  /** Inclusive month range, e.g. 2024-06 → 2024-11. */
  startYear: number;
  startMonth0: number;
  endYear: number;
  endMonth0: number;
  baseVolume: number;
  phrases: string[];
  emojiHeavy?: boolean;
}

const FRIEND_PHRASES = [
  "hey! did you watch the finale last night? no spoilers!!",
  "I found the coziest coffee shop near the office ☕",
  "ok but the plot twist was INSANE",
  "are we still on for board games saturday? 🎲",
  "look at this cat video, it made my day 😹",
  "the new ramen place opened, we HAVE to go",
  "I finally finished that book. the ending 🤯",
  "morning! gym at 7 tomorrow? 💪",
  "why is this week so long",
  "sending you the playlist now 🎧",
  "hahaha that's exactly what I was thinking 😂",
  "pizza night tonight? 🍕",
  "guess who got front row tickets!! 🎫",
  "I'm dead tired but worth it",
  "did you see the sunset today? 🌅",
  "blue screen of death on a monday, amazing",
  "lunch tomorrow at the usual place?",
  "just booked the trip!! ✈️ only 6 weeks to go",
  "that thread is pure chaos 😆",
  "ok you were right, the sequel is better",
  "happy cake day!! 🎂",
  "the plant survived!! 🌱 new record",
];

const FAMILY_PHRASES = [
  "dinner at mom's on sunday, 6pm 🍲",
  "did everyone get the group photo? 📸",
  "happy birthday!! hope your day is wonderful 🎁",
  "the garden tomatoes are finally ripe 🍅",
  "doctor appointment confirmed for tuesday",
  "who took my charger again 😅",
  "flight lands at gate B, don't be late",
  "recipe as promised: 2 cups flour, 1 cup sugar…",
  "kids start school next week, where did summer go",
  "call me when you land ❤️",
  "we adopted a kitten!! 🐱",
  "reminder: bills due on the 5th",
  "video call this weekend? the little one wants to show you her drawing ✏️",
  "grandma sends her love 💌",
  "household repair done, no more leaks",
  "the plumbers come Thursday morning",
  "saved you some leftovers in the fridge",
  "movie marathon at our place friday 🍿",
];

const TEAM_PHRASES = [
  "standup moved to 9:30 today",
  "PR is ready for review when you get a chance",
  "the deploy pipeline is green again ✅",
  "client feedback on the mockups came in",
  "I'll take the afternoon session of the workshop",
  "deadline for the proposal is Friday",
  "doc updated with the new API examples 📄",
  "bug reproduced, it's a caching issue",
  "team lunch Thursday to celebrate the launch 🎉",
  "sprint retro notes are in the wiki",
  "anyone got 10 min to pair on the flaky test?",
  "v1.2 shipped to staging 🚀",
  "please review the security checklist before Monday",
  "metrics look great this week 📈",
  "office closed tomorrow for maintenance",
  "onboarding doc for the new hire is ready",
  "reminder: timesheets due today",
  "the demo went really well, nice work everyone 👏",
];

export const DEMO_CONFIGS: Record<DemoConfig["id"], DemoConfig> = {
  friends: {
    id: "friends",
    title: "You & Maya",
    seed: 20250117,
    participants: [
      { name: "You", weight: 0.48, nightOwl: true, emojiHeavy: false },
      { name: "Maya", weight: 0.52, verbose: true },
    ],
    startYear: 2024,
    startMonth0: 5,
    endYear: 2024,
    endMonth0: 11,
    baseVolume: 14,
    phrases: FRIEND_PHRASES,
    emojiHeavy: true,
  },
  family: {
    id: "family",
    title: "Family Circle",
    seed: 20250218,
    participants: [
      { name: "Mom", weight: 0.3, earlyBird: true },
      { name: "You", weight: 0.22 },
      { name: "Dad", weight: 0.18 },
      { name: "Ravi", weight: 0.3 },
    ],
    startYear: 2024,
    startMonth0: 6,
    endYear: 2024,
    endMonth0: 11,
    baseVolume: 9,
    phrases: FAMILY_PHRASES,
  },
  team: {
    id: "team",
    title: "Product Squad",
    seed: 20250319,
    participants: [
      { name: "Alex", weight: 0.26 },
      { name: "You", weight: 0.24 },
      { name: "Sam", weight: 0.2 },
      { name: "Priya", weight: 0.18 },
      { name: "Tom", weight: 0.12 },
    ],
    startYear: 2024,
    startMonth0: 7,
    endYear: 2024,
    endMonth0: 11,
    baseVolume: 11,
    phrases: TEAM_PHRASES,
  },
};

const EMOJI_TAILS = [
  "",
  " 🙂",
  " 🎉",
  " 😂",
  " ✨",
  " 👍",
  " 🙌",
  " ❤️",
  " 🤝",
  " 🔥",
  " 😴",
  " 🥳",
  " ☀️",
];

interface Profile {
  name: string;
  weight: number;
  nightOwl: boolean;
  earlyBird: boolean;
  verbose: boolean;
  emojiHeavy?: boolean;
}

/** Weighted participant pick with per-profile hour preferences. */
function chooseParticipant(rng: () => number, profiles: Profile[]): Profile {
  const total = profiles.reduce((a, p) => a + p.weight, 0);
  let roll = rng() * total;
  for (const p of profiles) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return profiles[0]!;
}

function chooseHour(rng: () => number, p: Profile): number {
  if (p.nightOwl && rng() < 0.38) return randInt(rng, 0, 4); // late night
  if (p.earlyBird && rng() < 0.4) return randInt(rng, 5, 8); // early morning
  if (p.verbose && rng() < 0.3) return randInt(rng, 19, 23); // evening chatter
  // Work + evening baseline
  const buckets = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22];
  return buckets[Math.floor(rng() * buckets.length)]!;
}

export function generateDemoConversation(configId: DemoConfig["id"]): ParsedConversation {
  const config = DEMO_CONFIGS[configId];
  const rng = mulberry32(config.seed);
  const participants: Participant[] = config.participants.map((p) => ({
    id: p.name,
    displayName: p.name,
  }));
  const messages: ChatMessage[] = [];
  const warnings: string[] = [];

  let idCounter = 0;
  let sourceIndex = 0;
  let tsCursor = Date.UTC(config.startYear, config.startMonth0, 1, 8, 0, 0);
  const endTs = Date.UTC(config.endYear, config.endMonth0 + 1, 1, 0, 0, 0);
  const dayMs = 86400000;

  while (tsCursor < endTs) {
    const d = new Date(tsCursor);
    const dow = d.getUTCDay();
    // Weekend boost for friends/family, dip for team; month seasonality wave.
    const monthWave = 0.75 + 0.5 * Math.sin((d.getUTCMonth() + 1) / 1.9);
    const weekendFactor =
      config.id === "team"
        ? dow === 0 || dow === 6
          ? 0.25
          : 1.15
        : dow === 0 || dow === 6
          ? 1.3
          : 0.95;
    const dayCount = Math.round(
      config.baseVolume * monthWave * weekendFactor * (0.6 + rng() * 0.8),
    );

    for (let i = 0; i < dayCount; i++) {
      const p = chooseParticipant(rng, config.participants as Profile[]);
      const hour = chooseHour(rng, p);
      const minute = randInt(rng, 0, 59);
      // Bursts: 30% chance to send 2–4 rapid messages.
      const burst = rng() < 0.3 ? randInt(rng, 2, 4) : 1;
      for (let b = 0; b < burst; b++) {
        const baseTs =
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute) +
          b * randInt(rng, 5, 55) * 1000;
        if (baseTs >= endTs) break;
        const phrase = pick(rng, config.phrases);
        const text = config.emojiHeavy && rng() < 0.45 ? phrase + pick(rng, EMOJI_TAILS) : phrase;
        messages.push({
          id: `d-${idCounter++}`,
          participantId: p.name,
          timestamp: baseTs,
          text,
          type: "text",
          isSystemMessage: false,
          hasAttachment: false,
          sourceIndex: sourceIndex++,
        });
      }
    }
    tsCursor += dayMs;
  }

  // A couple of system messages at the start, like a real export.
  const first = messages[0];
  if (first && first.timestamp !== null) {
    messages.unshift({
      id: `d-${idCounter++}`,
      participantId: "system",
      timestamp: first.timestamp - 60_000,
      text: "Messages and calls are end-to-end encrypted.",
      type: "system",
      isSystemMessage: true,
      hasAttachment: false,
      sourceIndex: sourceIndex++,
    });
    warnings.push(
      "Synthetic sample data — generated locally, clearly labeled, never a real conversation.",
    );
  }

  messages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  return {
    platform: "whatsapp",
    title: config.title,
    participants,
    messages,
    dateOrder: "month-first",
    dateOrderAmbiguous: false,
    importWarnings: warnings,
  };
}
