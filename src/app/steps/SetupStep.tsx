import { useMemo, useState } from "react";
import { activeParticipants, displayName, useApp } from "../store";
import { Badge, Button, Callout, Panel, Stat } from "@/components/ui/primitives";
import { Toggle } from "@/components/ui/controls";
import { formatDayShort, formatInt } from "@/lib/format";

export function SetupStep() {
  const conversations = useApp((s) => s.conversations);
  const activeId = useApp((s) => s.activeId);
  const updateSetup = useApp((s) => s.updateSetup);
  const recompute = useApp((s) => s.recompute);
  const setStep = useApp((s) => s.setStep);
  const sc = conversations.find((c) => c.id === activeId);

  const [rangeDraft, setRangeDraft] = useState<{ from: string; to: string }>(() => {
    const r = sc?.setup.dateRange;
    if (!r) return { from: "", to: "" };
    return {
      from: new Date(r.from).toISOString().slice(0, 10),
      to: new Date(r.to).toISOString().slice(0, 10),
    };
  });

  const participants = useMemo(() => activeParticipants(sc), [sc]);

  if (!sc || !sc.analytics) {
    return <Callout tone="warn">Import a conversation first.</Callout>;
  }
  const analytics = sc.analytics;

  const dayOptions = analytics.daily.map((d) => ({
    value: new Date(d.dayTs).toISOString().slice(0, 10),
    label: formatDayShort(
      new Date(d.dayTs).getUTCFullYear(),
      new Date(d.dayTs).getUTCMonth(),
      new Date(d.dayTs).getUTCDate(),
    ),
  }));

  function applyRange(from: string, to: string) {
    if (!sc) return;
    if (!from || !to) {
      updateSetup(sc.id, { dateRange: null });
      return;
    }
    const fromTs = Date.parse(`${from}T00:00:00Z`);
    const toTs = Date.parse(`${to}T23:59:59.999Z`);
    if (Number.isNaN(fromTs) || Number.isNaN(toTs)) return;
    updateSetup(sc.id, { dateRange: { from: fromTs, to: toTs } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Set up your recap
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {sc.conversation.title || sc.fileName ? (
            <>
              <strong className="text-zinc-200">{sc.conversation.title || sc.fileName}</strong>{" "}
              ·{" "}
            </>
          ) : null}
          Choose who to include and the period to analyze. Everything stays on this device.
        </p>
      </div>

      <Panel>
        <h2 className="font-display mb-4 text-lg font-bold text-white">
          Participants ({participants.length})
        </h2>
        <ul className="space-y-2.5">
          {participants.map((p) => {
            const included = sc.setup.included[p.id] !== false;
            const stats = analytics.participants.find((x) => x.participantId === p.id);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    id={`inc-${p.id}`}
                    checked={included}
                    onChange={(e) => {
                      updateSetup(sc.id, {
                        included: { ...sc.setup.included, [p.id]: e.target.checked },
                      });
                    }}
                    className="size-4.5 rounded border-white/25 bg-white/10 accent-fuchsia-500"
                  />
                  <label htmlFor={`inc-${p.id}`} className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {displayName(sc, p.id)}
                    </span>
                    {p.effectiveName !== p.displayName ? (
                      <span className="block truncate text-xs text-zinc-500">
                        originally “{p.displayName}”
                      </span>
                    ) : null}
                  </label>
                  {p.isCurrentUser ? <Badge tone="accent">you</Badge> : null}
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>{formatInt(stats?.messages ?? 0)} eligible msgs</span>
                  <input
                    type="text"
                    aria-label={`Rename ${displayName(sc, p.id)} for presentation`}
                    placeholder="Rename…"
                    value={sc.setup.renamed[p.id] ?? ""}
                    onChange={(e) =>
                      updateSetup(sc.id, {
                        renamed: { ...sc.setup.renamed, [p.id]: e.target.value },
                      })
                    }
                    className="h-8 w-28 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-zinc-500"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-3">
            <Toggle
              label="Anonymize participant names"
              description="Replace names with “Participant A/B/…” on this device."
              checked={sc.setup.anonymize}
              onChange={(v) => updateSetup(sc.id, { anonymize: v })}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">
              Which participant are you?
            </span>
            <div className="flex flex-wrap gap-1.5">
              {participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    updateSetup(sc.id, {
                      currentUserId: sc.setup.currentUserId === p.id ? null : p.id,
                    })
                  }
                  className={
                    "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors " +
                    (sc.setup.currentUserId === p.id
                      ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200"
                      : "border-white/15 bg-white/5 text-zinc-300 hover:text-white")
                  }
                >
                  {displayName(sc, p.id)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="font-display mb-4 text-lg font-bold text-white">Date range</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">From</span>
            <input
              type="date"
              value={rangeDraft.from}
              min={dayOptions[0]?.value}
              max={dayOptions[dayOptions.length - 1]?.value}
              onChange={(e) => {
                setRangeDraft((d) => ({ ...d, from: e.target.value }));
                applyRange(e.target.value, rangeDraft.to);
              }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">To</span>
            <input
              type="date"
              value={rangeDraft.to}
              min={dayOptions[0]?.value}
              max={dayOptions[dayOptions.length - 1]?.value}
              onChange={(e) => {
                setRangeDraft((d) => ({ ...d, to: e.target.value }));
                applyRange(rangeDraft.from, e.target.value);
              }}
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRangeDraft({ from: "", to: "" });
              updateSetup(sc.id, { dateRange: null });
            }}
          >
            Use full range
          </Button>
        </div>
        {sc.setup.dateRange ? (
          <p className="mt-2 text-xs text-zinc-500">
            Analyzing{" "}
            {formatDayShort(
              new Date(sc.setup.dateRange.from).getUTCFullYear(),
              new Date(sc.setup.dateRange.from).getUTCMonth(),
              new Date(sc.setup.dateRange.from).getUTCDate(),
            )}{" "}
            →{" "}
            {formatDayShort(
              new Date(sc.setup.dateRange.to).getUTCFullYear(),
              new Date(sc.setup.dateRange.to).getUTCMonth(),
              new Date(sc.setup.dateRange.to).getUTCDate(),
            )}
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Full range:{" "}
            {analytics.dateRange
              ? `${formatDayShort(new Date(analytics.dateRange.from).getUTCFullYear(), new Date(analytics.dateRange.from).getUTCMonth(), new Date(analytics.dateRange.from).getUTCDate())} → ${formatDayShort(new Date(analytics.dateRange.to).getUTCFullYear(), new Date(analytics.dateRange.to).getUTCMonth(), new Date(analytics.dateRange.to).getUTCDate())}`
              : "—"}
          </p>
        )}
      </Panel>

      <Panel>
        <h2 className="font-display mb-4 text-lg font-bold text-white">Message filtering</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-3">
            <Toggle
              label="Exclude attachment events"
              description="Don't count photo/video/document placeholder entries as messages."
              checked={sc.setup.excludeAttachments}
              onChange={(v) => updateSetup(sc.id, { excludeAttachments: v })}
            />
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <Toggle
              label="Include system messages"
              description="Count encryption notices, group events and call events in totals."
              checked={sc.setup.includeSystemMessages}
              onChange={(v) => updateSetup(sc.id, { includeSystemMessages: v })}
            />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Eligible messages" value={formatInt(analytics.eligibleMessages)} />
        <Stat label="Active days" value={formatInt(analytics.activeDays)} />
        <Stat label="Participants" value={formatInt(analytics.participants.length)} />
        <Stat label="Words" value={formatInt(analytics.totalWords)} />
      </div>

      {analytics.eligibleMessages === 0 ? (
        <Callout tone="warn" title="Nothing left to analyze">
          Your current filters exclude every message. Loosen the date range or include more
          participants.
        </Callout>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void recompute(sc.id).then(() => setStep("dashboard"))}
          disabled={analytics.eligibleMessages === 0}
        >
          Analyze →
        </Button>
        <Button variant="secondary" onClick={() => setStep("import")}>
          Back to import
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Metrics follow documented definitions — see “How chat analysis works” in the footer.
        Participant filters apply immediately; the dashboard always shows the eligible pool size.
      </p>
    </div>
  );
}
