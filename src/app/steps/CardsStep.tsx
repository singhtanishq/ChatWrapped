import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, useApp } from "../store";
import { Button, Callout, EmptyState, Panel, SectionTitle } from "@/components/ui/primitives";
import { SegmentedControl, TextInput, Toggle } from "@/components/ui/controls";
import { THEMES, THEME_LIST, type ThemeId } from "@/features/themes/themes";
import { generateStory, type StorySlide } from "@/features/stories/generate";
import {
  CARD_SIZES,
  cardFileName,
  ensureCardFonts,
  renderCard,
  type CardSizeId,
} from "@/features/sharing/cardRenderer";
import { downloadBlob, exportZip, shareCard } from "@/features/sharing/export";
import type { ThemeTokens } from "@/features/themes/themes";

export function CardsStep() {
  const conversations = useApp((s) => s.conversations);
  const activeId = useApp((s) => s.activeId);
  const themeId = useApp((s) => s.themeId);
  const setTheme = useApp((s) => s.setTheme);
  const cardOptions = useApp((s) => s.cardOptions);
  const setCardOptions = useApp((s) => s.setCardOptions);
  const setStep = useApp((s) => s.setStep);
  const sc = conversations.find((c) => c.id === activeId);

  const [slideIndex, setSlideIndex] = useState(0);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exportSize, setExportSize] = useState<CardSizeId>(cardOptions.size);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    if (sc) for (const p of sc.conversation.participants) map[p.id] = displayName(sc, p.id);
    return map;
  }, [sc]);

  const theme: ThemeTokens = THEMES[themeId];
  const slides = useMemo(() => {
    if (!sc?.analytics) return [] as StorySlide[];
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

  const slide = slides[Math.min(slideIndex, slides.length - 1)];

  // Live canvas preview
  useEffect(() => {
    let cancelled = false;
    async function draw() {
      if (!canvasRef.current || !slide) return;
      await ensureCardFonts();
      if (cancelled) return;
      renderCard(canvasRef.current, {
        size: exportSize,
        theme,
        slide,
        attribution: cardOptions.attribution,
        caption: cardOptions.caption,
        headline: cardOptions.headline,
      });
    }
    void draw();
    return () => {
      cancelled = true;
    };
  }, [
    slide,
    theme,
    exportSize,
    cardOptions.attribution,
    cardOptions.caption,
    cardOptions.headline,
  ]);

  if (!sc?.analytics) {
    return (
      <EmptyState
        icon="🖼️"
        title="Nothing to export yet"
        description="Load a conversation first, then design and download your share cards."
        action={<Button onClick={() => setStep("import")}>Go to import</Button>}
      />
    );
  }
  if (!slide) {
    return (
      <EmptyState
        icon="🖼️"
        title="No slides available"
        description="This conversation doesn't produce story slides."
      />
    );
  }

  const currentOptions = () => ({
    size: exportSize,
    theme,
    slide,
    attribution: cardOptions.attribution,
    caption: cardOptions.caption,
    headline: cardOptions.headline,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          Share Card Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          High-resolution PNG cards rendered at exact export dimensions —{" "}
          {CARD_SIZES[exportSize].width}×{CARD_SIZES[exportSize].height}px for{" "}
          {CARD_SIZES[exportSize].label}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Preview */}
        <div className="order-2 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              sub={`Slide ${Math.min(slideIndex, slides.length - 1) + 1} of ${slides.length}`}
            >
              Preview
            </SectionTitle>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={slideIndex >= slides.length - 1}
                onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
              >
                →
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
            <canvas
              ref={canvasRef}
              className="mx-auto block h-auto w-full max-w-[360px] rounded-2xl shadow-2xl"
              aria-label={`Card preview: ${slide.title}`}
            />
            <p className="mt-3 text-center text-xs text-zinc-500">
              Rendered live with the same canvas pipeline used for exports — what you see is what
              downloads.
            </p>
          </div>

          {/* Slide chooser */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSlideIndex(i)}
                className={
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors " +
                  (i === slideIndex
                    ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-white/10 text-zinc-400 hover:text-white")
                }
              >
                {s.kicker}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="order-1 space-y-5 lg:order-2">
          <Panel>
            <SectionTitle sub="Exact output dimensions">Export size</SectionTitle>
            <SegmentedControl
              ariaLabel="Export size"
              value={exportSize}
              onChange={(v) => {
                setExportSize(v as CardSizeId);
                setCardOptions({ size: v as CardSizeId });
              }}
              options={[
                { value: "story", label: "9:16" },
                { value: "portrait", label: "4:5" },
                { value: "square", label: "1:1" },
                { value: "landscape", label: "1.9:1" },
              ]}
            />
            <p className="mt-2 text-xs text-zinc-500">
              {CARD_SIZES[exportSize].width} × {CARD_SIZES[exportSize].height}px ·{" "}
              {CARD_SIZES[exportSize].label}
            </p>
          </Panel>

          <Panel>
            <SectionTitle>Theme</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {THEME_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={
                    "flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold transition-all " +
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
          </Panel>

          <Panel>
            <SectionTitle>Customize</SectionTitle>
            <div className="space-y-3">
              <TextInput
                label="Headline override"
                placeholder={slide.title.split("\n")[0] ?? ""}
                value={cardOptions.headline ?? ""}
                onChange={(v) => setCardOptions({ headline: v === "" ? null : v })}
              />
              <TextInput
                label="Caption (appears on the card)"
                placeholder="e.g. 214 days of non-stop talking 💬"
                value={cardOptions.caption ?? ""}
                onChange={(v) => setCardOptions({ caption: v === "" ? null : v })}
              />
              <Toggle
                label="Show ChatWrapped attribution"
                description="A subtle credit line. Cards look great without it too."
                checked={cardOptions.attribution}
                onChange={(v) => setCardOptions({ attribution: v })}
              />
            </div>
          </Panel>

          <Panel>
            <SectionTitle sub="Individual PNG, native share or the full recap">Export</SectionTitle>
            <div className="grid gap-2">
              <Button
                onClick={async () => {
                  setStatus(null);
                  downloadBlob(
                    await (
                      await import("@/features/sharing/cardRenderer")
                    ).renderCardPng(currentOptions()),
                    cardFileName(slide, theme, exportSize),
                  );
                  setStatus("Card downloaded as PNG.");
                }}
              >
                ⬇ Download this card (PNG)
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  setStatus(null);
                  const result = await shareCard(currentOptions());
                  setStatus(
                    result === "shared"
                      ? "Shared via your device."
                      : "Sharing not available here — downloaded instead.",
                  );
                }}
              >
                📤 Share this card…
              </Button>
              <Button
                variant="secondary"
                disabled={zipProgress !== null}
                onClick={async () => {
                  setStatus(null);
                  const result = await exportZip(
                    slides,
                    (s) => ({
                      size: exportSize,
                      theme,
                      slide: s,
                      attribution: cardOptions.attribution,
                      caption: cardOptions.caption,
                      headline: cardOptions.headline,
                    }),
                    setZipProgress,
                  );
                  setZipProgress(null);
                  setStatus(`ZIP downloaded: ${result.fileName} (${result.count} cards).`);
                }}
              >
                {zipProgress
                  ? `📦 Zipping ${zipProgress.done}/${zipProgress.total}…`
                  : `📦 Export all ${slides.length} cards as ZIP`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const caption =
                    cardOptions.caption ??
                    `${sc.conversation.title || "Our chat"}: ${sc.analytics!.eligibleMessages} messages unwrapped — made privately in my browser with ChatWrapped.`;
                  void navigator.clipboard?.writeText(caption).then(
                    () => setStatus("Caption copied to clipboard."),
                    () => setStatus("Clipboard unavailable in this browser."),
                  );
                }}
              >
                📋 Copy caption text
              </Button>
            </div>
            {status ? <Callout tone="success">{status}</Callout> : null}
          </Panel>

          <Panel>
            <Toggle
              label="Anonymize names on cards"
              description="Applies the setup anonymization to participant names in card text."
              checked={sc.setup.anonymize}
              onChange={() => setStep("setup")}
            />
            <p className="mt-2 text-xs text-zinc-500">
              Anonymization is managed in Setup and applied everywhere consistently.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
