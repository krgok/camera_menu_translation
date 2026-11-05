import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createClient = vi.fn((..._args: unknown[]) => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

import { consumeQuota, limitsFor, resetMemoryQuotaForTests } from "./quota.js";

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { status?: number }).status ?? "other";
  }
};

beforeEach(() => {
  rpc.mockReset();
  createClient.mockClear();
  resetMemoryQuotaForTests();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  delete process.env.QUOTA_SECRET;
  for (const k of Object.keys(process.env)) if (k.includes("DAILY_LIMIT")) delete process.env[k];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("limitsFor", () => {
  it("既定値と環境変数による上書き(不正値は既定に戻る)", () => {
    expect(limitsFor("analyze")).toEqual({ user: 40, global: 400 });
    process.env.DAILY_LIMIT_ANALYZE = "5";
    process.env.GLOBAL_DAILY_LIMIT_ANALYZE = "abc";
    expect(limitsFor("analyze")).toEqual({ user: 5, global: 400 });
  });
});

describe("DB クォータ(QUOTA_SECRET 設定時)", () => {
  beforeEach(() => {
    process.env.QUOTA_SECRET = "test-secret";
  });

  it("許可されたら通し、ユーザーのトークンと上限・秘密をRPCに渡す", async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    await expect(consumeQuota("u1", "tok", "explain")).resolves.toBeUndefined();
    expect(createClient.mock.calls[0][2]).toMatchObject({
      global: { headers: { Authorization: "Bearer tok" } },
    });
    expect(rpc).toHaveBeenCalledWith("menu_camera_consume_quota", {
      p_kind: "explain",
      p_user_limit: 150,
      p_global_limit: 1500,
      p_secret: "test-secret",
    });
  });

  it("上限到達は 429(ユーザー別/全体でメッセージが違う)", async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: false, scope: "user" }, error: null });
    expect(await status(consumeQuota("u1", "t", "analyze"))).toBe(429);
    rpc.mockResolvedValueOnce({ data: { allowed: false, scope: "global" }, error: null });
    await expect(consumeQuota("u1", "t", "analyze")).rejects.toThrow("サービス全体");
  });

  it("DBエラー・不正応答は拒否側(503)に倒れ、メモリ代替には落ちない", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await status(consumeQuota("u1", "t", "analyze"))).toBe(503);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "forbidden" } });
    expect(await status(consumeQuota("u1", "t", "analyze"))).toBe(503);
    rpc.mockResolvedValueOnce({ data: "garbage", error: null });
    expect(await status(consumeQuota("u1", "t", "analyze"))).toBe(503);
  });

  it("関数が未作成(マイグレーション未実行)ならメモリ代替で動く", async () => {
    process.env.DAILY_LIMIT_ANALYZE = "2";
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    await consumeQuota("u1", "t", "analyze");
    await consumeQuota("u1", "t", "analyze");
    expect(await status(consumeQuota("u1", "t", "analyze"))).toBe(429);
  });
});

describe("メモリ代替(QUOTA_SECRET 未設定)", () => {
  it("ユーザー・種別ごとに数え、上限で 429", async () => {
    process.env.DAILY_LIMIT_EXPLAIN_BATCH = "1";
    await consumeQuota("u1", "t", "explain_batch");
    expect(await status(consumeQuota("u1", "t", "explain_batch"))).toBe(429);
    await expect(consumeQuota("u2", "t", "explain_batch")).resolves.toBeUndefined();
    await expect(consumeQuota("u1", "t", "explain")).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
});
