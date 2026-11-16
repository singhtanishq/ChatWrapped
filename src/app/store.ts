/**
 * Session store (zustand).
 *
 * Default mode is in-memory only: nothing touches IndexedDB unless the user
 * explicitly saves a recap in the Privacy Center. All state lives in the
 * browser for the current session and disappears on reload/clear.
 */

import { create } from "zustand";
import type { AnalyticsOptions, AnalyticsResult } from "@/features/analytics/types";
import { computeAnalytics } from "@/features/analytics";
import type { ParsedConversation, Participant, ParseOptions } from "@/features/types";
import { ParseError } from "@/features/types";
import type { DetectedFormat } from "@/features/parsers/detect";
import { detectFormat } from "@/features/parsers/detect";
import { workerClient } from "@/lib/workerClient";
import { generateDemoConversation, DEMO_CONFIGS } from "@/features/demo/demoData";
import { FILE_LIMITS } from "@/features/types";
import { DEFAULT_THEME, type ThemeId, isThemeId } from "@/features/themes/themes";

export type Step = "import" | "setup" | "dashboard" | "stories" | "cards" | "compare";

export interface SetupOptions {
  /** participantId → included in analysis. */
  included: Record<string, boolean>;
  /** participantId → presentation name override. */
  renamed: Record<string, string>;
  anonymize: boolean;
  dateRange: { from: number; to: number } | null;
  excludeAttachments: boolean;
  includeSystemMessages: boolean;
  /** Which participant the user identifies as (for "You" badges). */
  currentUserId: string | null;
}

export interface SessionConversation {
  id: string;
  conversation: ParsedConversation;
  fileName: string;
  fileSize: number;
  format: DetectedFormat;
  /** Raw file content kept in-memory only for the current session, so the
   *  date-order toggle can re-parse without re-uploading. Never persisted. */
  rawContent: string | null;
  /** Date-order decision applied when parsing (whatsapp only). */
  dateOrder: ParseOptions["dateOrder"];
  setup: SetupOptions;
  analytics: AnalyticsResult | null;
  isDemo: boolean;
}

export type AppStatus = "idle" | "reading" | "parsing" | "analyzing" | "ready" | "error";

export interface CardOptions {
  size: "story" | "vertical" | "portrait" | "square" | "landscape";
  headline: string | null;
  caption: string | null;
  attribution: boolean;
  hiddenMetrics: string[];
}

export interface SavedRecap {
  id: string;
  name: string;
  savedAt: number;
  platform: ParsedConversation["platform"];
  title: string;
  participants: string[];
  summary: { messages: number; activeDays: number; dateFrom: number | null; dateTo: number | null };
  /** Only aggregated setup options and analytics summary are stored — never raw message text. */
  analyticsDigest: {
    topEmoji: string | null;
    topWord: string | null;
    busiestDayCount: number;
    streakLength: number;
  };
}

interface AppState {
  conversations: SessionConversation[];
  activeId: string | null;
  step: Step;
  status: AppStatus;
  progress: { pct: number; phase: string };
  error: string | null;
  themeId: ThemeId;
  cardOptions: CardOptions;
  autoplay: boolean;
  reducedMotion: boolean;
  savedRecaps: SavedRecap[];

  // actions
  setStep: (step: Step) => void;
  setTheme: (themeId: ThemeId) => void;
  setCardOptions: (patch: Partial<CardOptions>) => void;
  setAutoplay: (v: boolean) => void;
  setError: (error: string | null) => void;

  importFile: (file: File) => Promise<void>;
  loadDemo: (id: keyof typeof DEMO_CONFIGS) => Promise<void>;
  reparseWithDateOrder: (order: NonNullable<ParseOptions["dateOrder"]>) => Promise<void>;
  recompute: (conversationId?: string) => Promise<void>;
  updateSetup: (conversationId: string, patch: Partial<SetupOptions>) => void;
  setActive: (id: string | null) => void;
  removeConversation: (id: string) => void;
  clearSession: () => void;
  addSavedRecap: (recap: SavedRecap) => void;
  removeSavedRecap: (id: string) => void;
}

export const DEFAULT_SETUP: SetupOptions = {
  included: {},
  renamed: {},
  anonymize: false,
  dateRange: null,
  excludeAttachments: false,
  includeSystemMessages: false,
  currentUserId: null,
};

function defaultSetupFor(conversation: ParsedConversation): SetupOptions {
  const included: Record<string, boolean> = {};
  for (const p of conversation.participants) included[p.id] = true;
  return { ...DEFAULT_SETUP, included };
}

/** Effective display name applying rename + anonymization. */
export function displayName(sc: SessionConversation, participantId: string): string {
  const original =
    sc.conversation.participants.find((p) => p.id === participantId)?.displayName ?? participantId;
  if (sc.setup.renamed[participantId]) return sc.setup.renamed[participantId]!;
  if (sc.setup.anonymize) {
    const idx = sc.conversation.participants.findIndex((p) => p.id === participantId);
    return `Participant ${String.fromCharCode(65 + Math.max(0, idx))}`;
  }
  return original;
}

export function analyticsOptionsFor(sc: SessionConversation): AnalyticsOptions {
  const excludedParticipantIds = Object.entries(sc.setup.included)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return {
    excludedParticipantIds,
    excludeSystemMessages: !sc.setup.includeSystemMessages,
    excludeAttachments: sc.setup.excludeAttachments,
    dateRange: sc.setup.dateRange,
  };
}

let idCounter = 0;
const nextId = () => `conv-${Date.now()}-${idCounter++}`;

export const useApp = create<AppState>((set, get) => ({
  conversations: [],
  activeId: null,
  step: "import",
  status: "idle",
  progress: { pct: 0, phase: "" },
  error: null,
  themeId: DEFAULT_THEME,
  cardOptions: {
    size: "portrait",
    headline: null,
    caption: null,
    attribution: true,
    hiddenMetrics: [],
  },
  autoplay: false,
  reducedMotion:
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  savedRecaps: [],

  setStep: (step) => set({ step }),
  setTheme: (themeId) => set({ themeId }),
  setCardOptions: (patch) => set((s) => ({ cardOptions: { ...s.cardOptions, ...patch } })),
  setAutoplay: (autoplay) => set({ autoplay }),
  setError: (error) => set({ error }),

  importFile: async (file) => {
    if (file.size > FILE_LIMITS.hardMaxBytes) {
      set({
        status: "error",
        error: `This file is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). The tested limit is ${FILE_LIMITS.hardMaxBytes / 1024 / 1024} MB.`,
      });
      return;
    }
    set({ status: "reading", error: null, progress: { pct: 10, phase: "Reading file" } });
    try {
      const content = await file.text();
      set({ status: "parsing", progress: { pct: 30, phase: "Parsing" } });
      const format = detectFormat(content);
      if (format.format === "unknown") {
        set({
          status: "error",
          error:
            format.detail ??
            "This file could not be recognized as a WhatsApp TXT export or a Telegram JSON export. Check the supported formats above.",
        });
        return;
      }
      const parseResult = await workerClient.parse(
        content,
        format.format,
        { dateOrder: "auto" },
        {
          onProgress: (pct, phase) => set({ progress: { pct, phase } }),
        },
      );
      const conversation = parseResult.conversation;
      const sc: SessionConversation = {
        id: nextId(),
        conversation,
        fileName: file.name,
        fileSize: file.size,
        format: format.format,
        rawContent: conversation.platform === "whatsapp" ? content : null,
        dateOrder: "auto",
        setup: defaultSetupFor(conversation),
        analytics: null,
        isDemo: false,
      };
      set((s) => ({
        conversations: [...s.conversations.filter((c) => c.id !== s.activeId || !c.isDemo), sc],
        activeId: sc.id,
        status: "analyzing",
        progress: { pct: 60, phase: "Analyzing" },
      }));
      await get().recompute(sc.id);
      set({ status: "ready", step: "setup", progress: { pct: 100, phase: "Done" } });
    } catch (err) {
      set({
        status: "error",
        error:
          err instanceof ParseError || err instanceof Error
            ? err.message
            : "Something went wrong while importing.",
      });
    }
  },

  loadDemo: async (id) => {
    set({ status: "parsing", error: null, progress: { pct: 40, phase: "Generating sample data" } });
    const conversation = generateDemoConversation(id);
    const sc: SessionConversation = {
      id: nextId(),
      conversation,
      fileName: `${DEMO_CONFIGS[id].id}-sample (synthetic)`,
      fileSize: 0,
      format: "whatsapp",
      rawContent: null,
      dateOrder: "auto",
      setup: { ...defaultSetupFor(conversation), currentUserId: "You" },
      analytics: null,
      isDemo: true,
    };
    set((s) => ({
      conversations: [...s.conversations.filter((c) => !c.isDemo), sc],
      activeId: sc.id,
      status: "analyzing",
      progress: { pct: 70, phase: "Analyzing" },
    }));
    await get().recompute(sc.id);
    // Keep a hash-specified step (e.g. #/stories) intact for deep links.
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#\/?/, "") : "";
    const keepStep = ["setup", "dashboard", "stories", "cards", "compare"].includes(hash);
    set({
      status: "ready",
      progress: { pct: 100, phase: "Done" },
      ...(keepStep ? {} : { step: "dashboard" as Step }),
    });
  },

  reparseWithDateOrder: async (order) => {
    const { activeId, conversations } = get();
    const sc = conversations.find((c) => c.id === activeId);
    if (!sc || sc.format !== "whatsapp" || !sc.rawContent) return;
    set({
      status: "parsing",
      progress: { pct: 30, phase: "Re-parsing with the selected date order" },
    });
    const result = await workerClient.parse(sc.rawContent, "whatsapp", { dateOrder: order });
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === activeId
          ? {
              ...c,
              conversation: result.conversation,
              dateOrder: order,
              // Reset setup since participant ids are unchanged but be safe:
              setup: {
                ...c.setup,
                included: { ...defaultSetupFor(result.conversation).included, ...c.setup.included },
              },
            }
          : c,
      ),
    }));
    await get().recompute(activeId);
    set({ status: "ready", progress: { pct: 100, phase: "Done" } });
  },

  recompute: async (conversationId) => {
    const id = conversationId ?? get().activeId;
    const sc = get().conversations.find((c) => c.id === id);
    if (!sc) return;
    const options = analyticsOptionsFor(sc);
    // Very large conversations run in the worker to avoid blocking the UI;
    // smaller ones compute synchronously (cheaper than cloning to a worker).
    const analytics =
      sc.conversation.messages.length > 20_000
        ? await workerClient.analyze(sc.conversation, options)
        : computeAnalytics(sc.conversation, options);
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, analytics } : c)),
      status: "ready",
    }));
  },

  updateSetup: (conversationId, patch) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, setup: { ...c.setup, ...patch } } : c,
      ),
    }));
    void get().recompute(conversationId);
  },

  setActive: (id) => set({ activeId: id, step: id ? "dashboard" : "import" }),
  removeConversation: (id) =>
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      const activeId = s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId;
      return { conversations, activeId, step: activeId ? s.step : "import" };
    }),
  clearSession: () =>
    set({
      conversations: [],
      activeId: null,
      step: "import",
      status: "idle",
      error: null,
      progress: { pct: 0, phase: "" },
    }),

  addSavedRecap: (recap) => set((s) => ({ savedRecaps: [recap, ...s.savedRecaps] })),
  removeSavedRecap: (id) => set((s) => ({ savedRecaps: s.savedRecaps.filter((r) => r.id !== id) })),
}));

/** Participants of the active conversation with effective display names. */
export function activeParticipants(
  sc: SessionConversation | undefined,
): Array<Participant & { effectiveName: string }> {
  if (!sc) return [];
  return sc.conversation.participants.map((p) => ({
    ...p,
    effectiveName: displayName(sc, p.id),
    isCurrentUser: p.id === sc.setup.currentUserId || undefined,
  }));
}

export function readThemeIdParam(): ThemeId | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get("theme");
  return t && isThemeId(t) ? t : null;
}
