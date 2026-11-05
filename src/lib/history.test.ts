import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadHistory, pushHistory } from "./history";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}
const entry = (ts: number) => ({
  image: "data:image/jpeg;base64,AAAA",
  items: [{ name: "x", box: { x: 0, y: 0, w: 1, h: 1 }, source: "text" }],
  timestamp: ts,
});

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("history", () => {
  it("直近5件だけ保持する", () => {
    for (let i = 0; i < 7; i++) pushHistory(entry(i) as never);
    const h = loadHistory();
    expect(h).toHaveLength(5);
    expect(h[0].timestamp).toBe(6);
  });
  it("壊れたJSON・配列でない値は空として扱う", () => {
    vi.stubGlobal("localStorage", fakeStorage({ "menu-camera-history": "{not json" }));
    expect(loadHistory()).toEqual([]);
    vi.stubGlobal("localStorage", fakeStorage({ "menu-camera-history": '{"a":1}' }));
    expect(loadHistory()).toEqual([]);
  });
  it("形式が不正なエントリは読み飛ばす", () => {
    const bad = [null, 5, { image: "javascript:x", items: [], timestamp: 1 }, { image: "data:image/jpeg;base64,A", items: "no", timestamp: 1 }, { image: "data:image/jpeg;base64,A", items: [{}], timestamp: 1 }, entry(9)];
    vi.stubGlobal("localStorage", fakeStorage({ "menu-camera-history": JSON.stringify(bad) }));
    expect(loadHistory().map((e) => e.timestamp)).toEqual([9]);
  });
  it("保存に失敗(容量超過)しても例外を投げない", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });
    expect(() => pushHistory(entry(1) as never)).not.toThrow();
  });
});
