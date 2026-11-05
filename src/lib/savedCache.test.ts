import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSavedCache, readSavedCache, writeSavedCache } from "./savedCache";
import type { SavedItem } from "./supabase";

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}
const item = (n: number, user = "u1") =>
  ({ id: String(n), user_id: user, dish_name: `d${n}`, explanation: "e" }) as SavedItem;

beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("savedCache", () => {
  it("書き込んだものを同じユーザーで読み戻せる", () => {
    writeSavedCache([item(1), item(2)]);
    expect(readSavedCache("u1")?.items.map((i) => i.id)).toEqual(["1", "2"]);
  });
  it("別のユーザーには見せない(共用端末)", () => {
    writeSavedCache([item(1)]);
    expect(readSavedCache("u2")).toBeNull();
    expect(readSavedCache(null)).toBeNull();
  });
  it("60件までに制限し、空配列では上書きしない", () => {
    writeSavedCache(Array.from({ length: 100 }, (_, i) => item(i)));
    expect(readSavedCache("u1")?.items).toHaveLength(60);
    writeSavedCache([]);
    expect(readSavedCache("u1")?.items).toHaveLength(60);
  });
  it("ログアウトで消える/壊れたデータや容量超過でも例外を出さない", () => {
    writeSavedCache([item(1)]);
    clearSavedCache();
    expect(readSavedCache("u1")).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => "{broken", setItem: () => { throw new Error("full"); }, removeItem: () => {} });
    expect(readSavedCache("u1")).toBeNull();
    expect(() => writeSavedCache([item(1)])).not.toThrow();
  });
});
