import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser } }),
}));

import { assertUserAllowed, precheckToken, requireUser } from "./auth.js";
import { HttpError } from "./errors.js";

function jwt(claims: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256" })}.${enc(claims)}.sig`;
}
const NOW = 1_800_000_000;
const goodClaims = { exp: NOW + 3600, aud: "authenticated", sub: "u1" };
const statusOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? e.status : "other";
  }
  return "no-error";
};

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  delete process.env.ALLOWED_EMAILS;
  getUser.mockReset();
});
afterEach(() => {
  delete process.env.ALLOWED_EMAILS;
});

describe("precheckToken(署名は検証しない簡易チェック)", () => {
  it("正常なエンベロープは通す", () => {
    expect(statusOf(() => precheckToken(jwt(goodClaims), NOW))).toBe("no-error");
  });
  it("形式不正・期限切れ・aud 違いは 401", () => {
    expect(statusOf(() => precheckToken("garbage", NOW))).toBe(401);
    expect(statusOf(() => precheckToken(jwt({ ...goodClaims, exp: NOW - 1 }), NOW))).toBe(401);
    expect(statusOf(() => precheckToken(jwt({ aud: "authenticated" }), NOW))).toBe(401);
    expect(statusOf(() => precheckToken(jwt({ ...goodClaims, aud: "anon" }), NOW))).toBe(401);
    expect(statusOf(() => precheckToken("a.@@@.c", NOW))).toBe(401);
  });
});

describe("assertUserAllowed", () => {
  const user = { email: "a@example.com", email_confirmed_at: "2026-01-01", is_anonymous: false };
  it("許可リスト未設定なら(匿名でない)全員可", () => {
    expect(statusOf(() => assertUserAllowed(user))).toBe("no-error");
  });
  it("匿名ユーザーは常に拒否", () => {
    expect(statusOf(() => assertUserAllowed({ ...user, is_anonymous: true }))).toBe(401);
  });
  it("許可リスト設定時: 一致(大小文字無視)のみ可、未確認メール・リスト外は 403", () => {
    process.env.ALLOWED_EMAILS = " A@Example.com , b@example.com";
    expect(statusOf(() => assertUserAllowed(user))).toBe("no-error");
    expect(statusOf(() => assertUserAllowed({ ...user, email: "x@example.com" }))).toBe(403);
    expect(statusOf(() => assertUserAllowed({ ...user, email_confirmed_at: undefined }))).toBe(403);
    expect(statusOf(() => assertUserAllowed({ ...user, email: undefined }))).toBe(403);
  });
});

describe("requireUser", () => {
  it("トークン無しは 401、Supabaseが拒否したら 401", async () => {
    await expect(requireUser(undefined)).rejects.toMatchObject({ status: 401 });
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad") });
    await expect(requireUser(`Bearer ${jwt({ ...goodClaims, exp: Math.floor(Date.now() / 1000) + 600 })}`)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("サーバー設定が欠けているときは拒否側(HttpErrorではない=500)に倒れる", async () => {
    delete process.env.SUPABASE_URL;
    const token = jwt({ ...goodClaims, exp: Math.floor(Date.now() / 1000) + 600 });
    const err = await requireUser(`Bearer ${token}`).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(HttpError);
    expect(getUser).not.toHaveBeenCalled();
  });
  it("有効なユーザーを返す", async () => {
    const u = { id: "u1", email: "a@example.com", email_confirmed_at: "x", is_anonymous: false };
    getUser.mockResolvedValue({ data: { user: u }, error: null });
    const token = jwt({ ...goodClaims, exp: Math.floor(Date.now() / 1000) + 600 });
    await expect(requireUser(`Bearer ${token}`)).resolves.toMatchObject({ user: u, token });
  });
});
