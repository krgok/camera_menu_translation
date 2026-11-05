import { describe, expect, it } from "vitest";
import { formatPrice, formatYen, toYen } from "./currency";

// rates は「1円あたりの外貨量」(THB: 0.2 なら 1 THB = 5円)
const rates = { THB: 0.2, USD: 0.0067 };

describe("toYen", () => {
  it("外貨を円に換算する", () => {
    expect(toYen(40, "THB", rates)).toBeCloseTo(200);
  });
  it("通貨コードの大小文字を区別しない", () => {
    expect(toYen(40, "thb", rates)).toBeCloseTo(200);
  });
  it("JPY はそのまま返す", () => {
    expect(toYen(500, "JPY", rates)).toBe(500);
  });
  it("未知の通貨・レート無し・不正なレートは null", () => {
    expect(toYen(1, "XXX", rates)).toBeNull();
    expect(toYen(1, "THB", null)).toBeNull();
    expect(toYen(1, "THB", { THB: 0 })).toBeNull();
    expect(toYen(1, "THB", { THB: -1 })).toBeNull();
  });
});

describe("formatYen", () => {
  it("1000円未満は1円単位、以上は10円単位に丸める", () => {
    expect(formatYen(188.4)).toBe("約188円");
    expect(formatYen(1234)).toBe("約1,230円");
  });
});

describe("formatPrice", () => {
  it("換算できるときは円を併記する", () => {
    expect(formatPrice(40, "THB", rates)).toBe("40 THB(約200円)");
  });
  it("換算できないときは原価格のみ", () => {
    expect(formatPrice(40, "XXX", rates)).toBe("40 XXX");
    expect(formatPrice(40, undefined, rates)).toBe("40");
  });
  it("JPY は円併記しない", () => {
    expect(formatPrice(500, "JPY", rates)).toBe("500 JPY");
  });
});
