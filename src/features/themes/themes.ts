/**
 * ChatWrapped theme system.
 *
 * Themes are plain token objects — a single source of truth consumed by:
 *  - the story viewer (mapped to CSS custom properties at runtime)
 *  - the dashboard accent surfaces
 *  - the Canvas share-card renderer (reads tokens directly, no DOM)
 *
 * This guarantees a theme looks the same in the live viewer and in an
 * exported PNG.
 */

export type ThemeId =
  | "wrapped-neon"
  | "editorial"
  | "playful"
  | "midnight"
  | "retro"
  | "pastel"
  | "monochrome"
  | "minimal-dark"
  | "celebration";

export type Decoration = "blobs" | "grid" | "none" | "dots" | "rings" | "confetti" | "stripes";

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
  /** Base page background. */
  bg: string;
  /** Decorative gradient stops drawn behind content. */
  gradient: [string, string, string];
  /** Card / slide surface color. */
  surface: string;
  surfaceBorder: string;
  text: string;
  textMuted: string;
  /** Primary accent (headline highlights, bars). */
  accent: string;
  /** Secondary accent (gradients, secondary series). */
  accent2: string;
  /** Tertiary accent used sparingly. */
  accent3: string;
  /** Ordered palette for charts / multi-series. */
  chartPalette: string[];
  headingFamily: "display" | "sans";
  headingCase: "none" | "upper";
  letterSpacing: string;
  radiusPx: number;
  decoration: Decoration;
  /** Optional readable text color drawn on top of `accent` (e.g. buttons/badges). */
  onAccent: string;
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  "wrapped-neon": {
    id: "wrapped-neon",
    name: "Wrapped Neon",
    description: "Bold gradients and high contrast energy.",
    dark: true,
    bg: "#0e0618",
    gradient: ["#2e1065", "#0e0618", "#4c0d3c"],
    surface: "rgba(255,255,255,0.06)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    text: "#f5f0ff",
    textMuted: "rgba(245,240,255,0.62)",
    accent: "#e879f9",
    accent2: "#fb923c",
    accent3: "#818cf8",
    chartPalette: ["#e879f9", "#fb923c", "#818cf8", "#34d399", "#f43f5e", "#38bdf8"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.02em",
    radiusPx: 28,
    decoration: "blobs",
    onAccent: "#1b0430",
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Restrained typography, generous whitespace.",
    dark: false,
    bg: "#faf7f2",
    gradient: ["#efeadf", "#faf7f2", "#e7e1d4"],
    surface: "#ffffff",
    surfaceBorder: "rgba(23,20,15,0.12)",
    text: "#17140f",
    textMuted: "rgba(23,20,15,0.62)",
    accent: "#17140f",
    accent2: "#b45309",
    accent3: "#57534e",
    chartPalette: ["#17140f", "#b45309", "#57534e", "#78716c", "#a8a29e", "#d6d3d1"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.03em",
    radiusPx: 4,
    decoration: "none",
    onAccent: "#faf7f2",
  },
  playful: {
    id: "playful",
    name: "Playful",
    description: "Expressive colors and friendly shapes.",
    dark: false,
    bg: "#fdf4ff",
    gradient: ["#fce7f3", "#fdf4ff", "#e0f2fe"],
    surface: "#ffffff",
    surfaceBorder: "rgba(120,53,15,0.10)",
    text: "#3b0764",
    textMuted: "rgba(59,7,100,0.62)",
    accent: "#d946ef",
    accent2: "#f59e0b",
    accent3: "#0ea5e9",
    chartPalette: ["#d946ef", "#f59e0b", "#0ea5e9", "#10b981", "#f43f5e", "#8b5cf6"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.01em",
    radiusPx: 32,
    decoration: "dots",
    onAccent: "#ffffff",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "Deep blues with dramatic accents.",
    dark: true,
    bg: "#070b1a",
    gradient: ["#0c1a3d", "#070b1a", "#101f4a"],
    surface: "rgba(148,163,184,0.07)",
    surfaceBorder: "rgba(148,163,184,0.18)",
    text: "#e2e8f0",
    textMuted: "rgba(226,232,240,0.60)",
    accent: "#38bdf8",
    accent2: "#818cf8",
    accent3: "#2dd4bf",
    chartPalette: ["#38bdf8", "#818cf8", "#2dd4bf", "#a78bfa", "#f472b6", "#facc15"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.02em",
    radiusPx: 20,
    decoration: "grid",
    onAccent: "#04101f",
  },
  retro: {
    id: "retro",
    name: "Retro",
    description: "Nostalgic warm tones and rings.",
    dark: false,
    bg: "#f4e9d8",
    gradient: ["#efdbb8", "#f4e9d8", "#e8cf9f"],
    surface: "#fffaf0",
    surfaceBorder: "rgba(92,58,22,0.22)",
    text: "#43290d",
    textMuted: "rgba(67,41,13,0.66)",
    accent: "#c2410c",
    accent2: "#a16207",
    accent3: "#166534",
    chartPalette: ["#c2410c", "#a16207", "#166534", "#7c2d12", "#d97706", "#4d7c0f"],
    headingFamily: "display",
    headingCase: "upper",
    letterSpacing: "0.01em",
    radiusPx: 10,
    decoration: "rings",
    onAccent: "#fff7ed",
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    description: "Soft, approachable and light.",
    dark: false,
    bg: "#f0f9ff",
    gradient: ["#e0f2fe", "#f0f9ff", "#fae8ff"],
    surface: "#ffffff",
    surfaceBorder: "rgba(30,64,175,0.10)",
    text: "#1e3a5f",
    textMuted: "rgba(30,58,95,0.62)",
    accent: "#8b5cf6",
    accent2: "#f472b6",
    accent3: "#34d399",
    chartPalette: ["#8b5cf6", "#f472b6", "#34d399", "#60a5fa", "#fbbf24", "#c084fc"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.01em",
    radiusPx: 24,
    decoration: "dots",
    onAccent: "#ffffff",
  },
  monochrome: {
    id: "monochrome",
    name: "Monochrome",
    description: "High-contrast black and white.",
    dark: false,
    bg: "#ffffff",
    gradient: ["#f5f5f5", "#ffffff", "#e5e5e5"],
    surface: "#ffffff",
    surfaceBorder: "#171717",
    text: "#0a0a0a",
    textMuted: "rgba(10,10,10,0.60)",
    accent: "#0a0a0a",
    accent2: "#404040",
    accent3: "#737373",
    chartPalette: ["#0a0a0a", "#404040", "#737373", "#a3a3a3", "#d4d4d4", "#e5e5e5"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.03em",
    radiusPx: 2,
    decoration: "stripes",
    onAccent: "#ffffff",
  },
  "minimal-dark": {
    id: "minimal-dark",
    name: "Minimal Dark",
    description: "A restrained dark interface.",
    dark: true,
    bg: "#0c0c0f",
    gradient: ["#161619", "#0c0c0f", "#131317"],
    surface: "rgba(255,255,255,0.045)",
    surfaceBorder: "rgba(255,255,255,0.10)",
    text: "#ededf0",
    textMuted: "rgba(237,237,240,0.58)",
    accent: "#a1a1aa",
    accent2: "#e4e4e7",
    accent3: "#52525b",
    chartPalette: ["#e4e4e7", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a"],
    headingFamily: "sans",
    headingCase: "none",
    letterSpacing: "-0.01em",
    radiusPx: 12,
    decoration: "none",
    onAccent: "#0c0c0f",
  },
  celebration: {
    id: "celebration",
    name: "Celebration",
    description: "Festive treatment for milestone moments.",
    dark: true,
    bg: "#170b2e",
    gradient: ["#4a0d67", "#170b2e", "#7a1d3f"],
    surface: "rgba(255,255,255,0.07)",
    surfaceBorder: "rgba(255,255,255,0.16)",
    text: "#fff7ed",
    textMuted: "rgba(255,247,237,0.64)",
    accent: "#fbbf24",
    accent2: "#f43f5e",
    accent3: "#22d3ee",
    chartPalette: ["#fbbf24", "#f43f5e", "#22d3ee", "#a3e635", "#e879f9", "#fb923c"],
    headingFamily: "display",
    headingCase: "none",
    letterSpacing: "-0.01em",
    radiusPx: 28,
    decoration: "confetti",
    onAccent: "#2e0a02",
  },
};

export const THEME_LIST: ThemeTokens[] = Object.values(THEMES);

export const DEFAULT_THEME: ThemeId = "wrapped-neon";

export function isThemeId(value: string): value is ThemeId {
  return Object.prototype.hasOwnProperty.call(THEMES, value);
}

/** Convert theme tokens into CSS custom properties for a story/card surface. */
export function themeToCssVars(t: ThemeTokens): Record<string, string> {
  return {
    "--tw-bg": t.bg,
    "--tw-gradient-a": t.gradient[0],
    "--tw-gradient-b": t.gradient[1],
    "--tw-gradient-c": t.gradient[2],
    "--tw-surface": t.surface,
    "--tw-surface-border": t.surfaceBorder,
    "--tw-text": t.text,
    "--tw-text-muted": t.textMuted,
    "--tw-accent": t.accent,
    "--tw-accent-2": t.accent2,
    "--tw-accent-3": t.accent3,
    "--tw-radius": `${t.radiusPx}px`,
    "--tw-letter": t.letterSpacing,
  };
}
