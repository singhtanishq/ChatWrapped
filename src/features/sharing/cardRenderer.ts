/**
 * Canvas share-card renderer (Module E).
 *
 * Draws story slides as high-resolution cards at exact export dimensions.
 * The renderer reads theme tokens directly — no DOM — so exported PNGs match
 * the live story viewer. Fonts are awaited before drawing; emoji fall back
 * to the system emoji font.
 */

import type { StorySlide } from "../stories/generate";
import type { ThemeTokens } from "../themes/themes";

export const CARD_SIZES = {
  story: { width: 1080, height: 1920, label: "Story 9:16" },
  vertical: { width: 1080, height: 1920, label: "Vertical 9:16" },
  portrait: { width: 1080, height: 1350, label: "Portrait 4:5" },
  square: { width: 1080, height: 1080, label: "Square 1:1" },
  landscape: { width: 1200, height: 630, label: "Landscape 1.9:1" },
} as const;

export type CardSizeId = keyof typeof CARD_SIZES;

export interface CardRenderOptions {
  size: CardSizeId;
  theme: ThemeTokens;
  slide: StorySlide;
  attribution: boolean;
  caption: string | null;
  /** Overrides slide.title when set. */
  headline: string | null;
}

const DISPLAY = '"Space Grotesk Variable", "Inter Variable", sans-serif';
const SANS = '"Inter Variable", sans-serif';

/** Ensure webfonts are ready before canvas text operations. */
export async function ensureCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load('700 80px "Space Grotesk Variable"'),
    document.fonts.load('600 40px "Inter Variable"'),
    document.fonts.load('400 32px "Inter Variable"'),
  ]).catch(() => undefined);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDecor(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeTokens) {
  // Two blurred-feeling radial blobs using theme gradient stops.
  const blob = (cx: number, cy: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.globalAlpha = 1;
  };
  if (theme.dark) {
    blob(W * 0.85, H * 0.12, W * 0.55, theme.gradient[0], 0.75);
    blob(W * 0.1, H * 0.92, W * 0.6, theme.gradient[2], 0.65);
  } else {
    blob(W * 0.88, H * 0.08, W * 0.45, theme.gradient[0], 0.5);
    blob(W * 0.08, H * 0.95, W * 0.5, theme.gradient[2], 0.45);
  }

  switch (theme.decoration) {
    case "dots": {
      ctx.fillStyle = theme.dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
      const step = Math.max(20, W / 40);
      for (let x = step; x < W; x += step) {
        for (let y = step; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1.2, W / 800), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "grid": {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const step = Math.max(36, W / 28);
      for (let x = 0; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      break;
    }
    case "rings": {
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = Math.max(2, W / 300);
      const r = W * 0.42;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(W * 0.9, H * 0.12, r * i * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "stripes": {
      ctx.strokeStyle = theme.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
      ctx.lineWidth = Math.max(2, W / 400);
      const step = W / 22;
      for (let x = -H; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H, H);
        ctx.stroke();
      }
      break;
    }
    case "confetti": {
      const colors = [theme.accent, theme.accent2, theme.accent3];
      let seed = 7;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = 0; i < 42; i++) {
        ctx.fillStyle = colors[i % colors.length]!;
        ctx.globalAlpha = 0.7;
        const x = rnd() * W;
        const y = rnd() * H;
        const s = Math.max(3, W / 240);
        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rnd() * Math.PI);
          ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      break;
    }
    default:
      break;
  }
}

/** Draw the mini-visualizations that match the story viewer. */
function drawVisual(
  ctx: CanvasRenderingContext2D,
  slide: StorySlide,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: ThemeTokens,
) {
  const v = slide.visual;
  const palette = theme.chartPalette;
  switch (v.kind) {
    case "none":
      return;
    case "share": {
      const barH = Math.max(18, w * 0.022);
      let cx = x;
      for (const [i, p] of v.parts.entries()) {
        const pw = (w * p.pct) / 100;
        ctx.fillStyle = palette[i % palette.length]!;
        roundRect(ctx, cx, y, pw - 4, barH, barH / 2);
        ctx.fill();
        cx += pw;
        // legend
        const ly = y + barH + 30;
        const lx = x + (i % 2) * (w / 2);
        const row = Math.floor(i / 2) * 46;
        ctx.fillStyle = palette[i % palette.length]!;
        roundRect(ctx, lx, ly + row, 16, 16, 5);
        ctx.fill();
        ctx.fillStyle = theme.text;
        ctx.font = `500 ${Math.max(15, w / 55)}px ${SANS}`;
        ctx.textAlign = "left";
        ctx.fillText(`${p.label} — ${p.pct.toFixed(0)}%`, lx + 24, ly + row + 14);
      }
      return;
    }
    case "trend": {
      const max = Math.max(...v.points.map((p) => p.count), 1);
      const n = Math.max(v.points.length, 2);
      const pt = (i: number) => ({
        x: x + (w * i) / (n - 1),
        yy: y + h - (h * v.points[i]!.count) / max,
      });
      ctx.beginPath();
      v.points.forEach((_, i) => {
        const p = pt(i);
        if (i === 0) ctx.moveTo(p.x, p.yy);
        else ctx.lineTo(p.x, p.yy);
      });
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = Math.max(4, w / 200);
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = theme.accent;
      ctx.fill();
      ctx.globalAlpha = 1;
      // labels under first/last
      ctx.fillStyle = theme.textMuted;
      ctx.font = `400 ${Math.max(13, w / 60)}px ${SANS}`;
      ctx.textAlign = "left";
      ctx.fillText(v.points[0]!.label, x, y + h + 26);
      ctx.textAlign = "right";
      ctx.fillText(v.points[v.points.length - 1]!.label, x + w, y + h + 26);
      return;
    }
    case "hour": {
      // clock face
      const r = Math.min(h, w) * 0.36;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.strokeStyle = theme.textMuted;
      ctx.lineWidth = Math.max(3, w / 260);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // accent arc for share
      const frac = Math.min(1, v.share / 100);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = Math.max(8, w / 90);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      // hands
      const angle = (v.hour / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = Math.max(4, w / 180);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r * 0.55, cy + Math.sin(angle) * r * 0.55);
      ctx.stroke();
      return;
    }
    case "emoji": {
      ctx.font = `400 ${h * 0.62}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.emoji, x + w / 2, y + h * 0.42);
      const bw = w * 0.7;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      if (!theme.dark) ctx.fillStyle = "rgba(0,0,0,0.08)";
      roundRect(ctx, x + w * 0.15, y + h * 0.82, bw, Math.max(12, w * 0.02), w * 0.01);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      roundRect(
        ctx,
        x + w * 0.15,
        y + h * 0.82,
        Math.max(bw * (v.sharePct / 100), 20),
        Math.max(12, w * 0.02),
        w * 0.01,
      );
      ctx.fill();
      ctx.textBaseline = "alphabetic";
      return;
    }
    case "streak": {
      const total = Math.min(v.length, 42);
      const cols = Math.ceil(Math.sqrt(total));
      const cell = Math.min(w / (cols + 1), h / (Math.ceil(total / cols) + 1));
      const cellGap = cell * 0.25;
      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = 0.35 + 0.65 * (i / Math.max(total - 1, 1));
        roundRect(
          ctx,
          x + col * (cell + cellGap),
          y + row * (cell + cellGap),
          cell,
          cell,
          cell * 0.25,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    case "starts": {
      const max = Math.max(...v.rows.map((r) => r.count), 1);
      const rowH = Math.min(64, h / (v.rows.length + 1));
      v.rows.forEach((row, i) => {
        const yy = y + i * (rowH + 14);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        if (!theme.dark) ctx.fillStyle = "rgba(0,0,0,0.08)";
        roundRect(ctx, x, yy, w * 0.72, rowH * 0.62, rowH * 0.3);
        ctx.fill();
        ctx.fillStyle = theme.accent;
        roundRect(ctx, x, yy, Math.max((w * 0.72 * row.count) / max, 24), rowH * 0.62, rowH * 0.3);
        ctx.fill();
        ctx.fillStyle = theme.text;
        ctx.font = `600 ${Math.max(15, w / 48)}px ${SANS}`;
        ctx.textAlign = "left";
        ctx.fillText(`${row.label} · ${row.count}`, x + w * 0.74, yy + rowH * 0.42);
      });
      return;
    }
    case "response": {
      const blocks: Array<[string, string]> = [
        ["median", v.median],
        ["average", v.avg],
        ["fastest", v.fastest],
      ];
      const bw = (w - 2 * 24) / 3;
      blocks.forEach(([label, value], i) => {
        const bx = x + i * (bw + 24);
        ctx.fillStyle = theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
        roundRect(ctx, bx, y, bw, h * 0.62, Math.max(12, w * 0.03));
        ctx.fill();
        ctx.fillStyle = theme.textMuted;
        ctx.font = `500 ${Math.max(13, w / 62)}px ${SANS}`;
        ctx.textAlign = "center";
        ctx.fillText(label.toUpperCase(), bx + bw / 2, y + h * 0.22);
        ctx.fillStyle = i === 0 ? theme.accent : theme.text;
        ctx.font = `700 ${Math.max(22, w / 22)}px ${DISPLAY}`;
        ctx.fillText(value, bx + bw / 2, y + h * 0.46);
      });
      return;
    }
    case "day":
    case "burst": {
      // repeating dots for count
      const dots = Math.min(v.kind === "day" ? 24 : v.count, 24);
      const r = Math.max(6, w / 90);
      const perRow = Math.min(dots, 8);
      for (let i = 0; i < dots; i++) {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        ctx.fillStyle = theme.accent2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x + col * r * 3 + r * 2, y + row * r * 3 + r * 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    case "words": {
      const maxSize = Math.max(26, w / 14);
      v.words.forEach((wd, i) => {
        const size = Math.max(maxSize * Math.pow(0.78, i), 18);
        ctx.font = `700 ${size}px ${DISPLAY}`;
        ctx.fillStyle = i === 0 ? theme.accent : theme.text;
        ctx.globalAlpha = 1 - i * 0.13;
        ctx.fillText(`#${wd.word}`, x, y + size + i * size * 1.35);
      });
      ctx.globalAlpha = 1;
      return;
    }
  }
}

/** Render a slide onto a canvas at the exact requested pixel dimensions. */
export function renderCard(canvas: HTMLCanvasElement, options: CardRenderOptions): void {
  const { width: W, height: H } = CARD_SIZES[options.size];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const theme = options.theme;
  const center =
    theme.id === "editorial" || theme.id === "monochrome" || theme.id === "celebration";

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  drawDecor(ctx, W, H, theme);

  const pad = Math.round(W * 0.09);
  const contentW = W - 2 * pad;
  let y = Math.round(H * 0.1);

  // Kicker
  const kicker = options.slide.kicker;
  ctx.font = `600 ${Math.max(16, W / 52)}px ${SANS}`;
  ctx.fillStyle = theme.accent;
  ctx.textAlign = center ? "center" : "left";
  ctx.globalAlpha = 0.95;
  ctx.fillText(kicker.toUpperCase(), center ? W / 2 : pad, y);
  ctx.globalAlpha = 1;
  y += Math.round(W / 22);

  // Title (allow explicit line breaks)
  const titleText = options.headline ?? options.slide.title;
  const titleSize = Math.max(44, Math.round(W / (titleText.length > 26 ? 12.5 : 10.5)));
  ctx.font = `700 ${titleSize}px ${DISPLAY}`;
  ctx.fillStyle = theme.text;
  const titleLines = wrapText(ctx, titleText, contentW);
  for (const line of titleLines) {
    ctx.fillText(line, center ? W / 2 : pad, y + titleSize);
    y += titleSize * 1.14;
  }
  y += Math.round(W * 0.035);

  // Giant value
  const valueSize = Math.max(64, Math.round(W / (options.slide.value.length > 12 ? 8.5 : 6.2)));
  const valueGradient = ctx.createLinearGradient(0, y, W, y + valueSize);
  valueGradient.addColorStop(0, theme.accent);
  valueGradient.addColorStop(1, theme.accent2);
  ctx.font = `700 ${valueSize}px ${DISPLAY}`;
  ctx.fillStyle = valueGradient;
  const valueLines = wrapText(ctx, options.slide.value, contentW);
  for (const line of valueLines.slice(0, 4)) {
    ctx.fillText(line, center ? W / 2 : pad, y + valueSize);
    y += valueSize * 1.06;
  }
  y += Math.round(W * 0.03);

  // Detail
  if (options.slide.detail) {
    ctx.font = `400 ${Math.max(18, W / 44)}px ${SANS}`;
    ctx.fillStyle = theme.textMuted;
    const detailLines = wrapText(ctx, options.slide.detail, contentW);
    for (const line of detailLines.slice(0, 3)) {
      ctx.fillText(line, center ? W / 2 : pad, y + Math.max(24, W / 40));
      y += Math.max(34, W / 28);
    }
  }

  // Visual block in remaining space
  const visualTop = y + Math.round(W * 0.02);
  const visualBottom = H - Math.round(H * (options.caption ? 0.22 : 0.13));
  if (visualBottom > visualTop + 60) {
    drawVisual(ctx, options.slide, pad, visualTop, contentW, visualBottom - visualTop, theme);
  }

  // Caption
  let bottomY = H - Math.round(H * 0.055);
  if (options.caption) {
    ctx.font = `400 ${Math.max(17, W / 48)}px ${SANS}`;
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = "center";
    const capLines = wrapText(ctx, options.caption, contentW).slice(0, 3);
    let cy = H - Math.round(H * (options.attribution ? 0.115 : 0.075));
    for (const line of capLines) {
      ctx.fillText(line, W / 2, cy);
      cy += Math.max(26, W / 36);
    }
    bottomY = cy;
    ctx.textAlign = center ? "center" : "left";
  }

  // Attribution (subtle, removable)
  if (options.attribution) {
    ctx.font = `500 ${Math.max(14, W / 58)}px ${SANS}`;
    ctx.fillStyle = theme.textMuted;
    ctx.globalAlpha = 0.75;
    ctx.fillText("made with ChatWrapped", center ? W / 2 : pad, bottomY);
    ctx.globalAlpha = 1;
  }
}

/** Render and return a PNG blob for one card. */
export async function renderCardPng(options: CardRenderOptions): Promise<Blob> {
  await ensureCardFonts();
  const canvas = document.createElement("canvas");
  renderCard(canvas, options);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
      "image/png",
    );
  });
}

export function cardFileName(slide: StorySlide, theme: ThemeTokens, size: CardSizeId): string {
  const safe = slide.id.replace(/[^a-z0-9-]/gi, "-");
  return `chatwrapped-${theme.id}-${size}-${safe}.png`;
}
