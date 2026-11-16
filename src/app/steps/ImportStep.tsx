import { useRef, useState } from "react";
import { useApp } from "../store";
import { Badge, Button, Callout, Panel, Spinner } from "@/components/ui/primitives";
import { Select } from "@/components/ui/controls";
import { detectFormat, type DetectedFormat } from "@/features/parsers/detect";
import { FILE_LIMITS } from "@/features/types";
import { formatBytes, formatInt } from "@/lib/format";
import { DEMO_CONFIGS } from "@/features/demo/demoData";

const PLATFORMS = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    format: "TXT export (without media)",
    detail: "Open the chat → menu → More → Export chat → Without media.",
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    format: "Desktop JSON export",
    detail: "Telegram Desktop → chat → ⋮ → Export chat history → Machine-readable JSON.",
  },
] as const;

export function ImportStep() {
  const importFile = useApp((s) => s.importFile);
  const loadDemo = useApp((s) => s.loadDemo);
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const progress = useApp((s) => s.progress);
  const conversations = useApp((s) => s.conversations);
  const setActive = useApp((s) => s.setActive);
  const reparseWithDateOrder = useApp((s) => s.reparseWithDateOrder);
  const activeId = useApp((s) => s.activeId);
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);

  const [dragOver, setDragOver] = useState(false);
  const [picked, setPicked] = useState<{
    name: string;
    size: number;
    detected: DetectedFormat | "unknown" | null;
  }>({
    name: "",
    size: 0,
    detected: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status === "reading" || status === "parsing" || status === "analyzing";
  const activeSc = conversations.find((c) => c.id === activeId);

  // Show a fresh import surface unless we're returning to a loaded conversation.
  const showResult = Boolean(activeSc) && (step === "setup" || step === "dashboard");

  async function handleFile(file: File) {
    setPicked({ name: file.name, size: file.size, detected: null });
    if (file.size > FILE_LIMITS.warnBytes) {
      // large file notice happens in store too; here we just surface info
    }
    const head = await file.slice(0, 32 * 1024).text();
    const detection = detectFormat(head);
    setPicked({ name: file.name, size: file.size, detected: detection.format });
    await importFile(file);
  }

  if (showResult && activeSc) {
    const conversation = activeSc.conversation;
    return (
      <div className="space-y-6">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-white">
                {conversation.title || activeSc.fileName}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {activeSc.isDemo ? "Synthetic sample data" : activeSc.fileName} ·{" "}
                {activeSc.fileSize > 0 ? `${formatBytes(activeSc.fileSize)} · ` : ""}
                {formatInt(conversation.messages.length)} parsed messages ·{" "}
                {conversation.participants.length} participants
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setStep("dashboard")}>
                Open dashboard
              </Button>
              <Button size="sm" onClick={() => setStep("setup")}>
                Continue setup →
              </Button>
            </div>
          </div>
        </Panel>

        {conversation.importWarnings.length > 0 ? (
          <Callout tone="warn" title="Import notes">
            <ul className="list-disc space-y-1 pl-4">
              {conversation.importWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        {activeSc.format === "whatsapp" && conversation.dateOrderAmbiguous ? (
          <Panel>
            <p className="text-sm font-medium text-white">Date format check</p>
            <p className="mb-3 mt-1 text-xs text-zinc-400">
              This export's dates are ambiguous (both day and month ≤ 12). Currently interpreted as{" "}
              <strong className="text-zinc-200">{conversation.dateOrder}</strong>. Switch if dates
              look wrong.
            </p>
            <div className="w-56">
              <Select
                label="Interpret dates as"
                value={activeSc.dateOrder === "month-first" ? "month-first" : "day-first"}
                options={[
                  { value: "day-first", label: "DD/MM/YYYY (day-first)" },
                  { value: "month-first", label: "MM/DD/YYYY (month-first)" },
                ]}
                onChange={(v) => void reparseWithDateOrder(v as "day-first" | "month-first")}
              />
            </div>
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Import your conversation
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          Files are processed entirely in your browser — nothing is uploaded. Supported: WhatsApp
          TXT exports (Android & iOS) and Telegram Desktop JSON exports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORMS.map((p) => (
          <Panel key={p.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-2xl">
                {p.icon}
              </span>
              <h2 className="font-display text-lg font-bold text-white">{p.name}</h2>
            </div>
            <p className="text-xs text-zinc-400">{p.detail}</p>
            <Badge tone="neutral">{p.format}</Badge>
          </Panel>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a chat export: drag and drop or press Enter to browse"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) void handleFile(file);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors " +
          (dragOver
            ? "border-fuchsia-400 bg-fuchsia-500/10"
            : "border-white/20 bg-white/[0.02] hover:border-white/35")
        }
      >
        <span aria-hidden className="text-4xl">
          📤
        </span>
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm font-medium text-white">{progress.phase}…</p>
            <p className="text-xs text-zinc-500">Large files may take a few seconds</p>
          </div>
        ) : (
          <>
            <p className="font-display text-lg font-semibold text-white">
              Drag & drop your export here
            </p>
            <p className="text-sm text-zinc-400">
              or click to browse · max {FILE_LIMITS.hardMaxBytes / 1024 / 1024} MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.json,.log"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {picked.name && !busy && picked.detected ? (
        <Callout tone={picked.detected === "unknown" ? "warn" : "info"}>
          {picked.detected === "unknown"
            ? "Could not detect the format of "
            : `Detected ${picked.detected === "whatsapp" ? "WhatsApp TXT" : "Telegram JSON"}: `}{" "}
          <strong>{picked.name}</strong> ({formatBytes(picked.size)})
        </Callout>
      ) : null}

      {error ? (
        <Callout tone="error" title="Import failed">
          {error}
          <div className="mt-2 text-xs opacity-80">
            WhatsApp exports must be the plain-text file from “Export chat”. Telegram exports must
            be the machine-readable JSON (not HTML). Group and personal chats are both supported.
          </div>
        </Callout>
      ) : null}

      <Panel className="text-center">
        <p className="text-sm font-medium text-white">No export handy?</p>
        <p className="mb-3 mt-1 text-xs text-zinc-400">
          Explore ChatWrapped with deterministic synthetic sample data.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {(Object.keys(DEMO_CONFIGS) as Array<keyof typeof DEMO_CONFIGS>).map((id) => (
            <Button
              key={id}
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void loadDemo(id)}
            >
              {id === "friends"
                ? "🧋 Try a friends chat"
                : id === "family"
                  ? "🏡 Try a family group"
                  : "💼 Try a work group"}
            </Button>
          ))}
        </div>
      </Panel>

      {conversations.length > 0 ? (
        <Panel>
          <p className="mb-3 text-sm font-semibold text-white">
            Conversations in this session ({conversations.length})
          </p>
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {c.conversation.title || c.fileName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.isDemo ? "synthetic sample" : c.fileName} ·{" "}
                    {formatInt(c.conversation.messages.length)} messages
                    {c.analytics ? ` · ${formatInt(c.analytics.eligibleMessages)} eligible` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.id === activeId ? <Badge tone="accent">active</Badge> : null}
                  <Button variant="ghost" size="sm" onClick={() => setActive(c.id)}>
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
