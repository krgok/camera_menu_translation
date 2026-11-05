import { describe, expect, it, vi } from "vitest";
import { droppedNotice, insertSavedItem, isMissingColumn, missingColumnName, type SaveRow } from "./saveItem";

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
    expect(await insertSavedItem(c as never, row)).toEqual({ ok: true, dropped: [] });
  });
  it("旅行名つきで 006 未実行(列なし)なら、旅行名なしで再試行して保存する", async () => {
    const c = client([{ error: { code: "PGRST204", message: "Could not find the 'trip' column" } }, { error: null }]);
    const r = await insertSavedItem(c as never, { ...row, trip: "バンコク" });
    expect(r).toEqual({ ok: true, dropped: ["trip"] });
    expect(c.insert).toHaveBeenCalledTimes(2);
    expect((c.insert.mock.calls as unknown as [Record<string, unknown>][])[1][0]).not.toHaveProperty("trip");
  });
  it("ローマ字だけ(旅行名なし)で 007 未実行でも、ローマ字なしで保存でき、ローマ字だけ落としたと報告する", async () => {
    const c = client([{ error: { code: "PGRST204", message: "Could not find the 'romanization' column" } }, { error: null }]);
    const r = await insertSavedItem(c as never, { ...row, romanization: "phàt thai" });
    expect(r).toEqual({ ok: true, dropped: ["romanization"] });
    expect((c.insert.mock.calls as unknown as [Record<string, unknown>][])[1][0]).not.toHaveProperty("romanization");
  });
  it("旅行名もローマ字も無ければ再試行しない(他のエラーはそのまま返す)", async () => {
    const c = client([{ error: { code: "42501", message: "RLS" } }]);
    expect(await insertSavedItem(c as never, row)).toEqual({ ok: false, message: "RLS" });
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("列エラー以外(RLS 等)は旅行名ありでも再試行しない", async () => {
    const c = client([{ error: { code: "42501", message: "RLS" } }]);
    expect((await insertSavedItem(c as never, { ...row, trip: "t" })).ok).toBe(false);
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("romanization が無い行は、007 未実行でも 1 回目で保存できる(キー自体を送らない)", async () => {
    // A server without 007 would reject any payload carrying the romanization key.
    const insert = vi.fn(async (payload: Record<string, unknown>) =>
      "romanization" in payload
        ? { error: { code: "PGRST204", message: "Could not find the 'romanization' column of 'saved_items' in the schema cache" } }
        : { error: null },
    );
    const c = { from: vi.fn(() => ({ insert })) };
    expect(await insertSavedItem(c as never, row)).toEqual({ ok: true, dropped: [] });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).not.toHaveProperty("romanization");
  });
  it("旅行名とローマ字があり 007 だけ未実行なら、旅行名は保存される", async () => {
    const c = client([{ error: { code: "PGRST204", message: "Could not find the 'romanization' column of 'saved_items' in the schema cache" } }, { error: null }]);
    const r = await insertSavedItem(c as never, { ...row, trip: "バンコク", romanization: "phàt thai" });
    expect(r).toEqual({ ok: true, dropped: ["romanization"] });
    const second = (c.insert.mock.calls as unknown as [Record<string, unknown>][])[1][0];
    expect(second.trip).toBe("バンコク");
    expect(second).not.toHaveProperty("romanization");
  });
  it("両方未実行(006 も 007 も)なら両方落として保存する", async () => {
    const c = client([
      { error: { code: "PGRST204", message: "Could not find the 'trip' column of 'saved_items' in the schema cache" } },
      { error: { code: "PGRST204", message: "Could not find the 'romanization' column of 'saved_items' in the schema cache" } },
      { error: null },
    ]);
    const r = await insertSavedItem(c as never, { ...row, trip: "t", romanization: "r" });
    expect(r).toEqual({ ok: true, dropped: ["trip", "romanization"] });
    const last = (c.insert.mock.calls as unknown as [Record<string, unknown>][])[2][0];
    expect(last).not.toHaveProperty("trip");
    expect(last).not.toHaveProperty("romanization");
  });
  it("列名を読み取れない列エラーなら、任意列をすべて落として再試行する", async () => {
    const c = client([{ error: { code: "42703", message: "column does not exist" } }, { error: null }]);
    const r = await insertSavedItem(c as never, { ...row, trip: "t", romanization: "r" });
    expect(r).toEqual({ ok: true, dropped: ["trip", "romanization"] });
    expect(c.insert).toHaveBeenCalledTimes(2);
  });
  it("任意列以外の列が無いというエラーは再試行しない", async () => {
    const c = client([{ error: { code: "PGRST204", message: "Could not find the 'mode' column of 'saved_items' in the schema cache" } }]);
    const r = await insertSavedItem(c as never, { ...row, trip: "t", romanization: "r" });
    expect(r.ok).toBe(false);
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("無関係なエラー(RLS)は旅行名・ローマ字ありでも再試行しない", async () => {
    const c = client([{ error: { code: "42501", message: "RLS" } }]);
    expect(await insertSavedItem(c as never, { ...row, trip: "t", romanization: "r" })).toEqual({ ok: false, message: "RLS" });
    expect(c.insert).toHaveBeenCalledTimes(1);
  });
  it("missingColumnName / droppedNotice", () => {
    expect(missingColumnName({ message: "Could not find the 'romanization' column of 'saved_items' in the schema cache" })).toBe("romanization");
    expect(missingColumnName({ message: 'column "trip" of relation "saved_items" does not exist' })).toBe("trip");
    expect(missingColumnName({ message: "boom" })).toBeNull();
    expect(droppedNotice(["trip"])).toContain("006");
    expect(droppedNotice(["romanization"])).toContain("007");
    expect(droppedNotice(["romanization"])).not.toContain("006");
    expect(droppedNotice(["trip", "romanization"])).toMatch(/006.*007/);
  });
  it("isMissingColumn", () => {
    expect(isMissingColumn({ code: "42703", message: "" })).toBe(true);
    expect(isMissingColumn({ message: 'column "trip" of relation "saved_items" does not exist' })).toBe(true);
    expect(isMissingColumn(null)).toBe(false);
  });
});
