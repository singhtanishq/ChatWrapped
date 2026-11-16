import { useEffect, useState, type ReactNode } from "react";

/** Shared, accessible UI primitives for the ChatWrapped app chrome. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 " +
  "disabled:cursor-not-allowed disabled:opacity-50 select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-950/40 hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98]",
  secondary:
    "border border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 active:scale-[0.98]",
  ghost: "text-zinc-300 hover:bg-white/8 hover:text-white active:scale-[0.98]",
  danger: "border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    />
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm",
        padded && "p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
        {children}
      </h2>
      {sub ? <p className="mt-1 text-sm text-zinc-400">{sub}</p> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "accent" | "warn" | "danger" | "success";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-white/15 bg-white/5 text-zinc-300",
  accent: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
  warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  danger: "border-red-400/30 bg-red-500/10 text-red-200",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block size-5 animate-spin rounded-full border-2 border-white/20 border-t-fuchsia-400",
        className,
      )}
    />
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "accent";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{label}</p>
      <p
        className={cx(
          "font-display mt-2 text-3xl font-bold tracking-tight",
          tone === "accent"
            ? "bg-gradient-to-r from-fuchsia-300 to-orange-200 bg-clip-text text-transparent"
            : "text-white",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-zinc-400">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
      {icon ? (
        <div className="text-3xl" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      {description ? <p className="max-w-sm text-sm text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Two-step destructive-action button: first click arms, second click confirms. */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className,
  variant = "danger",
  size = "md",
  disabled,
}: {
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-sky-400/30 bg-sky-500/10 text-sky-100",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    error: "border-red-400/30 bg-red-500/10 text-red-100",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  } as const;
  const icons = { info: "ℹ️", warn: "⚠️", error: "✕", success: "✓" } as const;
  return (
    <div
      className={cx("flex gap-3 rounded-xl border p-4 text-sm", tones[tone])}
      role={tone === "error" ? "alert" : undefined}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {icons[tone]}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-[13px] leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
