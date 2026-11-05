import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_QTY,
  SURCHARGE_PRESETS,
  addLine,
  computeTotals,
  loadOrder,
  saveOrder,
  setQty,
  type OrderLine,
} from "./order";

const thb = { name: "パッタイ", unit: 60, currency: "THB", original: "ผัดไทย" };
const none = { servicePct: 0, vatPct: 0 };

describe("addLine / setQty", () => {
  it("同じ料理・同じ価格は数量が増え、価格違い(サイズ)は別行になる", () => {
    let l = addLine([], thb);
    l = addLine(l, thb);
    l = addLine(l, { ...thb, label: "L", unit: 80 });
    expect(l).toHaveLength(2);
    expect(l[0].qty).toBe(2);
    expect(l[1].label).toBe("L");
  });
  it("数量は99まで、0以下で削除、NaN も削除扱い", () => {
    let l = addLine([], thb);
    l = setQty(l, l[0].id, 500);
    expect(l[0].qty).toBe(MAX_QTY);
    expect(setQty(l, l[0].id, 0)).toEqual([]);
    expect(setQty(l, l[0].id, NaN)).toEqual([]);
    expect(setQty(l, l[0].id, 2.7)[0].qty).toBe(2);
  });
});

describe("computeTotals", () => {
  const lines = (...x: Omit<OrderLine, "id">[]): OrderLine[] => x.map((l, i) => ({ ...l, id: String(i) }));
  it("小計(単価×数量)", () => {
    const t = computeTotals(lines({ ...thb, qty: 2 }, { name: "x", unit: 35, currency: "THB", qty: 1 }), none);
    expect(t.byCurrency).toEqual([{ currency: "THB", subtotal: 155, service: 0, vat: 0, total: 155 }]);
  });
  it("サービス料は小計に、VAT は(小計+サービス料)にかかる", () => {
    const t = computeTotals(lines({ ...thb, qty: 10 }), SURCHARGE_PRESETS[2]);
    expect(t.byCurrency[0]).toEqual({ currency: "THB", subtotal: 600, service: 60, vat: 46.2, total: 706.2 });
  });
  it("通貨ごとに分けて集計し、価格なしの行は件数だけ数える", () => {
    const t = computeTotals(
      lines({ ...thb, qty: 1 }, { name: "y", unit: 5, currency: "USD", qty: 2 }, { name: "価格なし", qty: 3 }, { name: "z", unit: 9, qty: 1 }),
      none,
    );
    expect(t.byCurrency.map((c) => [c.currency, c.total])).toEqual([["THB", 60], ["USD", 10], ["", 9]]);
    expect(t.unpriced).toBe(1);
    expect(t.itemCount).toBe(7);
  });
  it("浮動小数点の誤差を丸める", () => {
    const t = computeTotals(lines({ name: "a", unit: 0.1, currency: "USD", qty: 3 }), none);
    expect(t.byCurrency[0].total).toBe(0.3);
  });
});

describe("保存と復元", () => {
  beforeEach(() => {
    const data: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("保存して読み戻せる", () => {
    const l = addLine([], thb);
    saveOrder(l, "vat7");
    const r = loadOrder();
    expect(r.presetId).toBe("vat7");
    expect(r.lines[0]).toMatchObject({ name: "パッタイ", unit: 60, currency: "THB", qty: 1 });
  });
  it("壊れた行・不正な値は落とし、数量や通貨を矯正する", () => {
    localStorage.setItem(
      "order-list",
      JSON.stringify([
        { id: "a", name: "ok", qty: 500, unit: 10, currency: "thb" },
        { id: "b", name: "qty0", qty: 0 },
        { id: 1, name: "badid", qty: 1 },
        null,
        { id: "c", name: "neg", qty: 1, unit: -5 },
      ]),
    );
    localStorage.setItem("order-surcharge", "evil");
    const r = loadOrder();
    expect(r.presetId).toBe("none");
    expect(r.lines.map((l) => l.id)).toEqual(["a", "c"]);
    expect(r.lines[0]).toMatchObject({ qty: 99, unit: 10, currency: undefined });
    expect(r.lines[1].unit).toBeUndefined();
  });
  it("壊れた JSON は空のリスト", () => {
    localStorage.setItem("order-list", "{oops");
    expect(loadOrder().lines).toEqual([]);
  });
});
