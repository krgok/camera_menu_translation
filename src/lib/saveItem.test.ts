import { describe, expect, it, vi } from "vitest";
import { insertSavedItem, isMissingColumn, type SaveRow } from "./saveItem";

const row: SaveRow = {
  user_id: "u",
  dish_name: "x",
  original_text: null,
  pronunciation: null,
  explanation: "e",
  source_language: null,
  thumbnail_url: null,
  mode: "menu",
  reference_links: null,
};
function client(results: ({ error: { code?: string; message: string } | null })[]) {
  const insert = vi.fn(async () => results.shift()!);
  return { insert, from: vi.fn(() => ({ insert })) } as never as {
    insert: typeof insert;
    from: never;
  };
}

describe("insertSavedItem", () => {
  it("成功", async () => {
    const c = client([{ error: null }]);
    expect(await insertSavedItem(c as never, row)).toEqual({ ok: true, droppedTrip: false });
  });
  it("旅行名つきで 006 未実行(列なし)なら、旅行名なしで再試行して保存する", async () => {
    const c = client([{ error: { code: "PGRST204", message: "Could not find the 'trip' column" } }, { error: null }]);
    const r = await insertSavedItem(c as never, { ...row, trip: "バンコク" });
    expect(r).toEqual({ ok: true, droppedTrip: true });
    expect(c.insert).toHaveBeenCalledTimes(2);
    expect((c.insert.mock.calls as unknown as [Record<string, unknown>][])[1][0]).not.toHaveProperty("trip");
  });
  it("旅行名なしなら再試行しない(他のエラーはそのまま返す)", async () => {
    const c = client([{ error: { code: "42501", message: "RLS" } }]);
    expect(await insertSavedItem(c as never, row)).toEqual({ ok: false, message: "RLS" });
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("列エラー以外(RLS 等)は旅行名ありでも再試行しない", async () => {
    const c = client([{ error: { code: "42501", message: "RLS" } }]);
    expect((await insertSavedItem(c as never, { ...row, trip: "t" })).ok).toBe(false);
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("isMissingColumn", () => {
    expect(isMissingColumn({ code: "42703", message: "" })).toBe(true);
    expect(isMissingColumn({ message: 'column "trip" of relation "saved_items" does not exist' })).toBe(true);
    expect(isMissingColumn(null)).toBe(false);
  });
});
