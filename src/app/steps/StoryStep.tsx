import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { displayName, useApp } from "../store";
import { Badge, Button, EmptyState, Panel } from "@/components/ui/primitives";
import { SegmentedControl, Toggle } from "@/components/ui/controls";
import { THEMES, THEME_LIST, themeToCssVars, type ThemeId } from "@/features/themes/themes";
import { generateStory, type StorySlide } from "@/features/stories/generate";
import { ShareBar } from "@/components/charts/Charts";
import { renderCardPng, cardFileName } from "@/features/sharing/cardRenderer";
import { downloadBlob } from "@/features/sharing/export";
import { formatInt } from "@/lib/format";

const AUTOPLAY_MS = 6000;

export function StoryStep() {
  const conversations = useApp((s) => s.conversations);
  const activeId = useApp((s) => s.activeId);
  const themeId = useApp((s) => s.themeId);
  const setTheme = useApp((s) => s.setTheme);
  const setStep = useApp((s) => s.setStep);
  const autoplay = useApp((s) => s.autoplay);
  const setAutoplay = useApp((s) => s.setAutoplay);
  const reducedMotion = useApp((s) => s.reducedMotion);
  const sc = conversations.find((c) => c.id === activeId);

  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    if (sc) for (const p of sc.conversation.participants) map[p.id] = displayName(sc, p.id);
    return map;
  }, [sc]);

  const theme = THEMES[themeId];
  const slides = useMemo(() => {
    if (!sc?.analytics) return [];
    return generateStory(
      {
        analytics: sc.analytics,
        names,
        conversationTitle: sc.conversation.title || sc.fileName,
        isDemo: sc.isDemo,
      },
      theme,
    );
  }, [sc, names, theme]);

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, slides.length - 1)),
    [slides.length],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      } else if (e.key === "f") {
        setFullscreen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, fullscreen]);

  // Autoplay
  useEffect(() => {
    if (!autoplay || paused || reducedMotion) return;
    const t = setTimeout(() => {
      if (index < slides.length - 1) next();
      else setAutoplay(false);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [autoplay, paused, index, slides.length, next, setAutoplay, reducedMotion]);

  // Touch/swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    const endX = e.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined) return;
    const dx = endX - startX;
    if (dx < -48) next();
    else if (dx > 48) prev();
    touchStartX.current = null;
  };

  async function downloadSlide(slide: StorySlide) {
    if (!sc) return;
    const blob = await renderCardPng({
      size: "story",
      theme,
      slide,
      attribution: true,
      caption: null,
      headline: null,
    });
    downloadBlob(blob, cardFileName(slide, theme, "story"));
  }

  if (!sc?.analytics) {
    return (
      <EmptyState
        icon="🎬"
        title="No story yet"
        description="Import a conversation or load the sample data to unwrap your story."
        action={<Button onClick={() => setStep("import")}>Go to import</Button>}
      />
    );
  }

  if (slides.length === 0) {
    return (
      <EmptyState
        icon="🎬"
        title="Nothing to unwrap"
        description="This conversation doesn't have enough data for a story."
      />
    );
  }

  const slide = slides[Math.min(index, slides.length - 1)]!;
  const themeVars = themeToCssVars(theme) as React.CSSProperties;

  const content = (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Theme"
            value={themeId}
            onChange={(v) => setTheme(v as ThemeId)}
            options={THEME_LIST.slice(0, 5).map((t) => ({ value: t.id, label: t.name }))}
          />
          <select
            aria-label="More themes"
            value={THEME_LIST.slice(0, 5).some((t) => t.id === themeId) ? "" : themeId}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
            className="h-9 rounded-xl border border-white/15 bg-[#14121c] px-2.5 text-xs font-semibold text-white"
          >
            <option value="" disabled>
              More themes…
            </option>
            {THEME_LIST.slice(5).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? "⤡ Exit full screen" : "⛶ Full screen"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void downloadSlide(slide)}>
            ⬇ Save slide
          </Button>
        </div>
      </div>

      {/* Theme grid for exploration */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
          All themes ({THEME_LIST.length})
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {THEME_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all " +
                (t.id === themeId
                  ? "border-fuchsia-400/60 bg-white/10 text-white"
                  : "border-white/10 text-zinc-300 hover:bg-white/5")
              }
            >
              <span
                aria-hidden
                className="inline-block size-4 shrink-0 rounded-full"
                style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }}
              />
              {t.name}
            </button>
          ))}
        </div>
      </details>

      {/* Story surface */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={themeVars}
        className={
          "theme-surface relative mx-auto flex w-full flex-col overflow-hidden rounded-3xl border " +
          (fullscreen
            ? "h-[calc(100dvh-130px)] max-w-2xl"
            : "aspect-[9/16] max-h-[72dvh] max-w-[420px]")
        }
      >
        <div className={`theme-decor theme-decor-${theme.decoration}`} aria-hidden />
        <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
          {/* progress */}
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-label="Story progress"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={slides.length}
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}: ${s.kicker}`}
                onClick={() => setIndex(i)}
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                <span
                  className="block h-full rounded-full transition-[width] duration-300"
                  style={{ width: i <= index ? "100%" : "0%", background: theme.accent }}
                />
              </button>
            ))}
          </div>

          {/* slide body */}
          <div
            key={slide.id}
            className={
              "flex flex-1 flex-col justify-center " + (reducedMotion ? "" : "animate-fade-up")
            }
          >
            <p
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: theme.accent }}
            >
              {slide.kicker}
            </p>
            <h2
              className="font-display mt-4 text-3xl leading-tight font-bold whitespace-pre-line sm:text-4xl"
              style={{ color: theme.text, letterSpacing: theme.letterSpacing }}
            >
              {slide.title}
            </h2>
            <p
              className={
                "font-display mt-5 font-bold tracking-tight " +
                (slide.value.length > 12 ? "text-4xl sm:text-5xl" : "text-6xl sm:text-7xl")
              }
              style={{
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {slide.value}
            </p>
            {slide.detail ? (
              <p className="mt-4 text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                {slide.detail}
              </p>
            ) : null}

            {/* visuals */}
            <div className="mt-8">
              {slide.visual.kind === "share" ? (
                <div style={{ color: theme.text }}>
                  <ShareBar parts={slide.visual.parts.map((p) => ({ ...p, value: p.pct }))} />
                </div>
              ) : null}
              {slide.visual.kind === "trend" ? (
                <MiniTrend
                  points={slide.visual.points}
                  color={theme.accent}
                  textMuted={theme.textMuted}
                />
              ) : null}
              {slide.visual.kind === "starts" ? (
                <MiniBars
                  rows={slide.visual.rows.map((r) => ({ label: r.label, pct: r.pct }))}
                  color={theme.accent}
                />
              ) : null}
              {slide.visual.kind === "streak" ? (
                <MiniStreak
                  length={slide.visual.length}
                  color={theme.accent}
                  accent2={theme.accent2}
                />
              ) : null}
              {slide.visual.kind === "hour" ? (
                <MiniHourClock
                  hour={slide.visual.hour}
                  share={slide.visual.share}
                  color={theme.accent}
                  text={theme.text}
                  muted={theme.textMuted}
                />
              ) : null}
              {slide.visual.kind === "emoji" ? (
                <MiniEmojiBar
                  emoji={slide.visual.emoji}
                  sharePct={slide.visual.sharePct}
                  color={theme.accent}
                />
              ) : null}
              {slide.visual.kind === "response" ? (
                <MiniStatBlocks
                  blocks={[
                    ["median", slide.visual.median],
                    ["average", slide.visual.avg],
                    ["fastest", slide.visual.fastest],
                  ]}
                  theme={theme}
                />
              ) : null}
              {slide.visual.kind === "words" ? (
                <MiniWords words={slide.visual.words} color={theme.accent} text={theme.text} />
              ) : null}
              {slide.visual.kind === "day" || slide.visual.kind === "burst" ? (
                <MiniDots count={Math.min(slide.visual.count, 24)} color={theme.accent2} />
              ) : null}
            </div>
          </div>

          {/* footer nav */}
          <div className="mt-auto flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-30"
              style={{ color: theme.text }}
            >
              ← Prev
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="rounded-xl px-2 py-1.5 text-xs font-semibold"
                style={{ color: theme.textMuted }}
              >
                {paused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button
                type="button"
                onClick={() => setAutoplay(!autoplay)}
                className="rounded-xl px-2 py-1.5 text-xs font-semibold"
                style={{ color: theme.textMuted }}
              >
                {autoplay ? "Stop auto" : "▶ Auto"}
              </button>
              <span className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
                {index + 1}/{slides.length}
              </span>
            </div>
            {index === slides.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                }}
                className="rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ color: theme.accent }}
              >
                ↺ Restart
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ color: theme.text }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* slide selector */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIndex(i)}
            className={
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors " +
              (i === index
                ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200"
                : "border-white/10 text-zinc-400 hover:text-white")
            }
          >
            {i + 1}. {s.kicker}
          </button>
        ))}
      </div>

      <Panel>
        <Toggle
          label="Autoplay slides"
          description="Advance automatically every 6 seconds (disabled when your system prefers reduced motion)."
          checked={autoplay}
          onChange={setAutoplay}
        />
      </Panel>

      <p className="text-center text-xs text-zinc-500">
        Keyboard: ← → navigate · space next · F full screen. Values come from the current filters —{" "}
        {formatInt(sc.analytics.eligibleMessages)} eligible messages.
      </p>
    </div>
  );

  return (
    <div>
      {sc.isDemo ? (
        <div className="mb-4 flex justify-center">
          <Badge tone="accent">Synthetic sample data</Badge>
        </div>
      ) : null}
      {content}
    </div>
  );
}

/* ---------- Inline mini-visuals for the story surface ---------- */

function MiniTrend({
  points,
  color,
  textMuted,
}: {
  points: Array<{ label: string; count: number }>;
  color: string;
  textMuted: string;
}) {
  const max = Math.max(...points.map((p) => p.count), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 96 }}>
      {points.map((p, i) => (
        <div key={i} className="group relative flex-1" title={`${p.label}: ${p.count}`}>
          <div
            className="w-full rounded-t-md transition-[height] duration-300"
            style={{
              height: Math.max(6, (p.count / max) * 90),
              background: color,
              opacity: 0.35 + 0.65 * (p.count / max),
            }}
          />
        </div>
      ))}
      <div className="absolute" />
      <p className="sr-only" style={{ color: textMuted }}>
        monthly trend
      </p>
    </div>
  );
}

function MiniBars({ rows, color }: { rows: Array<{ label: string; pct: number }>; color: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-24 truncate text-xs font-semibold opacity-90">{r.label}</span>
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${r.pct}%`, background: color }}
            />
          </div>
          <span className="w-10 text-right text-xs tabular-nums opacity-75">
            {r.pct.toFixed(0)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function MiniStreak({
  length,
  color,
  accent2,
}: {
  length: number;
  color: string;
  accent2: string;
}) {
  const shown = Math.min(length, 60);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="size-3.5 rounded-md"
          style={{
            background: i === shown - 1 ? accent2 : color,
            opacity: 0.3 + 0.7 * (i / shown),
          }}
        />
      ))}
    </div>
  );
}

function MiniHourClock({
  hour,
  share,
  color,
  text,
  muted,
}: {
  hour: number;
  share: number;
  color: string;
  text: string;
  muted: string;
}) {
  const frac = Math.min(1, share / 100);
  const angle = (hour / 12) * 360 - 90;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="size-24" role="img" aria-label={`Peak hour ${hour}:00`}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${frac * 264} 264`}
          transform="rotate(-90 50 50)"
        />
        <line
          x1="50"
          y1="50"
          x2={50 + 26 * Math.cos((angle * Math.PI) / 180)}
          y2={50 + 26 * Math.sin((angle * Math.PI) / 180)}
          stroke={text}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="4" fill={text} />
      </svg>
      <p className="text-sm" style={{ color: muted }}>
        {share.toFixed(0)}% of messages
        <br />
        happen at this hour
      </p>
    </div>
  );
}

function MiniEmojiBar({
  emoji,
  sharePct,
  color,
}: {
  emoji: string;
  sharePct: number;
  color: string;
}) {
  return (
    <div>
      <span aria-hidden className="text-6xl">
        {emoji}
      </span>
      <div
        className="mt-3 h-2.5 w-3/4 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.18)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(sharePct, 6)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MiniStatBlocks({
  blocks,
  theme,
}: {
  blocks: Array<[string, string]>;
  theme: {
    surface: string;
    surfaceBorder: string;
    textMuted: string;
    accent: string;
    text: string;
  };
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {blocks.map(([label, value], i) => (
        <div
          key={label}
          className="rounded-2xl border p-3 text-center"
          style={{ background: theme.surface, borderColor: theme.surfaceBorder }}
        >
          <p
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: theme.textMuted }}
          >
            {label}
          </p>
          <p
            className="font-display mt-1.5 text-xl font-bold"
            style={{ color: i === 0 ? theme.accent : theme.text }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MiniWords({
  words,
  color,
  text,
}: {
  words: Array<{ word: string; count: number }>;
  color: string;
  text: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {words.map((w, i) => (
        <span
          key={w.word}
          className="font-display font-bold"
          style={{
            color: i === 0 ? color : text,
            fontSize: `${Math.max(18, 30 - i * 4)}px`,
            opacity: 1 - i * 0.12,
          }}
        >
          #{w.word}
        </span>
      ))}
    </div>
  );
}

function MiniDots({ count, color }: { count: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: color, opacity: 0.85 }}
        />
      ))}
    </div>
  );
}
