import { describe, expect, it } from "vitest";
import {
  BASIC_PHRASES,
  BASIC_PHRASE_ORDER,
  INGREDIENTS,
  PHRASE_LANGS,
  buildPhrase,
  isIngredientKey,
  toPhraseLang,
} from "./phrases";

describe("phrase data", () => {
  it("すべての言語・フレーズ・食材に文面がある(空欄なし)", () => {
    for (const { code } of PHRASE_LANGS) {
      for (const key of BASIC_PHRASE_ORDER) {
        expect(BASIC_PHRASES[key][code], `${key}/${code}`).toBeTruthy();
      }
      for (const [key, ing] of Object.entries(INGREDIENTS)) {
        expect(ing[code], `${key}/${code}`).toBeTruthy();
        expect(ing.ja).toBeTruthy();
      }
    }
  });
  it("表示順にすべての基本フレーズが含まれ、重複しない", () => {
    expect(new Set(BASIC_PHRASE_ORDER).size).toBe(Object.keys(BASIC_PHRASES).length);
  });
});

describe("buildPhrase", () => {
  it("基本フレーズ", () => {
    expect(buildPhrase("th", { kind: "basic", key: "noCilantro" })).toEqual({
      text: "ไม่ใส่ผักชี",
      ja: "パクチー抜きでお願いします",
    });
  });
  it("食材入りの質問とアレルギー申告にテンプレートが埋まる", () => {
    expect(buildPhrase("th", { kind: "contains", ingredient: "shrimp" }).text).toBe("อันนี้มีกุ้งไหม");
    expect(buildPhrase("zh", { kind: "allergic", ingredient: "peanut" }).text).toBe("我对花生过敏。");
    expect(buildPhrase("en", { kind: "allergic", ingredient: "shrimp" }).ja).toContain("エビ");
    for (const { code } of PHRASE_LANGS) {
      expect(buildPhrase(code, { kind: "contains", ingredient: "egg" }).text).not.toContain("{X}");
    }
  });
});

describe("言語コード", () => {
  it("zh-TW / TH などを基本言語に寄せ、未対応は null", () => {
    expect(toPhraseLang("zh-TW")).toBe("zh");
    expect(toPhraseLang("TH")).toBe("th");
    expect(toPhraseLang("fr")).toBeNull();
    expect(toPhraseLang(undefined)).toBeNull();
  });
  it("食材キーの検証(prototype キーを通さない)", () => {
    expect(isIngredientKey("shrimp")).toBe(true);
    expect(isIngredientKey("toString")).toBe(false);
    expect(isIngredientKey(5)).toBe(false);
  });
});
