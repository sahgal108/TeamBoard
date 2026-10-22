/**
 * TeamBoard design system: the single source of truth for every visual value.
 *
 * - The Ant Design theme (lib/antd-theme.ts) is built from these tokens.
 * - Tailwind classes read them through CSS variables: cssVariables() below is rendered into
 *   <head> by app/layout.tsx, and app/globals.css maps Tailwind's theme onto those variables.
 * - Components import tokens from here. No raw hex, pixel or font-size literals elsewhere.
 *
 * Change a value here and it changes everywhere.
 */

// ---------- Color ----------

export const color = {
  brand: {
    primary: "#0b7a5c",
    primaryHover: "#065a44",
    primarySoft: "#e1f2ea",
  },
  neutral: {
    canvas: "#f3f6f4",
    surface: "#ffffff",
    surfaceHover: "#f7f9f8",
    text: "#17211d",
    textSecondary: "#4f5e58",
    textMuted: "#7d8b85",
    border: "#dbe3de",
    borderSubtle: "#ecf0ed",
    white: "#ffffff",
  },
  /** Dark navigation chrome (sidebar, sign-in hero). */
  sidebar: {
    background: "#0f1a16",
    backgroundActive: "#1a2924",
    border: "#22332d",
    text: "#c9d6d0",
    textMuted: "#7d8f88",
    textStrong: "#ffffff",
  },
  feedback: {
    success: "#0b7a5c",
    info: "#2563eb",
    warning: "#d97706",
    danger: "#dc2626",
  },
  taskStatus: {
    TODO: "#64748b",
    IN_PROGRESS: "#2563eb",
    IN_REVIEW: "#d97706",
    DONE: "#0b7a5c",
  },
  priority: {
    LOW: "#7d8b85",
    MEDIUM: "#2563eb",
    HIGH: "#ea580c",
    URGENT: "#dc2626",
  },
  /** People avatars; a name always maps to the same entry (see lib/format avatarColor). */
  avatar: ["#0b7a5c", "#1d4ed8", "#7c3aed", "#b45309", "#0e7490", "#be185d", "#4b5563", "#374151", "#15803d", "#9333ea"],
} as const;

// ---------- Typography ----------

export const font = {
  family: {
    sans: "var(--nf-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
    display: "var(--nf-display), 'IBM Plex Sans', system-ui, sans-serif",
    mono: "var(--nf-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  /** Pixel sizes. Body text is `base`; everything else steps from it. */
  size: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 16,
    xl: 18,
    "2xl": 24,
    "3xl": 30,
    display: 40,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    normal: "0",
    wide: "0.04em",
    caps: "0.06em",
  },
} as const;

/** Reusable text styles (React style objects) for the patterns that repeat across screens. */
export const textStyle = {
  /** Small supporting text: timestamps, hints, metadata. */
  caption: { fontSize: font.size.sm },
  /** Uppercase section label above a block of content. */
  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    textTransform: "uppercase",
    letterSpacing: font.letterSpacing.caps,
    color: color.neutral.textMuted,
  },
  /** Uppercase column heading on the board. */
  columnLabel: {
    fontSize: font.size.sm,
    textTransform: "uppercase",
    letterSpacing: font.letterSpacing.wide,
  },
} as const;

// ---------- Spacing (4px grid) ----------

export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
} as const;

// ---------- Shape ----------

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;

export const shadow = {
  card: "0 1px 2px rgba(23, 33, 29, 0.04)",
  raised: "0 8px 24px rgba(15, 26, 22, 0.12)",
} as const;

// ---------- Sizes ----------

/** Avatar diameters in px. */
export const avatarSize = {
  xs: 20,
  sm: 24,
  md: 28,
  lg: 44,
} as const;

export const layout = {
  sidebarWidth: 240,
  headerHeight: 56,
  /** Padding around every page's content. */
  pagePadding: space[7],
  /** Readable width for single-column pages (activity, search, settings). */
  contentMaxWidth: 960,
  /** Width of the right-hand column on two-column pages. */
  asideWidth: 400,
  searchWidth: 360,
  /** Width of a compact action column in tables (e.g. "Remove"). */
  actionColumnWidth: 96,
  progressColumnWidth: 200,
  modalWidth: 520,
  /** Sign-in page: headline column on the dark panel, and the form column. */
  heroTextMaxWidth: 460,
  authFormMaxWidth: 520,
  /** The short project-key input next to the project name. */
  keyFieldWidth: 120,
  /** Minimum height of a board column, so empty columns stay droppable. */
  boardColumnMinHeight: 200,
} as const;

export const zIndex = {
  header: 10,
} as const;

// ---------- CSS variables ----------

const px = (n: number) => `${n}px`;
/** taskStatus → task-status, IN_PROGRESS → in-progress. */
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();

/** Every token as a `--ds-*` custom property, for Tailwind (globals.css) and plain CSS. */
export function cssVariables(): string {
  const vars: [string, string][] = [];
  for (const [group, values] of Object.entries(color)) {
    if (Array.isArray(values)) values.forEach((v, i) => vars.push([`color-${group}-${i}`, v]));
    else for (const [k, v] of Object.entries(values)) vars.push([`color-${kebab(group)}-${kebab(k)}`, v]);
  }
  for (const [k, v] of Object.entries(font.family)) vars.push([`font-${k}`, v]);
  for (const [k, v] of Object.entries(font.size)) vars.push([`text-${k}`, px(v)]);
  for (const [k, v] of Object.entries(radius)) vars.push([`radius-${k}`, px(v)]);
  for (const [k, v] of Object.entries(shadow)) vars.push([`shadow-${k}`, v]);
  vars.push(["spacing", px(space[1])]);
  for (const [k, v] of Object.entries(layout)) vars.push([`layout-${kebab(k)}`, px(v)]);
  return `:root{${vars.map(([k, v]) => `--ds-${k}:${v}`).join(";")}}`;
}
