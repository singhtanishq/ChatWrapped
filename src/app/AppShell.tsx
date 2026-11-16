import { useEffect, useMemo } from "react";
import { useApp, type Step } from "./store";
import { ImportStep } from "./steps/ImportStep";
import { SetupStep } from "./steps/SetupStep";
import { DashboardStep } from "./steps/DashboardStep";
import { StoryStep } from "./steps/StoryStep";
import { CardsStep } from "./steps/CardsStep";
import { CompareStep } from "./steps/CompareStep";
import { PrivacyDialog } from "./PrivacyDialog";
import { Badge, ConfirmButton } from "@/components/ui/primitives";
import { SITE } from "@/lib/site";
import { openPrivacyDialog } from "./uiState";

const STEPS: Array<{ id: Step; label: string; icon: string }> = [
  { id: "import", label: "Import", icon: "📥" },
  { id: "setup", label: "Setup", icon: "👥" },
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "stories", label: "Story", icon: "🎬" },
  { id: "cards", label: "Cards", icon: "🖼️" },
  { id: "compare", label: "Compare", icon: "⚖️" },
];

export function stepFromHash(): Step {
  const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#\/?/, "") : "";
  return STEPS.find((s) => s.id === hash)?.id ?? "import";
}

export function AppShell() {
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);
  const status = useApp((s) => s.status);
  const activeId = useApp((s) => s.activeId);
  const conversations = useApp((s) => s.conversations);
  const themeId = useApp((s) => s.themeId);
  const clearSession = useApp((s) => s.clearSession);
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  // Hash routing keeps deep-links and the back button working under a
  // static host (no server rewrites available on GitHub Pages).
  useEffect(() => {
    const sync = () => setStep(stepFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [setStep]);

  // Demo deep-link support (?demo=friends|family|team) — handled at the shell
  // level so ?demo=1#/stories style links work from any step.
  const loadDemo = useApp((s) => s.loadDemo);
  const conversationCount = conversations.length;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const demo = params.get("demo");
    if (demo && conversationCount === 0) {
      const id = (["friends", "family", "team"] as const).find((k) => k === demo) ?? "friends";
      void loadDemo(id);
    }
  }, []);

  useEffect(() => {
    const target = `#/${step}`;
    if (typeof window !== "undefined" && window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [step]);

  const hasData = Boolean(active?.analytics);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0910]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0910]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
          <a
            href={`${import.meta.env.BASE_URL}`}
            className="flex items-center gap-2 font-display text-lg font-bold text-white"
          >
            <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden>
              <defs>
                <linearGradient id="hdr-g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7c3aed" />
                  <stop offset="0.55" stopColor="#d946ef" />
                  <stop offset="1" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              <path
                d="M32 6C17.1 6 5 16.6 5 29.7c0 7.4 3.9 14 10 18.4L13 58l10.6-4.6c2.6.7 5.5 1.1 8.4 1.1 14.9 0 27-10.6 27-23.8S46.9 6 32 6z"
                fill="url(#hdr-g)"
              />
              <path
                d="M20.5 30.2 25 34.5l10.8-10.9"
                fill="none"
                stroke="#fff"
                strokeWidth="4.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">{SITE.name}</span>
          </a>
          <nav aria-label="Analyzer steps" className="min-w-0 flex-1 overflow-x-auto">
            <ol className="flex items-center gap-1 text-xs sm:text-sm">
              {STEPS.map((s, i) => {
                const enabled = s.id === "import" || s.id === "compare" ? true : hasData;
                const selected = step === s.id;
                return (
                  <li key={s.id} className="flex items-center">
                    {i > 0 ? (
                      <span aria-hidden className="px-0.5 text-zinc-600">
                        →
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => setStep(s.id)}
                      aria-label={`Go to ${s.label}`}
                      aria-current={selected ? "step" : undefined}
                      className={
                        "rounded-lg px-2.5 py-1.5 font-semibold transition-colors disabled:opacity-35 " +
                        (selected ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200")
                      }
                    >
                      <span aria-hidden className="mr-1">
                        {s.icon}
                      </span>
                      <span className="hidden md:inline">{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          {active?.isDemo ? <Badge tone="accent">Sample data</Badge> : null}
          <button
            type="button"
            onClick={() => openPrivacyDialog()}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Privacy
          </button>
          {hasData || conversations.length > 0 ? (
            <ConfirmButton
              variant="ghost"
              size="sm"
              confirmLabel="Really clear?"
              onConfirm={() => {
                clearSession();
                setStep("import");
              }}
            >
              Clear
            </ConfirmButton>
          ) : null}
        </div>
        {themeId !== "wrapped-neon" && (step === "stories" || step === "cards") ? (
          <div
            aria-hidden
            className="h-px w-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500"
          />
        ) : null}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {step === "import" && <ImportStep />}
        {step === "setup" && <SetupStep />}
        {step === "dashboard" && <DashboardStep />}
        {step === "stories" && <StoryStep />}
        {step === "cards" && <CardsStep />}
        {step === "compare" && <CompareStep />}
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-zinc-500">
        <p>
          ChatWrapped processes everything locally in your browser — no uploads, no accounts, no
          tracking. Independent project, not affiliated with WhatsApp, Meta or Telegram.
        </p>
      </footer>

      <PrivacyDialog />
      <div aria-live="polite" className="sr-only">
        {status === "analyzing"
          ? "Analyzing conversation"
          : status === "parsing"
            ? "Parsing conversation"
            : ""}
      </div>
    </div>
  );
}
