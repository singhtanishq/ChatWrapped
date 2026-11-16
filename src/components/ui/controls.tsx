import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "./primitives";

/** Form controls and overlay primitives with accessible behavior. */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-zinc-400">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400",
          checked ? "border-transparent bg-fuchsia-500" : "border-white/20 bg-white/10",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full rounded-xl border border-white/15 bg-[#14121c] px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  label,
  placeholder,
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <label className={cx("block", className)}>
      {label ? (
        <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>
      ) : null}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
        {...rest}
      />
    </label>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: string }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("inline-flex rounded-xl border border-white/10 bg-white/5 p-1", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-fuchsia-400 sm:text-sm",
              selected
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                : "text-zinc-400 hover:text-white",
            )}
          >
            {o.icon ? (
              <span aria-hidden className="mr-1.5">
                {o.icon}
              </span>
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{ id: T; label: string; icon?: string }>;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={cx(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 sm:text-sm",
              selected ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t.icon ? <span aria-hidden>{t.icon}</span> : null}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  detail,
  indeterminate,
}: {
  value: number;
  max?: number;
  label: string;
  detail?: string;
  indeterminate?: boolean;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-white">{label}</p>
        {detail ? <p className="text-xs text-zinc-400">{detail}</p> : null}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : pct}
        className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
      >
        {indeterminate ? (
          <div className="animate-progress-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Content is mounted only on the client after first open: this keeps the
  // SSR output free of environment-dependent text (navigator.onLine etc.)
  // and prevents hydration mismatches.
  const [contentMounted, setContentMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    if (open) setContentMounted(true);
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[min(92vw,560px)] rounded-2xl border border-white/15 bg-[#14121c] p-0 text-white backdrop:bg-black/70",
        wide && "w-[min(94vw,860px)]",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 id={titleId} className="font-display text-lg font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-fuchsia-400"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
        {contentMounted ? children : null}
      </div>
    </dialog>
  );
}
