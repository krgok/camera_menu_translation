import { describe, expect, it } from "vitest";
import { cleanBox, cleanCurrency, cleanLanguage, cleanPrice, cleanText } from "./sanitize.js";

describe("cleanText", () => {
  it("HTMLタグ・URL・制御文字を除去し空白を整える", () => {
    expect(cleanText('<img src=x onerror=alert(1)>辛い\u0000麺 https://evil.example/a?b=1 です', 100)).toBe(
      "辛い 麺 です",
    );
    expect(cleanText("javascript:alert(1) data:text/html;base64,AAA", 100)).toBeUndefined();
  });
  it("双方向制御文字を除去するがタイ語・クメール語の結合文字は残す", () => {
    expect(cleanText("a‮b", 10)).toBe("a b");
    expect(cleanText("ก‍ข", 10)).toBe("ก‍ข");
  });
  it("文字数で切り詰め、文字列以外・空は undefined", () => {
    expect(cleanText("あ".repeat(50), 10)).toHaveLength(10);
    expect(cleanText(42, 10)).toBeUndefined();
    expect(cleanText("   ", 10)).toBeUndefined();
  });
  it("allowUrls で原文中のURLは保持できる", () => {
    expect(cleanText("WiFi www.shop.example", 50, { allowUrls: true })).toBe("WiFi www.shop.example");
  });
});

describe("cleanBox", () => {
  it("範囲外を 0-1000 に収める", () => {
    expect(cleanBox({ x: -50, y: 990, w: 5000, h: 5000 })).toEqual({ x: 0, y: 990, w: 1000, h: 10 });
  });
  it("NaN / Infinity / 非数値 / 非オブジェクトは null", () => {
    expect(cleanBox({ x: NaN, y: 0, w: 1, h: 1 })).toBeNull();
    expect(cleanBox({ x: 0, y: 0, w: Infinity, h: 1 })).toBeNull();
    expect(cleanBox({ x: "1", y: 0, w: 1, h: 1 })).toBeNull();
    expect(cleanBox(null)).toBeNull();
  });
  it("幅・高さ0は最小1に補正される", () => {
    expect(cleanBox({ x: 1000, y: 1000, w: 0, h: 0 })).toEqual({ x: 1000, y: 1000, w: 1, h: 1 });
  });
});

describe("フィールド検証", () => {
  it("言語コード", () => {
    expect(cleanLanguage("th")).toBe("th");
    expect(cleanLanguage("zh-TW")).toBe("zh-TW");
    expect(cleanLanguage("<script>")).toBeUndefined();
    expect(cleanLanguage("ignore previous instructions")).toBeUndefined();
  });
  it("通貨コード", () => {
    expect(cleanCurrency(" thb ")).toBe("THB");
    expect(cleanCurrency("baht")).toBeUndefined();
  });
  it("価格", () => {
    expect(cleanPrice(40)).toBe(40);
    for (const bad of [0, -1, NaN, Infinity, 1e12, "40"]) expect(cleanPrice(bad)).toBeUndefined();
  });
});
