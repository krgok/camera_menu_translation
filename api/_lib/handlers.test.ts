import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRes, jpegDataUrl } from "./testUtils.js";
import { MAX_IMAGE_BASE64_CHARS } from "./limits.js";

vi.mock("./auth.js", () => ({
  requireUser: vi.fn(async () => ({ user: { id: "u1" }, token: "t" })),
}));

import { requireUser } from "./auth.js";
import { HttpError } from "./errors.js";
import { resetMemoryQuotaForTests } from "./quota.js";
import analyze from "../analyze.js";
import explain from "../explain.js";
import explainBatch from "../explain-batch.js";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetMemoryQuotaForTests();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const call = async (handler: any, req: object) => {
  const res = fakeRes();
  await handler({ method: "POST", headers: { authorization: "Bearer x" }, ...req }, res);
  return res;
};

describe("全ルート共通", () => {
  it.each([analyze, explain, explainBatch])("POST 以外は 405 で有料APIを呼ばない", async (h) => {
    const res = await call(h, { method: "GET" });
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([analyze, explain, explainBatch])("未認証は 401 で有料APIを呼ばない", async (h) => {
    vi.mocked(requireUser).mockRejectedValueOnce(new HttpError("認証トークンがありません", 401));
    const res = await call(h, { body: {} });
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("内部エラーの詳細はクライアントに返さない", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("SUPABASE_URL が未設定です key=abc"));
    const res = await call(explain, { body: { name: "a" } });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("SUPABASE");
  });
});

describe("/api/analyze の入力上限(課金前に拒否)", () => {
  it("巨大画像は 413、PNGは 400、寸法超過は 400 で、いずれも上流を呼ばない", async () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_BASE64_CHARS + 10);
    expect((await call(analyze, { body: { image: huge, modes: ["text"] } })).statusCode).toBe(413);
    expect(
      (await call(analyze, { body: { image: "data:image/png;base64,AAAA", modes: ["text"] } })).statusCode,
    ).toBe(400);
    expect(
      (await call(analyze, { body: { image: jpegDataUrl(9000, 9000), modes: ["image"] } })).statusCode,
    ).toBe(400);
    expect(
      (await call(analyze, { headers: { authorization: "Bearer x", "content-length": "99999999" }, body: {} }))
        .statusCode,
    ).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("正常な画像は Vision/Gemini を呼び、上流エラー本文はwarningsに出ない", async () => {
    process.env.GOOGLE_VISION_API_KEY = "v";
    process.env.GEMINI_API_KEY = "g";
    fetchMock.mockImplementation(async () => new Response("SECRET-BODY", { status: 500 }));
    const res = await call(analyze, { body: { image: jpegDataUrl(), modes: ["text", "image"] } });
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("SECRET-BODY");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("1日の上限", () => {
  it("上限に達したら 429 + Retry-After で、上流を呼ばない", async () => {
    process.env.DAILY_LIMIT_EXPLAIN = "1";
    process.env.GEMINI_API_KEY = "g";
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"explanation":"ok"}' }] } }] }),
        { status: 200 },
      ),
    );
    expect((await call(explain, { body: { name: "a" } })).statusCode).toBe(200);
    const second = await call(explain, { body: { name: "a" } });
    expect(second.statusCode).toBe(429);
    expect(second.headers["Retry-After"]).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    delete process.env.DAILY_LIMIT_EXPLAIN;
  });

  it("入力検証に失敗したリクエストは回数を消費しない", async () => {
    process.env.DAILY_LIMIT_EXPLAIN = "1";
    expect((await call(explain, { body: {} })).statusCode).toBe(400);
    expect((await call(explain, { body: {} })).statusCode).toBe(400);
    delete process.env.DAILY_LIMIT_EXPLAIN;
  });
});

describe("/api/explain, /api/explain-batch の入力検証", () => {
  it("name 無し・16件超は 400 で上流を呼ばない", async () => {
    expect((await call(explain, { body: {} })).statusCode).toBe(400);
    const items = Array.from({ length: 16 }, () => ({ name: "a" }));
    expect((await call(explainBatch, { body: { items } })).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
