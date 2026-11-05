import { describe, expect, it } from "vitest";
import { NO_TRIP, buildSavedMarkdown, filterAndSort, tripsOf } from "./saved";
import type { SavedItem } from "./supabase";

const item = (o: Partial<SavedItem> & { dish_name: string }): SavedItem =>
  ({ id: o.dish_name, user_id: "u", explanation: "説明", created_at: "2026-11-01T00:00:00Z", ...o }) as SavedItem;

const items = [
  item({ dish_name: "パッタイ", trip: "バンコク", rating: 1, created_at: "2026-11-02T00:00:00Z", note: "甘め" }),
  item({ dish_name: "トムヤムクン", trip: "バンコク", rating: -1, created_at: "2026-11-03T00:00:00Z" }),
  item({ dish_name: "カオマンガイ", trip: "チェンマイ", created_at: "2026-11-01T00:00:00Z", original_text: "ข้าวมันไก่" }),
  item({ dish_name: "春巻き", created_at: "2026-10-01T00:00:00Z" }),
];

describe("filterAndSort", () => {
  const base = { query: "", trip: "", order: "newest" as const };
  it("新しい順/古い順/名前順", () => {
    expect(filterAndSort(items, base).map((i) => i.dish_name)[0]).toBe("トムヤムクン");
    expect(filterAndSort(items, { ...base, order: "oldest" }).map((i) => i.dish_name)[0]).toBe("春巻き");
    expect(filterAndSort(items, { ...base, order: "name" }).map((i) => i.dish_name)).toEqual(
      [...items.map((i) => i.dish_name)].sort((a, b) => a.localeCompare(b, "ja")),
    );
  });
  it("評価順: また食べたい → 未評価 → もういい", () => {
    expect(filterAndSort(items, { ...base, order: "rating" }).map((i) => i.dish_name)).toEqual([
      "パッタイ",
      "カオマンガイ",
      "春巻き",
      "トムヤムクン",
    ]);
  });
  it("旅行で絞り込み(未分類も)", () => {
    expect(filterAndSort(items, { ...base, trip: "バンコク" })).toHaveLength(2);
    expect(filterAndSort(items, { ...base, trip: NO_TRIP }).map((i) => i.dish_name)).toEqual(["春巻き"]);
  });
  it("料理名・原文・メモ・旅行名・説明を横断検索(大文字小文字を区別しない)", () => {
    expect(filterAndSort(items, { ...base, query: "甘め" })).toHaveLength(1);
    expect(filterAndSort(items, { ...base, query: "ข้าว" })).toHaveLength(1);
    expect(filterAndSort(items, { ...base, query: "チェンマイ" })).toHaveLength(1);
    expect(filterAndSort(items, { ...base, query: "存在しない" })).toHaveLength(0);
  });
  it("元の配列を変更しない", () => {
    const copy = [...items];
    filterAndSort(items, { query: "", trip: "", order: "name" });
    expect(items).toEqual(copy);
  });
});

describe("tripsOf / buildSavedMarkdown", () => {
  it("旅行名の一覧(重複なし・空白は無視)", () => {
    expect(tripsOf([...items, item({ dish_name: "x", trip: "  " })])).toEqual(["チェンマイ", "バンコク"]);
  });
  it("Markdown に評価・メモを含め、改行で行が壊れない", () => {
    const md = buildSavedMarkdown(
      [item({ dish_name: "パッタイ\n# 偽の見出し", rating: 1, note: "a\nb", trip: "バンコク" })],
      "バンコク",
      new Date(2026, 10, 5),
    );
    expect(md).toContain("# バンコク");
    expect(md).toContain("書き出し日: 2026-11-05 / 1件");
    expect(md).toContain("## 1. パッタイ # 偽の見出し");
    expect(md).toContain("- 評価: また食べたい");
    expect(md).toContain("- メモ: a b");
    expect(md.split("\n").filter((l) => l.startsWith("# ")).length).toBe(1);
  });
});
