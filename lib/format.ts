// Small presentation helpers shared by server and client components.

import type { CSSProperties } from "react";

/** Split a comma-separated label string into trimmed, non-empty labels. */
export function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Inline style for a label badge, tinted by the label's remembered hue. */
export function labelStyle(hue: number | undefined): CSSProperties | undefined {
  if (hue == null) return undefined;
  return {
    background: `hsl(${hue} 55% 24%)`,
    color: `hsl(${hue} 85% 84%)`,
  };
}

/** Inline style for an inactive filter chip, tinted by the label's hue. */
export function labelChipStyle(
  hue: number | undefined,
): CSSProperties | undefined {
  if (hue == null) return undefined;
  return {
    color: `hsl(${hue} 80% 78%)`,
    borderColor: `hsl(${hue} 45% 42%)`,
  };
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function dispatchNo(id: number): string {
  return "No. " + String(id).padStart(3, "0");
}

/** "28 JUN 2026" in UTC. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Plain-text excerpt from rendered HTML, for the lead dispatch. */
export function excerptFromHtml(html: string, max = 180): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

const MONTHS_NICE = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "28 Jun 2026" (sentence case). */
export function formatDateNice(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_NICE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Relative time for a feed: "just now", "5m ago", "2h ago", "3d ago", else date. */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateNice(iso);
}

/** Day key (UTC) used to group feed items. */
export function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** "Today" / "Yesterday" / "28 Jun 2026" for feed date dividers. */
export function dayLabel(iso: string): string {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const k = dayKey(iso);
  if (k === today.toISOString().slice(0, 10)) return "Today";
  if (k === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return formatDateNice(iso);
}

/** How long a post counts as "New" (10 hours). */
export const RECENT_WINDOW_MS = 36_000_000;

/** Published within the last 10h. */
export function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < RECENT_WINDOW_MS;
}

/** "28 JUN 2026 · 14:12 UTC". */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)} · ${hh}:${mm} UTC`;
}
