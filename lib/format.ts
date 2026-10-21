const DAY = 86_400_000;

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en", opts).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "just now", "4 min ago", "3 h ago", "Yesterday", "Sep 2". */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(diff / DAY);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return formatDate(iso);
}

export type DueTone = "overdue" | "soon" | "normal" | "none";

/** Due-date chip text and urgency, relative to today. */
export function dueLabel(iso: string | null, status: string, now = Date.now()): { text: string; tone: DueTone } {
  if (!iso) return { text: "No due date", tone: "none" };
  const due = new Date(iso);
  const days = Math.ceil((due.getTime() - now) / DAY);
  const text = formatDate(iso);
  if (status === "DONE") return { text, tone: "none" };
  if (days < 0) return { text: `${text} · ${-days}d overdue`, tone: "overdue" };
  if (days === 0) return { text: `${text} · today`, tone: "soon" };
  if (days <= 3) return { text: `${text} · in ${days}d`, tone: "soon" };
  return { text, tone: "normal" };
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Stable avatar color from a name. */
export function avatarColor(name: string): string {
  const palette = ["#0b7a5c", "#1d4ed8", "#7c3aed", "#b45309", "#0e7490", "#be185d", "#4b5563", "#374151", "#15803d", "#9333ea"];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
