import type { SavedItem } from "./supabase";

export type SortOrder = "newest" | "oldest" | "rating" | "name";

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: "新しい順",
  oldest: "古い順",
  rating: "評価順",
  name: "名前順",
};

/** Filter value meaning "items without a trip". */
export const NO_TRIP = "__none__";

export interface SavedFilter {
  query: string;
  /** "" = all trips, NO_TRIP = unassigned, otherwise an exact trip name. */
  trip: string;
  order: SortOrder;
}

export const RATING_LABEL: Record<number, string> = {
  1: "また食べたい",
  [-1]: "もういい",
};

function haystack(i: SavedItem): string {
  return [i.dish_name, i.original_text, i.explanation, i.note, i.trip]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function tripsOf(items: SavedItem[]): string[] {
  return [...new Set(items.map((i) => i.trip?.trim()).filter((t): t is string => !!t))].sort(
    (a, b) => a.localeCompare(b, "ja"),
  );
}

export function filterAndSort(items: SavedItem[], f: SavedFilter): SavedItem[] {
  const q = f.query.trim().toLowerCase();
  const out = items.filter((i) => {
    if (f.trip === NO_TRIP && i.trip?.trim()) return false;
    if (f.trip && f.trip !== NO_TRIP && i.trip?.trim() !== f.trip) return false;
    return !q || haystack(i).includes(q);
  });
  const time = (i: SavedItem) => Date.parse(i.created_at) || 0;
  switch (f.order) {
    case "oldest":
      return out.sort((a, b) => time(a) - time(b));
    case "rating":
      return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || time(b) - time(a));
    case "name":
      return out.sort((a, b) => a.dish_name.localeCompare(b.dish_name, "ja"));
    default:
      return out.sort((a, b) => time(b) - time(a));
  }
}

/** Collapses whitespace so a value can't break out of its Markdown line. */
function inline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Markdown album page for the given items (no images; text only). */
export function buildSavedMarkdown(items: SavedItem[], title: string, now = new Date()): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const lines = [`# ${inline(title)}`, "", `書き出し日: ${date} / ${items.length}件`, ""];
  items.forEach((i, n) => {
    lines.push(`## ${n + 1}. ${inline(i.dish_name)}`);
    if (i.original_text) {
      lines.push(
        `- 原文: ${inline(i.original_text)}${i.pronunciation ? ` [${inline(i.pronunciation)}]` : ""}`,
      );
    }
    if (i.trip) lines.push(`- 旅行: ${inline(i.trip)}`);
    if (i.rating && RATING_LABEL[i.rating]) lines.push(`- 評価: ${RATING_LABEL[i.rating]}`);
    lines.push(`- 説明: ${inline(i.explanation)}`);
    if (i.note) lines.push(`- メモ: ${inline(i.note)}`);
    lines.push("");
  });
  return lines.join("\n");
}
