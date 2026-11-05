/**
 * Reference links come from the server (Wikipedia search URLs) and are stored
 * in Supabase as JSON, so treat them as untrusted when rendering: only
 * https links to Wikipedia are made clickable (blocks `javascript:` etc.).
 */
export function safeReferenceUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    const ok = u.protocol === "https:" && /(^|\.)wikipedia\.org$/.test(u.hostname);
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Thumbnails are small JPEG data URLs made by cropThumbnail(); nothing else is rendered. */
export function safeThumbnailSrc(src: unknown): string | null {
  return typeof src === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src)
    ? src
    : null;
}
