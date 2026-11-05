import type { SavedItem } from "./supabase";

/**
 * Last successfully loaded saved items, kept on this device so the saved list
 * can be shown offline. Cleared on sign-out (shared-device privacy). Capped
 * because thumbnails are data URLs and localStorage is small.
 */
const KEY = "saved-items-cache";
const MAX_ITEMS = 60;

interface Cached {
  userId: string;
  cachedAt: number;
  items: SavedItem[];
}

export function writeSavedCache(items: SavedItem[]): void {
  const first = items[0];
  if (!first) return;
  try {
    const value: Cached = {
      userId: first.user_id,
      cachedAt: Date.now(),
      items: items.slice(0, MAX_ITEMS),
    };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Quota exceeded: skip caching rather than break the list.
  }
}

/** Returns the cache only if it belongs to `userId`. */
export function readSavedCache(userId: string | null): Cached | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return parsed.userId === userId && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSavedCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
