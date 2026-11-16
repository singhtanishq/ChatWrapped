import { useMemo } from "react";
import { useApp } from "../store";
import { Button, Callout, EmptyState, Panel, SectionTitle } from "@/components/ui/primitives";
import { compareConversations } from "@/features/comparison/compare";
import { formatBytes } from "@/lib/format";

export function CompareStep() {
  const conversations = useApp((s) => s.conversations);
  const activeId = useApp((s) => s.activeId);
  const setActive = useApp((s) => s.setActive);
  const removeConversation = useApp((s) => s.removeConversation);
  const setStep = useApp((s) => s.setStep);

  const items = useMemo(
    () =>
      conversations
        .filter((c) => c.analytics)
        .map((c) => ({
          id: c.id,
          label: c.conversation.title || c.fileName,
          analytics: c.analytics!,
        })),
    [conversations],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon="⚖️"
        title="Nothing to compare yet"
        description="Import two or more conversations in this session (or load two samples) and compare their patterns side by side."
        action={
          <div className="flex gap-2">
            <Button onClick={() => setStep("import")}>Import another conversation</Button>
          </div>
        }
      />
    );
  }

  const metrics = compareConversations(items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Conversation comparison
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Comparing {items.length} conversation{items.length === 1 ? "" : "s"} loaded in this
          session. Metrics use each conversation's current filters.
        </p>
      </div>

      {items.length === 1 ? (
        <Callout tone="info" title="One conversation loaded">
          Import or load another sample to see a side-by-side comparison. The table below shows its
          current stats.
        </Callout>
      ) : null}

      <Panel padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-400 uppercase">
                <th className="px-4 py-3 font-semibold">Metric</th>
                {items.map((i) => (
                  <th key={i.id} className="px-4 py-3 font-semibold text-white">
                    {i.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-zinc-300">
                    {m.label}
                    {m.hint ? (
                      <span className="block text-[11px] text-zinc-500">{m.hint}</span>
                    ) : null}
                  </td>
                  {m.values.map((v, i) => (
                    <td key={i} className="px-4 py-3 tabular-nums text-white">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div>
        <SectionTitle sub="Loaded in this browser session only">Session conversations</SectionTitle>
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {c.conversation.title || c.fileName}{" "}
                  {c.id === activeId ? (
                    <span className="text-xs text-fuchsia-300">· active</span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {c.isDemo ? "synthetic sample" : `${c.fileName} · ${formatBytes(c.fileSize)}`} ·{" "}
                  {c.conversation.messages.length} parsed · {c.conversation.participants.length}{" "}
                  participants
                </p>
              </div>
              <div className="flex gap-1.5">
                {!c.isDemo ? (
                  <Button variant="ghost" size="sm" onClick={() => setActive(c.id)}>
                    Make active
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => removeConversation(c.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setStep("import")}>
            + Import another conversation
          </Button>
        </div>
      </div>

      <Callout tone="info" title="Honest comparisons">
        Different conversations have different sizes, timespans and participant counts. Compare like
        with like — the date range and sample size rows are there to keep you honest.
      </Callout>
    </div>
  );
}
