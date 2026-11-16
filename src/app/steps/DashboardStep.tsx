import { useMemo, useState } from "react";
import { useApp } from "../store";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Panel,
  SectionTitle,
  Stat,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/controls";
import { AreaTrend, HBars, Heatmap, ShareBar, VBars } from "@/components/charts/Charts";
import { buildRecords, computeAwards } from "@/features/analytics";
import type { AnalyticsResult } from "@/features/analytics/types";
import {
  formatDayShort,
  formatHour,
  formatInt,
  formatMinutes,
  formatMonthYear,
} from "@/lib/format";
import { THEMES } from "@/features/themes/themes";

type TabId = "overview" | "participants" | "activity" | "words" | "responses" | "records";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "📌" },
  { id: "participants", label: "Participants", icon: "👥" },
  { id: "activity", label: "Activity", icon: "🕒" },
  { id: "words", label: "Emoji & words", icon: "😀" },
  { id: "responses", label: "Responses", icon: "⚡" },
  { id: "records", label: "Records", icon: "🏆" },
];

const CHART_PALETTE = THEMES["wrapped-neon"].chartPalette;

export function DashboardStep() {
  const conversations = useApp((s) => s.conversations);
  const activeId = useApp((s) => s.activeId);
  const setStep = useApp((s) => s.setStep);
  const sc = conversations.find((c) => c.id === activeId);
  const [tab, setTab] = useState<TabId>("overview");

  if (!sc?.analytics) {
    return (
      <EmptyState
        icon="📊"
        title="No analysis yet"
        description="Import a WhatsApp or Telegram export — or load the synthetic sample — to see your dashboard."
        action={<Button onClick={() => setStep("import")}>Go to import</Button>}
      />
    );
  }

  const r = sc.analytics;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {sc.conversation.title || sc.fileName}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {formatInt(r.eligibleMessages)} eligible messages · {r.activeDays} active days ·{" "}
            {r.dateRange
              ? `${formatMonthYear(new Date(r.dateRange.from).getUTCFullYear(), new Date(r.dateRange.from).getUTCMonth())} – ${formatMonthYear(
                  new Date(r.dateRange.to).getUTCFullYear(),
                  new Date(r.dateRange.to).getUTCMonth(),
                )}`
              : "no date range"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setStep("stories")}>
            🎬 Play the story
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setStep("setup")}>
            ⚙️ Filters
          </Button>
        </div>
      </div>

      {sc.conversation.importWarnings.length > 0 && tab === "overview" ? (
        <Callout tone="info" title="Parser notes">
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {sc.conversation.importWarnings.slice(0, 4).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <Tabs value={tab} onChange={setTab} tabs={TABS} />

      {tab === "overview" && <OverviewTab r={r} />}
      {tab === "participants" && <ParticipantsTab r={r} />}
      {tab === "activity" && <ActivityTab r={r} />}
      {tab === "words" && <WordsTab r={r} />}
      {tab === "responses" && <ResponsesTab r={r} />}
      {tab === "records" && <RecordsTab r={r} />}
    </div>
  );
}

function OverviewTab({ r }: { r: AnalyticsResult }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Messages"
          value={formatInt(r.eligibleMessages)}
          tone="accent"
          sub={`of ${formatInt(r.totalParsed)} parsed`}
        />
        <Stat
          label="Words"
          value={formatInt(r.totalWords)}
          sub={`${Math.round(r.avgMessageChars)} chars avg`}
        />
        <Stat
          label="Active days"
          value={formatInt(r.activeDays)}
          sub={`${r.participants.length} participants`}
        />
        <Stat
          label="Peak hour"
          value={r.mostActiveHour !== null ? formatHour(r.mostActiveHour) : "—"}
          sub={`${r.hourly[r.mostActiveHour ?? 0] ?? 0} messages`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <SectionTitle sub="Eligible messages per month">Monthly activity</SectionTitle>
          {r.monthly.length >= 2 ? (
            <AreaTrend
              values={r.monthly.map((m) => m.count)}
              labels={r.monthly.map((m) => formatMonthYear(m.year, m.month0))}
            />
          ) : (
            <EmptyState
              title="Not enough months"
              description="A trend needs at least two months of data."
            />
          )}
        </Panel>
        <Panel>
          <SectionTitle sub="Share of eligible messages">Who sends what</SectionTitle>
          <ShareBar
            parts={r.participants.map((p, i) => ({
              label: p.displayName,
              value: p.messages,
              color: CHART_PALETTE[i % CHART_PALETTE.length]!,
              pct: p.sharePct,
            }))}
          />
          <div className="mt-5">
            <SectionTitle sub="Sample transparency">Counts & exclusions</SectionTitle>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>
                Parsed messages:{" "}
                <strong className="text-zinc-200">{formatInt(r.totalParsed)}</strong> (incl.{" "}
                {formatInt(r.systemCount)} system events)
              </li>
              <li>
                Eligible after filters:{" "}
                <strong className="text-zinc-200">{formatInt(r.eligibleMessages)}</strong>
              </li>
              <li>
                Attachment events:{" "}
                <strong className="text-zinc-200">{formatInt(r.mediaCount)}</strong>
              </li>
            </ul>
          </div>
        </Panel>
      </div>

      {r.sampleNotes.map((note, i) => (
        <Callout key={i} tone="info">
          {note}
        </Callout>
      ))}
    </div>
  );
}

function ParticipantsTab({ r }: { r: AnalyticsResult }) {
  const rows = r.participants.map((p, i) => ({
    label: p.displayName,
    value: p.messages,
    color: CHART_PALETTE[i % CHART_PALETTE.length]!,
    sub: `${p.sharePct.toFixed(1)}%`,
  }));
  const wordRows = [...r.participants]
    .sort((a, b) => b.words - a.words)
    .map((p, i) => ({
      label: p.displayName,
      value: p.words,
      color: CHART_PALETTE[i % CHART_PALETTE.length]!,
      sub: `${Math.round(p.avgChars)} chars avg`,
    }));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <SectionTitle sub="Eligible messages per participant">Message volume</SectionTitle>
        <HBars rows={rows} />
      </Panel>
      <Panel>
        <SectionTitle sub="Word counts including stopwords">Words written</SectionTitle>
        <HBars rows={wordRows} />
      </Panel>
      <Panel className="lg:col-span-2">
        <SectionTitle sub="Per-participant detail">Full breakdown</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs text-zinc-400 uppercase">
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Messages</th>
                <th className="px-3 py-2">Share</th>
                <th className="px-3 py-2">Words</th>
                <th className="px-3 py-2">Emoji</th>
                <th className="px-3 py-2">Media</th>
                <th className="px-3 py-2">Starts</th>
                <th className="px-3 py-2">Median reply</th>
              </tr>
            </thead>
            <tbody>
              {r.participants.map((p) => (
                <tr key={p.participantId} className="border-t border-white/8 text-zinc-200">
                  <td className="px-3 py-2.5 font-semibold">{p.displayName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatInt(p.messages)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{p.sharePct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatInt(p.words)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatInt(p.emoji)}{" "}
                    <span className="text-xs text-zinc-500">
                      ({p.emojiPerMessage.toFixed(2)}/msg)
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatInt(p.mediaCount)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatInt(p.conversationStarts)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {p.medianResponseMs !== null ? formatMinutes(p.medianResponseMs) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ActivityTab({ r }: { r: AnalyticsResult }) {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayRows = r.weekday.map((v, i) => ({
    label: dayLabels[i]!,
    value: v,
    color: i === 0 || i === 6 ? "#fb923c" : "#e879f9",
  }));
  const hourLabels = Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? formatHour(h) : ""));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel className="lg:col-span-2">
        <SectionTitle sub="When the conversation happens — darker means fewer messages">
          Hour × weekday heatmap
        </SectionTitle>
        <Heatmap matrix={r.heatmap} />
      </Panel>
      <Panel>
        <SectionTitle sub="Eligible messages by weekday">Weekday rhythm</SectionTitle>
        <HBars rows={weekdayRows} />
        <p className="mt-3 text-xs text-zinc-400">
          Weekend share: <strong className="text-zinc-200">{r.weekendSharePct.toFixed(1)}%</strong>
        </p>
      </Panel>
      <Panel>
        <SectionTitle sub="Eligible messages by hour of day">Hourly pulse</SectionTitle>
        <VBars
          values={r.hourly}
          labels={hourLabels}
          {...(r.mostActiveHour !== null ? { highlightIndex: r.mostActiveHour } : {})}
        />
        <p className="mt-3 text-xs text-zinc-400">
          Peak:{" "}
          <strong className="text-zinc-200">
            {r.mostActiveHour !== null ? formatHour(r.mostActiveHour) : "—"}
          </strong>
          {r.longestStreak ? (
            <>
              {" "}
              · Longest streak:{" "}
              <strong className="text-zinc-200">{r.longestStreak.length} days</strong>
            </>
          ) : null}
        </p>
      </Panel>
      {r.daily.length >= 3 ? (
        <Panel className="lg:col-span-2">
          <SectionTitle sub="Every active day">Daily timeline</SectionTitle>
          <AreaTrend
            values={r.daily.map((d) => d.count)}
            labels={r.daily.map((d) =>
              formatDayShort(
                new Date(d.dayTs).getUTCFullYear(),
                new Date(d.dayTs).getUTCMonth(),
                new Date(d.dayTs).getUTCDate(),
              ),
            )}
            height={200}
          />
        </Panel>
      ) : null}
    </div>
  );
}

function WordsTab({ r }: { r: AnalyticsResult }) {
  const emojiRows = r.emojiRanking.slice(0, 8).map((e, i) => ({
    label: `${e.emoji}`,
    value: e.count,
    color: CHART_PALETTE[i % CHART_PALETTE.length]!,
  }));
  const wordRows = r.wordRanking.slice(0, 10).map((w, i) => ({
    label: w.word,
    value: w.count,
    color: CHART_PALETTE[i % CHART_PALETTE.length]!,
  }));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel>
        <SectionTitle
          sub={`Emoji per message: ${r.emojiPerMessage.toFixed(2)} — grapheme-safe counting`}
        >
          Most-used emoji
        </SectionTitle>
        {emojiRows.length > 0 ? (
          <HBars rows={emojiRows} />
        ) : (
          <EmptyState title="No emoji found" description="This conversation didn't use emoji." />
        )}
      </Panel>
      <Panel>
        <SectionTitle sub="Stopwords, numbers, URLs and emails excluded">
          Signature words
        </SectionTitle>
        {wordRows.length > 0 ? (
          <HBars rows={wordRows} />
        ) : (
          <EmptyState title="No signature words" description="Not enough text to rank words." />
        )}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-zinc-400">Questions</p>
            <p className="font-display mt-1 text-xl font-bold text-white">
              {r.questionRate.toFixed(2)}/msg
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-zinc-400">Avg length</p>
            <p className="font-display mt-1 text-xl font-bold text-white">
              {Math.round(r.avgMessageChars)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <p className="text-xs text-zinc-400">Messages w/ emoji</p>
            <p className="font-display mt-1 text-xl font-bold text-white">
              {Math.round(r.emojiPerMessage * 100)}%
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ResponsesTab({ r }: { r: AnalyticsResult }) {
  return (
    <div className="space-y-5">
      {r.response ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Median reply" value={formatMinutes(r.response.medianMs)} tone="accent" />
            <Stat label="Average reply" value={formatMinutes(r.response.avgMs)} />
            <Stat label="Fastest reply" value={formatMinutes(r.response.fastestMs)} />
            <Stat label="Longest silence" value={formatMinutes(r.response.longestGapMs)} />
          </div>
          <Panel>
            <SectionTitle sub="Who replies fastest — median of valid responses (≤ 6h)">
              Response leaderboard
            </SectionTitle>
            {(() => {
              const rows = r.participants
                .filter((p) => p.responses > 0)
                .sort((a, b) => (a.medianResponseMs ?? Infinity) - (b.medianResponseMs ?? Infinity))
                .map((p, i) => ({
                  label: p.displayName,
                  value: p.responses,
                  color: CHART_PALETTE[i % CHART_PALETTE.length]!,
                  sub: `median ${p.medianResponseMs !== null ? formatMinutes(p.medianResponseMs) : "—"}`,
                }));
              return rows.length > 0 ? (
                <HBars rows={rows} unit=" replies" />
              ) : (
                <EmptyState title="No response events" />
              );
            })()}
          </Panel>
          <Callout tone="info" title="How this is calculated">
            A <strong>burst</strong> groups consecutive messages by the same participant sent within
            2 minutes. A <strong>response</strong> is the first message from a different participant
            after a burst, measured from the burst's first message. Responses over 6 hours are
            excluded from averages but tracked as silence gaps. See{" "}
            <a
              className="underline"
              href="https://singhtanishq.github.io/ChatWrapped/how-chat-analysis-works/"
            >
              the metric guide
            </a>
            .
          </Callout>
        </>
      ) : (
        <EmptyState
          icon="⚡"
          title="Not enough response data"
          description="Response statistics need messages from at least two participants with timestamps."
        />
      )}
    </div>
  );
}

function RecordsTab({ r }: { r: AnalyticsResult }) {
  const records = useMemo(() => buildRecords(r), [r]);
  const awards = useMemo(() => computeAwards(r), [r]);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {records.map((rec) => (
          <Panel key={rec.id} className="flex flex-col justify-between">
            <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              {rec.label}
            </p>
            <p className="font-display mt-2 text-2xl font-bold text-white">{rec.value}</p>
            <p className="mt-1 text-xs text-zinc-400">{rec.detail}</p>
          </Panel>
        ))}
      </div>
      <div>
        <SectionTitle sub="Playful statistics with explicit thresholds — never personality assessments">
          Participant awards
        </SectionTitle>
        {awards.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="No awards yet"
            description="Awards need at least 10 eligible messages per participant. Keep chatting!"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {awards.map((a) => (
              <Panel key={a.id} className="text-center">
                <div aria-hidden className="text-3xl">
                  {a.emoji}
                </div>
                <p className="font-display mt-2 font-bold text-white">{a.title}</p>
                <p className="mt-1 text-sm font-semibold text-fuchsia-300">
                  {a.winnerNames.join(", ")}
                  {a.tied ? " (tied)" : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{a.value}</p>
                <p className="mt-2 text-[11px] text-zinc-500">{a.detail}</p>
              </Panel>
            ))}
          </div>
        )}
      </div>
      <Badge tone="neutral">Records use the current filters</Badge>
    </div>
  );
}
