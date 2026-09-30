import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorStatus, requireUser } from "./_lib/auth.js";
import { detectText } from "./_lib/vision.js";
import { groupMenuItems, identifyDishes } from "./_lib/gemini.js";
import type { AnalyzeRequest, MenuItem } from "../src/lib/types";

function parseDataUrl(dataUrl: string) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("画像データの形式が不正です");
  return match[2];
}

async function getImageSize(base64: string): Promise<{ w: number; h: number }> {
  const buffer = Buffer.from(base64, "base64");
  // Minimal JPEG SOF0 parser to avoid pulling in an image library.
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("JPEGの解析に失敗しました");
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
      const h = buffer.readUInt16BE(offset + 5);
      const w = buffer.readUInt16BE(offset + 7);
      return { w, h };
    }
    const length = buffer.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  throw new Error("画像サイズを取得できませんでした");
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s・、。,.()（）]/g, "");
}

function overlapRatio(a: MenuItem["box"], b: MenuItem["box"]): number {
  const ix = Math.max(
    0,
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
  );
  const iy = Math.max(
    0,
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  );
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
function dedupeItems(items: MenuItem[]): MenuItem[] {
  const textItems = items.filter((i) => i.source === "text");
  if (textItems.length === 0) return items;

  return items.filter((item) => {
    if (item.source !== "image") return true;
    const name = normalizeName(item.name);
    return !textItems.some(
      (t) =>
        normalizeName(t.name) === name || overlapRatio(item.box, t.box) > 0.6,
    );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireUser(req.headers.authorization);

    const { image, modes, appMode = "menu", contextHint } =
      req.body as AnalyzeRequest;
    if (!image || !modes || modes.length === 0) {
      res.status(400).json({ error: "image と modes は必須です" });
      return;
    }

    const base64 = parseDataUrl(image);

    const tasks: Promise<MenuItem[]>[] = [];
    if (modes.includes("text")) {
      tasks.push(
        getImageSize(base64)
          .then(({ w, h }) => detectText(base64, w, h))
          .then((blocks) => groupMenuItems(blocks, appMode, contextHint)),
      );
    }
    if (modes.includes("image")) {
      tasks.push(identifyDishes(base64, appMode, contextHint));
    }

    const settled = await Promise.allSettled(tasks);

    let items: MenuItem[] = [];
    const warnings: string[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "解析に失敗しました";
        warnings.push(message);
      }
    }

    items = dedupeItems(items);

    if (items.length === 0 && warnings.length > 0) {
      res.status(502).json({ error: warnings.join(" / ") });
      return;
    }

    res.status(200).json({ items, warnings: warnings.length ? warnings : undefined });
  } catch (e) {
    const message = e instanceof Error ? e.message : "解析に失敗しました";
    res.status(errorStatus(e)).json({ error: message });
  }
}
