import { useEffect, useState } from "react";
import { useApp } from "./store";
import { useUi, closePrivacyDialog } from "./uiState";
import { Badge, Button, Callout, ConfirmButton, Panel } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/controls";
import {
  deleteAllRecaps,
  deleteRecap,
  loadSavedRecaps,
  persistRecap,
} from "@/features/privacy/recapStore";
import { PRIVACY_PROMISE } from "@/lib/site";
import { formatInt } from "@/lib/format";

const FAQ = [
  {
    q: "Where do my files go?",
    a: "Nowhere. Files are read with the browser's File API and parsed in a Web Worker on this device. ChatWrapped has no server that could receive them, and no network request ever contains your message content.",
  },
  {
    q: "What is stored in my browser?",
    a: "By default: nothing after you close the tab. Parsed conversations live in memory only. If you explicitly save a recap, an aggregate summary (counts and date range — never message text) is stored in IndexedDB, and you can delete it here at any time.",
  },
  {
    q: "Can I use ChatWrapped offline?",
    a: "Yes — after the first visit, the app shell, parsers and analytics are cached by a service worker so the core workflow works without a connection.",
  },
  {
    q: "Does ChatWrapped use analytics or trackers?",
    a: "No. There are no analytics scripts, no third-party requests, no cookies for tracking, and no error-reporting services.",
  },
  {
    q: "What does the hosting provider see?",
    a: "Like any website, GitHub Pages records standard operational request logs managed by GitHub. ChatWrapped adds nothing to that — the app itself sends nothing beyond normal static asset fetches.",
  },
];

export function PrivacyDialog() {
  const open = useUi((s) => s.privacyOpen);
  const clearSession = useApp((s) => s.clearSession);
  const conversations = useApp((s) => s.conversations);
  const addSavedRecap = useApp((s) => s.addSavedRecap);
  const removeSavedRecap = useApp((s) => s.removeSavedRecap);
  const online = useApp(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  const [recaps, setRecaps] = useState(useApp.getState().savedRecaps);

  useEffect(() => {
    if (open) {
      void loadSavedRecaps().then((r) => {
        setRecaps(r);
      });
    }
  }, [open]);

  const sc = conversations.find((c) => c.id === useApp.getState().activeId);

  return (
    <Dialog open={open} onClose={closePrivacyDialog} title="Privacy Center" wide>
      <div className="space-y-5">
        <Callout tone="success" title="Local processing">
          {PRIVACY_PROMISE}
        </Callout>

        <Panel>
          <div className="space-y-3 text-sm text-zinc-300">
            <p className="flex items-center gap-2">
              <Badge tone={online ? "success" : "warn"}>
                {online ? "Online" : "Offline — cached app shell active"}
              </Badge>
              Core workflow (import → analyze → story → cards) works offline after the first visit.
            </p>
            <p>
              Parsed data in this session:{" "}
              <strong>
                {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              </strong>{" "}
              held in memory only.
            </p>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display mb-3 font-bold">Saved recaps (opt-in, this device)</h3>
          {sc?.analytics ? (
            <Button
              size="sm"
              variant="secondary"
              className="mb-3"
              onClick={() => {
                const r = sc.analytics!;
                const recap = {
                  id: `recap-${Date.now()}`,
                  name: sc.conversation.title || sc.fileName,
                  title: sc.conversation.title || sc.fileName,
                  savedAt: Date.now(),
                  platform: sc.conversation.platform,
                  participants: sc.conversation.participants.map((p) => p.displayName),
                  summary: {
                    messages: r.eligibleMessages,
                    activeDays: r.activeDays,
                    dateFrom: r.firstMessageTs,
                    dateTo: r.lastMessageTs,
                  },
                  analyticsDigest: {
                    topEmoji: r.emojiRanking[0]?.emoji ?? null,
                    topWord: r.wordRanking[0]?.word ?? null,
                    busiestDayCount: r.busiestDay?.count ?? 0,
                    streakLength: r.longestStreak?.length ?? 0,
                  },
                };
                void persistRecap(recap).then(() => {
                  addSavedRecap(recap);
                  void loadSavedRecaps().then(setRecaps);
                });
              }}
            >
              💾 Save current recap summary locally
            </Button>
          ) : (
            <p className="mb-3 text-xs text-zinc-500">Load a conversation to enable saving.</p>
          )}
          {recaps.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No saved recaps. Saved recaps store aggregate statistics only — never message text.
            </p>
          ) : (
            <ul className="space-y-2">
              {recaps.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-2.5"
                >
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-semibold text-white">{r.name}</p>
                    <p className="text-zinc-500">
                      {formatInt(r.summary.messages)} messages · {r.summary.activeDays} active days
                      · saved {new Date(r.savedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void deleteRecap(r.id).then(() => {
                        removeSavedRecap(r.id);
                        void loadSavedRecaps().then(setRecaps);
                      });
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {recaps.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => {
                void deleteAllRecaps().then(() => {
                  setRecaps([]);
                });
              }}
            >
              Delete all saved recaps
            </Button>
          ) : null}
        </Panel>

        <Panel>
          <h3 className="font-display mb-3 font-bold">Session controls</h3>
          <ConfirmButton
            confirmLabel="Really clear everything?"
            onConfirm={() => {
              clearSession();
              closePrivacyDialog();
            }}
          >
            🗑 Clear all parsed data & reset session
          </ConfirmButton>
          <p className="mt-2 text-xs text-zinc-500">
            This removes every parsed conversation from memory. Nothing was ever uploaded, so there
            is nothing to delete anywhere else.
          </p>
        </Panel>

        <Panel>
          <h3 className="font-display mb-3 font-bold">Privacy FAQ</h3>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-xl border border-white/10 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-white">{f.q}</summary>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{f.a}</p>
              </details>
            ))}
          </div>
        </Panel>
      </div>
    </Dialog>
  );
}
