import { describe, expect, it } from "vitest";
import { orderPhraseFor } from "./orderPhrases";

describe("orderPhraseFor", () => {
  it("言語コードに対応するフレーズを返す", () => {
    expect(orderPhraseFor("th")).toMatchObject({ lang: "th", fallback: false });
  });
  it("地域付きコード(zh-TW)や大文字でも基本言語で引ける", () => {
    expect(orderPhraseFor("zh-TW").lang).toBe("zh");
    expect(orderPhraseFor("TH").lang).toBe("th");
  });
  it("未知・未指定の言語は英語にフォールバックする", () => {
    expect(orderPhraseFor("xx")).toMatchObject({ lang: "en", fallback: true });
    expect(orderPhraseFor(undefined).fallback).toBe(true);
    expect(orderPhraseFor(null).fallback).toBe(true);
  });
});
