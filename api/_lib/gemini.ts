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
    65000,
  );

  if (!res.ok) {
    throw new Error(`Gemini API エラー: ${res.status} ${await res.text()}`);
  }

  const data: any = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Geminiから応答を取得できませんでした");
  return JSON.parse(text);
}

/**
 * Groups OCR text blocks into menu items and asks Gemini for a translated
 * name + explanation. Gemini references blocks by index rather than
 * inventing coordinates, so the final bounding box is computed from the
 * (accurate) Vision OCR boxes rather than a Gemini-guessed position.
 */
export async function groupAndExplainText(
  blocks: OcrTextBlock[],
): Promise<MenuItem[]> {
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
              "同じメニュー項目を構成する断片をグループ化し、各項目について日本語の料理名・原文表記と、" +
              "現地の言葉が読めない旅行者がその料理を注文するか判断できるだけの説明を生成してください。" +
              "単語を訳すだけでなく、主な食材、調理法(揚げる/焼く/煮るなど)、味の特徴(辛さ・甘さなど)、" +
              "量や提供形態など、実際に食べたときのイメージが伝わる2〜3文の説明にしてください。" +
              "価格や無関係な文字は無視してください。\n\n" +
              JSON.stringify(indexed),
          },
        ],
      },
    ],
    generationConfig: {
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
                explanation: { type: "string" },
                block_indices: { type: "array", items: { type: "integer" } },
              },
              required: ["name", "explanation", "block_indices"],
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
      explanation: raw.explanation,
      box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      source: "text",
    });
  }
  return items;
}

/**
 * Sends the captured frame directly to Gemini Vision to identify dishes and
 * their approximate location. Coordinates are Gemini's own estimate
 * (normalized 0-1000), so this is less precise than the OCR-based flow.
 */
export async function analyzeDishImage(
  base64Image: string,
): Promise<MenuItem[]> {
  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          {
            text:
              "この画像に写っている料理を特定してください。各料理について、日本語の料理名と、" +
              "現地の言葉が読めない旅行者がその料理を注文するか判断できるだけの説明を生成してください。" +
              "見た目から推測できる主な食材、調理法(揚げる/焼く/煮るなど)、味の特徴(辛さ・甘さなど)を含めた" +
              "2〜3文の説明にしてください。あわせて、画像内でのおおよその位置を" +
              "0〜1000で正規化した矩形(x,y,w,h。左上原点)で返してください。",
          },
        ],
      },
    ],
    generationConfig: {
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
                explanation: { type: "string" },
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
              required: ["name", "explanation", "box"],
            },
          },
        },
        required: ["items"],
      },
    },
  });

  return (result.items ?? []).map((raw: any) => ({
    name: raw.name,
    explanation: raw.explanation,
    box: raw.box,
    source: "image" as const,
  }));
}
