/** Formatting helpers shared by dashboard, stories and cards. */

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function formatMinutes(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Short month-year label, e.g. "Dec 2025". */
export function formatMonthYear(year: number, month0: number): string {
  return new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDay(year: number, month0: number, day: number): string {
  return new Date(Date.UTC(year, month0, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayShort(year: number, month0: number, day: number): string {
  return new Date(Date.UTC(year, month0, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

export function formatRange(fromY: number, fromM0: number, toY: number, toM0: number): string {
  const a = formatMonthYear(fromY, fromM0);
  const b = formatMonthYear(toY, toM0);
  return a === b ? a : `${a} – ${b}`;
}

/** Truncate long text with an ellipsis for titles/labels. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function plural(n: number, word: string, pluralWord?: string): string {
  return `${formatInt(n)} ${n === 1 ? word : (pluralWord ?? `${word}s`)}`;
}
