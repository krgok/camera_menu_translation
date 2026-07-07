import type { OcrTextBlock } from "./vision.js";
import type { AppMode, MenuItem, Reference } from "../../src/lib/types";
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
export async function groupMenuItems(
  blocks: OcrTextBlock[],
  appMode: AppMode = "menu",
): Promise<MenuItem[]> {
  if (blocks.length === 0) return [];

  // Drop price/punctuation-only fragments before sending to Gemini: they're
  // numerous on real menus and inflate the prompt without adding items.
  // Museum mode keeps them — bare numbers are often years/dates that matter
  // for exhibit labels.
  const isPriceOrNoise = /^[\d.,:\-–—°$€¥£₹฿%\s]+$/;
  const indexed = blocks
    .map((b, i) => ({ index: i, text: b.text }))
    .filter(({ text }) => appMode === "museum" || !isPriceOrNoise.test(text));

  const prompt =
    appMode === "museum"
      ? "以下は博物館・美術館・観光地の展示物や解説パネル・案内板をOCRで読み取った文字断片のリストです(index付き)。" +
        "同じ展示物・作品・解説を構成する断片をグループ化し、各項目について日本語での名称(作品名・展示物名。" +
        "日本語訳が自然なら訳し、固有名詞はカタカナ表記)・原文表記・原文の言語(ISO 639-1コード、判別できなければ省略)・" +
        "名称の発音記号(IPA。現地語で読み上げる助けになるように)を返してください。" +
        "説明文は不要です。整理番号など意味を持たない文字は無視してください。\n\n" +
        JSON.stringify(indexed)
      : "以下はメニューをOCRで読み取った文字断片のリストです(index付き)。" +
        "同じメニュー項目を構成する断片をグループ化し、各項目について日本語の料理名・" +
        "原文表記・原文の言語(ISO 639-1コード、判別できなければ省略)・" +
        "原文表記の発音記号(IPA。注文時に声に出して読む助けになるように)を返してください。" +
        "説明文は不要です。価格や無関係な文字は無視してください。\n\n" +
        JSON.stringify(indexed);

  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
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
                pronunciation: { type: "string" },
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
      pronunciation: raw.pronunciation,
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
export async function identifyDishes(
  base64Image: string,
  appMode: AppMode = "menu",
): Promise<MenuItem[]> {
  const prompt =
    appMode === "museum"
      ? "この画像は博物館・美術館・観光地で撮影されたものです。写っている展示物・美術品・工芸品・" +
        "建造物・記念碑などの対象を特定してください。各対象について、日本語での名称" +
        "(特定できる場合は固有名、できない場合は「〜時代の陶器」のような具体的な種別)と、" +
        "画像内でのおおよその位置を0〜1000で正規化した矩形(x,y,w,h。左上原点)で返してください。" +
        "説明文は不要です。展示ケースや照明など展示物以外は含めないでください。"
      : "この画像に写っている料理を特定してください。各料理について、日本語の料理名と、" +
        "画像内でのおおよその位置を0〜1000で正規化した矩形(x,y,w,h。左上原点)で返してください。" +
        "説明文は不要です。";

  const result = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt },
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
 *
 * Museum mode returns a summarized explanation (background/significance,
 * not a literal translation) plus Wikipedia article titles. URLs are built
 * here as Wikipedia search links so they always resolve — Gemini-invented
 * direct URLs frequently 404.
 */
export async function explainDish(
  name: string,
  originalText?: string,
  appMode: AppMode = "menu",
): Promise<{ explanation: string; references?: Reference[] }> {
  if (appMode === "museum") {
    const result = await callGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `博物館・美術館・観光地の展示対象「${name}」` +
                (originalText
                  ? `について、現地で読み取った解説文・ラベルの原文は次の通りです:\n「${originalText}」\n`
                  : "について、") +
                "現地の言語や歴史背景を知らない訪問者向けに、日本語で内容を要約して説明してください。" +
                "原文の逐語訳ではなく、それが何であるか、いつ・誰が・なぜ作った(起きた)のか、" +
                "歴史的・文化的にどんな意義があるのかが3〜5文で伝わるようにしてください。" +
                "確実でないことは断定せず「〜とされる」のように書いてください。" +
                "あわせて、より深く知りたい人のためにWikipediaで調べるのに適した記事名を" +
                "0〜3個、関連が深い順に返してください(関連記事が思い当たらなければ空配列)。",
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
            reference_titles: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["explanation"],
        },
      },
    });

    const references: Reference[] = ((result.reference_titles as string[]) ?? [])
      .filter((t) => typeof t === "string" && t.trim().length > 0)
      .slice(0, 3)
      .map((title) => ({
        title,
        url: `https://ja.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title)}&go=Go`,
      }));

    return {
      explanation: result.explanation as string,
      references: references.length > 0 ? references : undefined,
    };
  }

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

  return { explanation: result.explanation as string };
}
