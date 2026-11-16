/**
 * Custom SVG chart components.
 *
 * Charts are deliberately hand-rolled (no chart library) so they can be
 * themed precisely, stay dependency-free, and share visual language with
 * the Canvas share-card renderer.
 */

export interface Series {
  label: string;
  values: number[];
  color: string;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const step = Math.ceil(max / base);
  const factor = step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10;
  return factor * base;
}

/** Area/line trend chart (e.g. monthly activity). */
export function AreaTrend({
  values,
  labels,
  color = "#e879f9",
  height = 180,
  showGrid = true,
}: {
  values: number[];
  labels: string[];
  color?: string;
  height?: number;
  showGrid?: boolean;
}) {
  const w = 640;
  const h = height;
  const pad = { top: 14, right: 8, bottom: 26, left: 40 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const max = niceMax(Math.max(...values, 1));
  const n = Math.max(values.length, 2);
  const x = (i: number) => pad.left + (iw * i) / (n - 1);
  const y = (v: number) => pad.top + ih - (ih * v) / max;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${(pad.top + ih).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + ih).toFixed(1)} Z`;
  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.ceil(labels.length / 8);
  const gid = `trend-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Activity trend chart"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {showGrid &&
        gridLines.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 4"
            />
            <text
              x={pad.left - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
            >
              {v}
            </text>
          </g>
        ))}
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={color} data-value={v} />
      ))}
      {labels.map((l, i) =>
        i % labelEvery === 0 || i === labels.length - 1 ? (
          <text
            key={i}
            x={x(i)}
            y={h - 8}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.45)"
          >
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Horizontal bars — participant distribution, weekday activity, top emoji. */
export function HBars({
  rows,
  maxValue,
  unit = "",
}: {
  rows: Array<{ label: string; value: number; color: string; sub?: string }>;
  maxValue?: number;
  unit?: string;
}) {
  const max = maxValue ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5" aria-label="Bar chart">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(72px,auto)_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate font-medium text-zinc-200" title={r.label}>
            {r.label}
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }}
            />
          </div>
          <span className="tabular-nums text-zinc-300">
            {r.value.toLocaleString()}
            {unit}
            {r.sub ? <span className="ml-1.5 text-xs text-zinc-500">{r.sub}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bar chart (e.g. hourly activity). */
export function VBars({
  values,
  labels,
  color = "#e879f9",
  height = 150,
  highlightIndex,
}: {
  values: number[];
  labels: string[];
  color?: string;
  height?: number;
  highlightIndex?: number;
}) {
  const w = 640;
  const h = height;
  const pad = { top: 8, right: 4, bottom: 22, left: 4 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const max = Math.max(...values, 1);
  const bw = iw / Math.max(values.length, 1);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Bar chart"
      preserveAspectRatio="xMidYMid meet"
    >
      {values.map((v, i) => {
        const bh = (ih * v) / max;
        const isHi = i === highlightIndex;
        return (
          <g key={i}>
            <rect
              x={pad.left + i * bw + bw * 0.12}
              y={pad.top + ih - bh}
              width={bw * 0.76}
              height={Math.max(bh, 1)}
              rx={3}
              fill={isHi ? color : "rgba(255,255,255,0.18)"}
            />
          </g>
        );
      })}
      {labels.map((l, i) =>
        l ? (
          <text
            key={`l${i}`}
            x={pad.left + i * bw + bw / 2}
            y={h - 6}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.45)"
          >
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Hour (0-23) × weekday heatmap. */
export function Heatmap({
  matrix,
  dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  hourLabels = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"],
  color = "#e879f9",
}: {
  matrix: number[][]; // [7][24]
  dayLabels?: string[];
  hourLabels?: string[];
  color?: string;
}) {
  const cell = 22;
  const gap = 2.5;
  const leftPad = 38;
  const topPad = 6;
  const w = leftPad + 24 * (cell + gap);
  const h = topPad + 7 * (cell + gap);
  const max = Math.max(...matrix.flat(), 1);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Hour by weekday activity heatmap"
      preserveAspectRatio="xMidYMid meet"
    >
      {matrix.map((row, d) =>
        row.map((v, hr) => {
          const t = v / max;
          return (
            <rect
              key={`${d}-${hr}`}
              x={leftPad + hr * (cell + gap)}
              y={topPad + d * (cell + gap)}
              width={cell}
              height={cell}
              rx={5}
              fill={v > 0 ? color : "rgba(255,255,255,0.07)"}
              opacity={v > 0 ? 0.18 + 0.82 * Math.cbrt(t) : 1}
            >
              <title>{`${dayLabels[d]} ${hr}:00 — ${v} messages`}</title>
            </rect>
          );
        }),
      )}
      {dayLabels.map((l, d) => (
        <text
          key={l}
          x={leftPad - 6}
          y={topPad + d * (cell + gap) + cell / 2 + 3.5}
          textAnchor="end"
          fontSize="10"
          fill="rgba(255,255,255,0.5)"
        >
          {l}
        </text>
      ))}
      {hourLabels.map((l) => {
        const hr =
          l.endsWith("a") || l.endsWith("p")
            ? (Number(l.replace(/[ap]/, "")) % 12) + (l.endsWith("p") ? 12 : 0)
            : 0;
        return (
          <text
            key={l}
            x={leftPad + hr * (cell + gap) + cell / 2}
            y={h + 2}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}

/** Stacked share bar + legend for participant distribution. */
export function ShareBar({
  parts,
}: {
  parts: Array<{ label: string; value: number; color: string; pct: number }>;
}) {
  return (
    <div>
      <div
        className="flex h-4 overflow-hidden rounded-full"
        role="img"
        aria-label="Participant message share"
      >
        {parts.map((p) => (
          <div
            key={p.label}
            style={{ width: `${p.pct}%`, background: p.color }}
            title={`${p.label}: ${p.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-zinc-300">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="font-medium text-zinc-200">{p.label}</span>
            <span className="tabular-nums text-zinc-400">{p.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
