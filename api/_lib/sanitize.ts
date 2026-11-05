import {
  MAX_RESULT_ITEMS,
  OUT_NAME_CHARS,
} from "./limits.js";
import type { MenuItem } from "../../src/lib/types";

// Control chars plus zero-width / bidi-override marks (ZWJ/ZWNJ are kept: Thai/Indic/Khmer need them).
const CONTROL_CHARS = /[\p{Cc}​‎‏‪-‮⁦-⁩]/gu;
const HTML_TAG = /<\/?[a-zA-Z!][^>]{0,200}>/g;
const URL_LIKE = /\b(?:https?|ftp|javascript|data):[^\s]*|\bwww\.[^\s]+/gi;

/**
 * Normalizes untrusted text (model output or user input): drops control /
 * bidi-override characters, HTML tags and URLs, collapses whitespace and
 * truncates. Returns undefined when nothing is left.
 * The UI renders text via React (escaped), so this is defense in depth for
 * exports, saved data and anything that might one day render differently.
 */
export function cleanText(
  value: unknown,
  max: number,
  opts: { allowUrls?: boolean } = {},
): string | undefined {
  if (typeof value !== "string") return undefined;
  let s = value.replace(CONTROL_CHARS, " ").replace(HTML_TAG, " ");
  if (!opts.allowUrls) s = s.replace(URL_LIKE, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max).trimEnd() : s;
}

export function cleanLanguage(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(value.trim())
    ? value.trim()
    : undefined;
}

export function cleanCurrency(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : undefined;
}

export function cleanPrice(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1e9
    ? value
    : undefined;
}

/** Clamps a normalized (0-1000) box; returns null for NaN/non-numeric input. */
export function cleanBox(value: unknown): MenuItem["box"] | null {
  if (typeof value !== "object" || value === null) return null;
  const b = value as Record<string, unknown>;
  const nums = [b.x, b.y, b.w, b.h];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
  const x = clamp(b.x as number, 0, 1000);
  const y = clamp(b.y as number, 0, 1000);
  return {
    x,
    y,
    w: clamp(b.w as number, 1, 1000 - x || 1),
    h: clamp(b.h as number, 1, 1000 - y || 1),
  };
}

export function cleanName(value: unknown): string | undefined {
  return cleanText(value, OUT_NAME_CHARS);
}

export function capItems<T>(items: T[]): T[] {
  return items.slice(0, MAX_RESULT_ITEMS);
}
