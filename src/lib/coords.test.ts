import { describe, expect, it } from "vitest";
import { boxToStyle, containRect, safeBox } from "./coords";

describe("containRect", () => {
  it("横長の画像は幅いっぱいで上下に余白ができる", () => {
    expect(containRect(300, 400, 400, 200)).toEqual({
      left: 0,
      top: 125,
      width: 300,
      height: 150,
    });
  });

  it("縦長の画像は高さいっぱいで左右に余白ができる", () => {
    expect(containRect(400, 300, 200, 400)).toEqual({
      left: 125,
      top: 0,
      width: 150,
      height: 300,
    });
  });
});

describe("boxToStyle", () => {
  it("0-1000 の正規化座標を表示領域のピクセルへ変換する", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(
      boxToStyle({ x: 500, y: 500, w: 250, h: 100 }, rect),
    ).toEqual({ left: 110, top: 70, width: 50, height: 10 });
  });
});

describe("safeBox", () => {
  it("NaN・非数値・範囲外を安全な値に直す", () => {
    expect(safeBox({ x: NaN, y: -5, w: Infinity, h: 5000 })).toEqual({ x: 0, y: 0, w: 0, h: 1000 });
    expect(safeBox(undefined)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(safeBox({ x: 900, y: 0, w: 500, h: 10 })).toEqual({ x: 900, y: 0, w: 100, h: 10 });
  });
  it("boxToStyle は NaN を出力しない", () => {
    const s = boxToStyle({ x: NaN, y: NaN, w: NaN, h: NaN }, { left: 0, top: 0, width: 100, height: 100 });
    expect(Object.values(s).every(Number.isFinite)).toBe(true);
  });
});
