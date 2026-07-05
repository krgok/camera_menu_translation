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

export function boxToStyle(box: MenuItem["box"], rect: Rect) {
  return {
    left: rect.left + (box.x / 1000) * rect.width,
    top: rect.top + (box.y / 1000) * rect.height,
    width: (box.w / 1000) * rect.width,
    height: (box.h / 1000) * rect.height,
  };
}
