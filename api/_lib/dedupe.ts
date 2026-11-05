import type { MenuItem } from "../../src/lib/types";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s・、。,.()（）]/g, "");
}

function overlapRatio(a: MenuItem["box"], b: MenuItem["box"]): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  const minArea = Math.min(a.w * a.h, b.w * b.h);
  return minArea > 0 ? intersection / minArea : 0;
}

/**
 * When text and image modes run together on a photo menu, the same dish
 * often comes back twice (once from OCR grouping, once from Gemini vision).
 * Text-sourced items win — their names come from the printed menu and their
 * boxes from OCR — so drop image items that clearly duplicate one: same
 * normalized name, or a heavily overlapping region.
 */
export function dedupeItems(items: MenuItem[]): MenuItem[] {
  const textItems = items.filter((i) => i.source === "text");
  if (textItems.length === 0) return items;

  return items.filter((item) => {
    if (item.source !== "image") return true;
    const name = normalizeName(item.name);
    return !textItems.some(
      (t) => normalizeName(t.name) === name || overlapRatio(item.box, t.box) > 0.6,
    );
  });
}
