import type { MenuItem } from "./types";

export interface HistoryEntry {
  image: string;
  items: MenuItem[];
  timestamp: number;
}

const KEY = "menu-camera-history";
const MAX_ENTRIES = 5;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry: HistoryEntry) {
  try {
    const current = loadHistory();
    const next = [entry, ...current].slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage unavailable — history is a convenience
    // feature, so fail silently rather than interrupting the scan flow.
  }
}
