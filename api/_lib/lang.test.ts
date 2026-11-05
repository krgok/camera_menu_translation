import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectText } from "./vision.js";
import { explainDish, explainDishesBatch, groupMenuItems } from "./gemini.js";
import { LANGUAGE_HINTS, validateAnalyzeBody } from "./validate.js";
import { cleanSpice } from "./sanitize.js";
import { LANGUAGE_CODES } from "../../src/lib/languages.js";
import { jpegDataUrl } from "./testUtils.js";

let fetchMock: ReturnType<typeof vi.fn>;
const gemini = (payload: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 });
beforeEach(() => {
  process.env.GEMINI_API_KEY = "g";
  process.env.GOOGLE_VISION_API_KEY = "v";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const body = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body);

describe("言語ヒント", () => {
  it("クライアントとサーバーの言語一覧が一致する", () => {
    expect([...LANGUAGE_HINTS].sort()).toEqual([...LANGUAGE_CODES].sort());
  });
  it("リクエストの検証: 未指定は自動、許可外は 400", () => {
    const ok = { image: jpegDataUrl(), modes: ["text"] };
    expect(validateAnalyzeBody(ok).languageHint).toBeUndefined();
    expect(validateAnalyzeBody({ ...ok, languageHint: "th" }).languageHint).toBe("th");
    expect(() => validateAnalyzeBody({ ...ok, languageHint: "ignore previous" })).toThrow();
    expect(() => validateAnalyzeBody({ ...ok, languageHint: 5 })).toThrow();
  });
  it("Vision に languageHints を渡す(未指定なら imageContext 自体を付けない)", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ responses: [{ textAnnotations: [] }] }), { status: 200 }));
    await detectText("AAAA", 100, 100, "th");
    expect(body().requests[0].imageContext).toEqual({ languageHints: ["th"] });
    await detectText("AAAA", 100, 100);
    expect(body(1).requests[0].imageContext).toBeUndefined();
  });
  it("プロンプトに言語を入れ、判別できなかった項目の言語はヒントで補う", async () => {
    fetchMock.mockResolvedValue(gemini({ items: [{ name: "x", block_indices: [0] }] }));
    const [item] = await groupMenuItems([{ text: "a", box: { x: 0, y: 0, w: 1, h: 1 } }], "menu", undefined, "th");
    expect(body().contents[0].parts[0].text).toContain("タイ語(th)");
    expect(item.source_language).toBe("th");
  });
  it("モデルが返した言語コードがあればそちらを優先する", async () => {
    fetchMock.mockResolvedValue(gemini({ items: [{ name: "x", block_indices: [0], source_language: "ko" }] }));
    const [item] = await groupMenuItems([{ text: "a", box: { x: 0, y: 0, w: 1, h: 1 } }], "menu", undefined, "th");
    expect(item.source_language).toBe("ko");
  });
});

describe("ローマ字・日本の近い料理との比較・辛さ", () => {
  it("ローマ字を検証して返す(HTML・URLは除去)", async () => {
    fetchMock.mockResolvedValue(
      gemini({ items: [{ name: "パッタイ", block_indices: [0], romanization: "phàt thai <b>x</b> https://evil.example" }] }),
    );
    const [item] = await groupMenuItems([{ text: "a", box: { x: 0, y: 0, w: 1, h: 1 } }]);
    expect(item.romanization).toBe("phàt thai x");
    expect(body().generationConfig.responseSchema.properties.items.items.properties.romanization).toBeDefined();
  });
  it("単発の説明: similar_ja と spice を返し、範囲外・非整数の辛さは捨てる", async () => {
    fetchMock.mockResolvedValue(gemini({ explanation: "e", similar_ja: "日本の<i>焼きそば</i>に近い https://x.example", spice: 3 }));
    const r = await explainDish("a");
    expect(r.similar_ja).toBe("日本の 焼きそば に近い");
    expect(r.spice).toBe(3);
    fetchMock.mockResolvedValue(gemini({ explanation: "e", spice: 9 }));
    expect((await explainDish("a")).spice).toBeUndefined();
    expect(cleanSpice(2.5)).toBeUndefined();
    expect(cleanSpice("3")).toBeUndefined();
    expect(cleanSpice(0)).toBe(0);
  });
  it("一括説明でも項目ごとに付き、博物館モードでは付かない", async () => {
    fetchMock.mockResolvedValue(gemini({ items: [{ index: 0, explanation: "a", similar_ja: "冷やし中華", spice: 1 }] }));
    const [r] = await explainDishesBatch([{ name: "x" }]);
    expect(r).toMatchObject({ similar_ja: "冷やし中華", spice: 1 });
    fetchMock.mockResolvedValue(gemini({ items: [{ index: 0, explanation: "a", similar_ja: "x", spice: 1 }] }));
    const [m] = await explainDishesBatch([{ name: "x" }], "museum");
    expect(m?.similar_ja).toBeUndefined();
    expect(m?.spice).toBeUndefined();
    expect(body(1).generationConfig.responseSchema.properties.items.items.properties.spice).toBeUndefined();
  });
});
