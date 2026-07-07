import type { OcrTextBlock } from "./vision.js";
import type { MenuItem } from "../../src/lib/types";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

const MODEL = "gemini-2.5-flash";

async function callGemini(body: object) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    45000,
  );

  if (!res.ok) {
    throw new Error(`Gemini API エラー: ${res.status} ${await res.text()}`);
  }

  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Geminiから応答を取得できませんでした");
  return JSON.parse(text);
}

// thinkingBudget: 0 skips Gemini 2.5's default reasoning pass, which is the
// single biggest lever on latency for this app's short, low-ambiguity prompts.
const FAST_GENERATION_CONFIG = { thinkingConfig: { thinkingBudget: 0 } };

/**
 * Groups OCR text blocks into menu items and asks Gemini for translated
 * name + original text only (no explanation yet, to keep this first pass
 * fast). Gemini references blocks by index rather than inventing
 * coordinates, so the final bounding box is computed from the (accurate)
 * Vision OCR boxes rather than a Gemini-guessed position.
 */
export async function groupMenuItems(blocks: OcrTextBlock[]): Promise<MenuItem[]> {
  if (blocks.length === 0) return [];

  // Drop price/punctuation-only fragments before sending to Gemini: they're
  // numerous on real menus and inflate the prompt without adding items.
  const isPriceOrNoise = /^[\d.,:\-–—°$€¥£₹฿%\s]+$/;
  const indexed = blocks
    .map((b, i) => ({ index: i, text: b.text }))
    .filter(({ text }) => !isPriceOrNoise.test(text));

  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "以下はメニューをOCRで読み取った文字断片のリストです(index付き)。" +
              "同じメニュー項目を構成する断片をグループ化し、各項目について日本語の料理名・" +
              "原文表記・原文の言語(ISO 639-1コード、判別できなければ省略)を返してください。" +
              "説明文は不要です。価格や無関係な文字は無視してください。\n\n" +
              JSON.stringify(indexed),
          },
        ],
      },
    ],
    generationConfig: {
      ...FAST_GENERATION_CONFIG,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                original_text: { type: "string" },
                source_language: { type: "string" },
                block_indices: { type: "array", items: { type: "integer" } },
              },
              required: ["name", "block_indices"],
            },
          },
        },
        required: ["items"],
      },
    },
  });

  const items: MenuItem[] = [];
  for (const raw of result.items ?? []) {
    const usedBlocks = (raw.block_indices as number[])
      .map((i) => blocks[i])
      .filter(Boolean);
    if (usedBlocks.length === 0) continue;

    const minX = Math.min(...usedBlocks.map((b) => b.box.x));
    const minY = Math.min(...usedBlocks.map((b) => b.box.y));
    const maxX = Math.max(...usedBlocks.map((b) => b.box.x + b.box.w));
    const maxY = Math.max(...usedBlocks.map((b) => b.box.y + b.box.h));

    items.push({
      name: raw.name,
      original_text: raw.original_text,
      source_language: raw.source_language,
      box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      source: "text",
    });
  }
  return items;
}

/**
 * Sends the captured frame directly to Gemini Vision to identify dishes and
 * their approximate location, without an explanation yet (see
 * `explainDish`). Coordinates are Gemini's own estimate (normalized
 * 0-1000), so this is less precise than the OCR-based flow.
 */
export async function identifyDishes(base64Image: string): Promise<MenuItem[]> {
  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          {
            text:
              "この画像に写っている料理を特定してください。各料理について、日本語の料理名と、" +
              "画像内でのおおよその位置を0〜1000で正規化した矩形(x,y,w,h。左上原点)で返してください。" +
              "説明文は不要です。",
          },
        ],
      },
    ],
    generationConfig: {
      ...FAST_GENERATION_CONFIG,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                box: {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    w: { type: "number" },
                    h: { type: "number" },
                  },
                  required: ["x", "y", "w", "h"],
                },
              },
              required: ["name", "box"],
            },
          },
        },
        required: ["items"],
      },
    },
  });

  return (result.items ?? []).map((raw: any) => ({
    name: raw.name,
    box: raw.box,
    source: "image" as const,
  }));
}

/**
 * Fetched on demand when the user taps a menu item, so the initial scan
 * only pays for grouping/identification, not full explanations for every
 * item on the menu.
 */
export async function explainDish(
  name: string,
  originalText?: string,
): Promise<string> {
  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `料理名「${name}」` +
              (originalText ? `(原文表記: ${originalText})` : "") +
              "について、現地の言葉が読めない旅行者がその料理を注文するか判断できるだけの説明を生成してください。" +
              "単語を訳すだけでなく、主な食材、調理法(揚げる/焼く/煮るなど)、味の特徴(辛さ・甘さなど)、" +
              "量や提供形態など、実際に食べたときのイメージが伝わる2〜3文の日本語にしてください。",
          },
        ],
      },
    ],
    generationConfig: {
      ...FAST_GENERATION_CONFIG,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          explanation: { type: "string" },
        },
        required: ["explanation"],
      },
    },
  });

  return result.explanation as string;
}
