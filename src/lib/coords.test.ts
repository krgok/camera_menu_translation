import { describe, expect, it } from "vitest";
import { boxToStyle, containRect } from "./coords";

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
