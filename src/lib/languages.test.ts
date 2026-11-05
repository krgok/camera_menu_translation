import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isLanguageHint, loadLanguageHint, saveLanguageHint } from "./languages";
import { explanationForSave } from "./exportText";

beforeEach(() => {
  const data: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("languages", () => {
  it("保存・復元でき、不正な値は自動(空)に戻る", () => {
    expect(loadLanguageHint()).toBe("");
    saveLanguageHint("th");
    expect(loadLanguageHint()).toBe("th");
    localStorage.setItem("language-hint", "klingon");
    expect(loadLanguageHint()).toBe("");
    expect(isLanguageHint("toString")).toBe(false);
  });
});

describe("explanationForSave", () => {
  it("説明に「日本でいうと」「辛さ」を追記する(DB の列を増やさないため)", () => {
    expect(
      explanationForSave({ name: "x", explanation: "麺料理", similar_ja: "そうめんに近い", spice: 2, box: { x: 0, y: 0, w: 1, h: 1 }, source: "text" }),
    ).toBe("麺料理\n日本でいうと: そうめんに近い\n辛さ: 2/4");
    expect(explanationForSave({ name: "x", explanation: "麺料理", spice: 0, box: { x: 0, y: 0, w: 1, h: 1 }, source: "text" })).toBe("麺料理\n辛さ: 0/4");
    expect(explanationForSave({ name: "x", explanation: "麺料理", box: { x: 0, y: 0, w: 1, h: 1 }, source: "text" })).toBe("麺料理");
  });
});
