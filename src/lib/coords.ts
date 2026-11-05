import type { MenuItem } from "./types";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Computes the rendered rect of an image inside a container when displayed
 * with `object-fit: contain`, so overlay boxes (normalized 0-1000 against the
 * source image) can be mapped to on-screen pixels without drift.
 */
export function containRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): Rect {
  const containerRatio = containerW / containerH;
  const imageRatio = imageW / imageH;

  if (imageRatio > containerRatio) {
    const width = containerW;
    const height = width / imageRatio;
    return { left: 0, top: (containerH - height) / 2, width, height };
  }
  const height = containerH;
  const width = height * imageRatio;
  return { left: (containerW - width) / 2, top: 0, width, height };
}

/**
 * Clamps a box to the 0-1000 range and replaces NaN/non-numbers, so a bad
 * value from the server, a restored history entry or an old save can never
 * produce `NaN px` styles or markers far off-screen.
 */
export function safeBox(box: Partial<MenuItem["box"]> | null | undefined): MenuItem["box"] {
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;
  const x = num(box?.x, 0, 1000, 0);
  const y = num(box?.y, 0, 1000, 0);
  return {
    x,
    y,
    w: num(box?.w, 0, 1000 - x, 0),
    h: num(box?.h, 0, 1000 - y, 0),
  };
}

export function boxToStyle(rawBox: MenuItem["box"], rect: Rect) {
  const box = safeBox(rawBox);
  return {
    left: rect.left + (box.x / 1000) * rect.width,
    top: rect.top + (box.y / 1000) * rect.height,
    width: (box.w / 1000) * rect.width,
    height: (box.h / 1000) * rect.height,
  };
}
