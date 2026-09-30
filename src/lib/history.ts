import type { AppMode, MenuItem } from "./types";

export interface HistoryEntry {
  image: string;
  items: MenuItem[];
  timestamp: number;
  // Optional for backward compatibility with history entries saved before
  // museum mode existed — treat missing as "menu".
  appMode?: AppMode;
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

/**
 * Replaces the items of an existing entry (matched by timestamp). Used to
 * write lazily-fetched explanations back, so restoring a scan from history
 * doesn't lose them and re-bill the API.
 */
export function updateHistoryItems(timestamp: number, items: MenuItem[]) {
  try {
    const current = loadHistory();
    const index = current.findIndex((e) => e.timestamp === timestamp);
    if (index < 0) return;
    current[index] = { ...current[index], items };
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Same policy as pushHistory: history is best-effort.
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
