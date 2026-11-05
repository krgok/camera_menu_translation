import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeProfile,
  loadDietState,
  newProfile,
  saveDietState,
  summarizeRisks,
  toExplainRestrictions,
} from "./diet";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}
beforeEach(() => vi.stubGlobal("localStorage", fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("loadDietState / saveDietState", () => {
  it("初回は空(制限なし)", () => {
    expect(loadDietState()).toEqual({ profiles: [], activeId: null });
  });
  it("保存して読み戻せる", () => {
    const p = { ...newProfile("子ども"), allergies: ["egg" as const], diets: ["noSpicy" as const] };
    saveDietState({ profiles: [p], activeId: p.id });
    const s = loadDietState();
    expect(s.profiles[0]).toMatchObject({ name: "子ども", allergies: ["egg"], diets: ["noSpicy"] });
    expect(activeProfile(s)?.id).toBe(p.id);
  });
  it("旧バージョンの「苦手・アレルギー食材」の入力を「自分」プロファイルに引き継ぐ(旧キーは残す)", () => {
    const st = fakeStorage({ "avoid-ingredients": "エビ、パクチー" });
    vi.stubGlobal("localStorage", st);
    const s = loadDietState();
    expect(s.profiles).toHaveLength(1);
    expect(s.profiles[0]).toMatchObject({ name: "自分", free: "エビ、パクチー" });
    expect(s.activeId).toBe(s.profiles[0].id);
    expect(st.data["avoid-ingredients"]).toBe("エビ、パクチー");
    // 2回目以降は移行しない(プロファイルを消しても復活しない)
    saveDietState({ profiles: [], activeId: null });
    expect(loadDietState().profiles).toEqual([]);
  });
  it("壊れたデータ・不正なキーは落とす", () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({
        "diet-profiles": JSON.stringify([
          { id: "a", name: "x", allergies: ["egg", "evil", "toString"], dislikes: "no", diets: ["halal", 5], free: 9 },
          { name: "id無し" },
          null,
        ]),
        "diet-active": "a",
      }),
    );
    const s = loadDietState();
    expect(s.profiles).toHaveLength(1);
    expect(s.profiles[0]).toMatchObject({ allergies: ["egg"], dislikes: [], diets: ["halal"], free: "" });
    vi.stubGlobal("localStorage", fakeStorage({ "diet-profiles": "{broken" }));
    expect(loadDietState()).toEqual({ profiles: [], activeId: null });
  });
  it("存在しない activeId は無効(制限なし)になる", () => {
    vi.stubGlobal(
      "localStorage",
      fakeStorage({ "diet-profiles": JSON.stringify([newProfile("a")]), "diet-active": "gone" }),
    );
    expect(loadDietState().activeId).toBeNull();
  });
});

describe("toExplainRestrictions", () => {
  it("プロファイルなし・空のプロファイルは何も送らない", () => {
    expect(toExplainRestrictions(null)).toEqual({});
    expect(toExplainRestrictions(newProfile("x"))).toEqual({ avoid: undefined, restrictions: undefined });
  });
  it("アレルギー・食事制限・自由入力を送る", () => {
    const p = { ...newProfile("x"), allergies: ["shrimp" as const], diets: ["halal" as const], free: " 生もの " };
    expect(toExplainRestrictions(p)).toEqual({
      avoid: "生もの",
      restrictions: { allergies: ["shrimp"], dislikes: [], diets: ["halal"] },
    });
  });
});

describe("summarizeRisks", () => {
  it("risk 別に件数を数える(未取得は数えない)", () => {
    expect(summarizeRisks([{ risk: "high" }, { risk: "high" }, { risk: "low" }, {}])).toEqual({
      high: 2,
      medium: 0,
      unknown: 0,
      low: 1,
    });
  });
});
