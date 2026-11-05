import { HttpError } from "./errors.js";
import {
  MAX_BATCH_ITEMS,
  MAX_BODY_BYTES,
  MAX_HINT_CHARS,
  MAX_IMAGE_BASE64_CHARS,
  MAX_IMAGE_DIMENSION,
  MAX_NAME_CHARS,
  MAX_ORIGINAL_CHARS,
  MIN_IMAGE_DIMENSION,
} from "./limits.js";
import { cleanText } from "./sanitize.js";
import { parseRestrictions } from "./restrictions.js";
import type { AppMode, RecognitionMode } from "../../src/lib/types";

const bad = (message: string, status = 400) => new HttpError(message, status);

/** Rejects oversized requests from the declared length, before the body is parsed. */
export function assertBodySize(contentLength: string | undefined): void {
  const n = Number(contentLength);
  if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
    throw bad("リクエストが大きすぎます", 413);
  }
}

function asObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw bad("リクエスト形式が不正です");
  }
  return body as Record<string, unknown>;
}

function parseAppMode(v: unknown): AppMode {
  if (v === undefined) return "menu";
  if (v === "menu" || v === "museum") return v;
  throw bad("appMode が不正です");
}

function optionalHint(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") throw bad(`${field} が不正です`);
  if (v.length > MAX_HINT_CHARS * 4) throw bad(`${field} が長すぎます`);
  return cleanText(v, MAX_HINT_CHARS);
}

/**
 * Decodes a `data:image/jpeg;base64,...` URL after cheap checks that run BEFORE
 * decoding: type, length cap, base64 alphabet. Then verifies the JPEG magic
 * bytes and reads the pixel dimensions from the header.
 */
export function parseJpegDataUrl(dataUrl: unknown): {
  base64: string;
  width: number;
  height: number;
} {
  if (typeof dataUrl !== "string") throw bad("画像データの形式が不正です");
  if (dataUrl.length > MAX_IMAGE_BASE64_CHARS + 64) {
    throw bad("画像が大きすぎます", 413);
  }
  const prefix = "data:image/jpeg;base64,";
  if (!dataUrl.startsWith(prefix)) {
    throw bad("画像はJPEG形式のみ対応しています");
  }
  const base64 = dataUrl.slice(prefix.length);
  if (base64.length === 0 || base64.length > MAX_IMAGE_BASE64_CHARS) {
    throw bad("画像が大きすぎます", 413);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw bad("画像データの形式が不正です");
  }
  const buffer = Buffer.from(base64, "base64");
  const { width, height } = readJpegSize(buffer);
  if (
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    throw bad(
      `画像の寸法が範囲外です(${MIN_IMAGE_DIMENSION}〜${MAX_IMAGE_DIMENSION}px)`,
    );
  }
  return { base64, width, height };
}

/** Minimal, bounds-checked JPEG SOF parser (no image library needed). */
export function readJpegSize(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw bad("JPEG画像ではありません");
  }
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) throw bad("JPEGの解析に失敗しました");
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > buffer.length) break;
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) throw bad("JPEGの解析に失敗しました");
    offset += 2 + length;
  }
  throw bad("画像サイズを取得できませんでした");
}

// Languages the user can pin for OCR (Vision languageHints). Mirrors src/lib/languages.ts.
export const LANGUAGE_HINTS = ["th", "zh", "ko", "vi", "ja", "en"] as const;

function parseLanguageHint(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "string" && (LANGUAGE_HINTS as readonly string[]).includes(v)) return v;
  throw bad("languageHint が不正です");
}

export function validateAnalyzeBody(body: unknown) {
  const b = asObject(body);
  const image = parseJpegDataUrl(b.image);

  if (!Array.isArray(b.modes) || b.modes.length === 0 || b.modes.length > 2) {
    throw bad("modes は必須です");
  }
  const modes = [...new Set(b.modes)] as RecognitionMode[];
  if (!modes.every((m) => m === "text" || m === "image")) {
    throw bad("modes が不正です");
  }
  return {
    image,
    modes,
    appMode: parseAppMode(b.appMode),
    contextHint: optionalHint(b.contextHint, "contextHint"),
    languageHint: parseLanguageHint(b.languageHint),
  };
}

function entry(raw: unknown) {
  const r = asObject(raw);
  const name = cleanText(r.name, MAX_NAME_CHARS);
  if (!name) throw bad("name は必須です");
  return {
    name,
    original_text: cleanText(r.original_text, MAX_ORIGINAL_CHARS, { allowUrls: true }),
  };
}

export function validateExplainBody(body: unknown) {
  const b = asObject(body);
  return {
    ...entry(b),
    appMode: parseAppMode(b.appMode),
    restrictions: parseRestrictions(b.restrictions, optionalHint(b.avoid, "avoid")),
  };
}

export function validateBatchBody(body: unknown) {
  const b = asObject(body);
  if (!Array.isArray(b.items) || b.items.length === 0) {
    throw bad("items は必須です");
  }
  if (b.items.length > MAX_BATCH_ITEMS) {
    throw bad(`一度に説明できるのは${MAX_BATCH_ITEMS}件までです`);
  }
  return {
    items: b.items.map(entry),
    appMode: parseAppMode(b.appMode),
    restrictions: parseRestrictions(b.restrictions, optionalHint(b.avoid, "avoid")),
  };
}
