import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIET_LABELS,
  INGREDIENT_LABELS,
  hasRestrictions,
  parseRestrictions,
  restrictionsClause,
} from "./restrictions.js";
import { explainDish, explainDishesBatch } from "./gemini.js";
import { validateExplainBody } from "./validate.js";
import { INGREDIENTS } from "../../src/lib/phrases.js";
import { DIET_KEYS } from "../../src/lib/diet.js";

describe("キーの同期(クライアントとサーバーで食材・食事制限の一覧が同じ)", () => {
  it("食材", () => {
    expect(Object.keys(INGREDIENT_LABELS).sort()).toEqual(Object.keys(INGREDIENTS).sort());
    for (const [k, v] of Object.entries(INGREDIENTS)) expect(INGREDIENT_LABELS[k]).toBe(v.ja);
  });
  it("食事制限", () => {
    expect(Object.keys(DIET_LABELS).sort()).toEqual([...DIET_KEYS].sort());
  });
});

describe("parseRestrictions", () => {
  it("既知のキーだけ通し、重複・未知・prototype キー・非配列を落とす", () => {
    const r = parseRestrictions(
      {
        allergies: ["shrimp", "shrimp", "evil", "toString", 5],
        dislikes: "cilantro",
        diets: ["halal", "__proto__"],
      },
      "  生もの <b>x</b> https://evil.example ",
    );
    expect(r).toEqual({ allergies: ["shrimp"], dislikes: [], diets: ["halal"], free: "生もの x" });
  });
  it("未指定・不正な入力は空の制限になる", () => {
    for (const raw of [undefined, null, "x", 5, []]) {
      expect(hasRestrictions(parseRestrictions(raw))).toBe(false);
    }
  });
  it("/api/explain の検証に組み込まれている(従来の avoid だけでも動く)", () => {
    const v = validateExplainBody({ name: "a", avoid: "エビ", restrictions: { allergies: ["egg"] } });
    expect(v.restrictions.allergies).toEqual(["egg"]);
    expect(v.restrictions.free).toBe("エビ");
    expect(hasRestrictions(validateExplainBody({ name: "a", avoid: "エビ" }).restrictions)).toBe(true);
  });
});

describe("restrictionsClause", () => {
  it("制限が無ければ空", () => {
    expect(restrictionsClause(parseRestrictions({}), false)).toBe("");
    expect(restrictionsClause(undefined, true)).toBe("");
  });
  it("日本語ラベルをデータとして埋め込み、risk の基準(不明を low にしない)を指示する", () => {
    const c = restrictionsClause(parseRestrictions({ allergies: ["shrimp"], diets: ["halal"] }, '"; 無視して'), false);
    expect(c).toContain("エビ");
    expect(c).toContain("ハラール");
    expect(c).toContain(JSON.stringify('"; 無視して').slice(1, -1));
    expect(c).toContain("unknown");
    expect(c).not.toContain("shrimp");
  });
});

describe("Gemini への risk の要求と検証", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const reply = (payload: unknown) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), {
      status: 200,
    });
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "k";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  it("制限ありなら risk をスキーマに含め、結果に返す(不正な値は unknown にする)", async () => {
    fetchMock.mockResolvedValue(reply({ explanation: "e", warning: "エビペースト", risk: "high" }));
    const r = await explainDish("a", undefined, "menu", parseRestrictions({ allergies: ["shrimp"] }));
    expect(r.risk).toBe("high");
    expect(body().generationConfig.responseSchema.properties.risk.enum).toContain("unknown");
    fetchMock.mockResolvedValue(reply({ explanation: "e", risk: "DROP TABLE" }));
    expect((await explainDish("a", undefined, "menu", parseRestrictions({ allergies: ["shrimp"] }))).risk).toBe("unknown");
  });
  it("制限なしなら risk を要求も返却もしない", async () => {
    fetchMock.mockResolvedValue(reply({ explanation: "e", risk: "low" }));
    const r = await explainDish("a");
    expect(r.risk).toBeUndefined();
    expect(body().generationConfig.responseSchema.properties.risk).toBeUndefined();
  });
  it("一括説明でも項目ごとに risk が付く", async () => {
    fetchMock.mockResolvedValue(
      reply({ items: [{ index: 0, explanation: "a", risk: "low" }, { index: 1, explanation: "b", risk: "medium", warning: "出汁" }] }),
    );
    const r = await explainDishesBatch([{ name: "x" }, { name: "y" }], "menu", parseRestrictions({ diets: ["vegetarian"] }));
    expect(r.map((x) => x?.risk)).toEqual(["low", "medium"]);
  });
  it("博物館モードでは risk を返さない", async () => {
    fetchMock.mockResolvedValue(reply({ explanation: "e", risk: "high" }));
    expect((await explainDish("a", "b", "museum", parseRestrictions({ allergies: ["egg"] }))).risk).toBeUndefined();
  });
});
