import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { parseRates } from "../rates.js";
import { fakeRes } from "./testUtils.js";

const feed = (extra: Record<string, unknown> = {}) => ({
  result: "success",
  time_last_update_utc: "Thu, 05 Nov 2026 00:00:01 +0000",
  rates: {
    JPY: 1, THB: 0.2, USD: 0.0067, EUR: 0.0061, KRW: 9.1, VND: 170, CNY: 0.048,
    TWD: 0.21, SGD: 0.0088, MYR: 0.029, IDR: 110, ...extra,
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("parseRates", () => {
  it("正常なフィードを通す", () => {
    expect(parseRates(feed())?.THB).toBe(0.2);
  });
  it("不正な値(0・負・NaN・文字列・不正なコード)は落とす", () => {
    const r = parseRates(feed({ BAD: 0, NEG: -1, STR: "1", lower: 2, TOOLONG: 3 }))!;
    expect(Object.keys(r)).not.toContain("BAD");
    expect(Object.keys(r)).not.toContain("STR");
    expect(Object.keys(r)).not.toContain("lower");
    expect(Object.keys(r)).not.toContain("TOOLONG");
  });
  it("JPY基準でない・失敗応答・件数が少なすぎる場合は null", () => {
    expect(parseRates({ result: "error" })).toBeNull();
    expect(parseRates({ ...feed(), rates: { JPY: 2, THB: 1 } })).toBeNull();
    expect(parseRates({ result: "success", rates: null })).toBeNull();
    expect(parseRates(null)).toBeNull();
  });
});

describe("/api/rates", () => {
  it("検証済みレートのみ返し、CDNキャッシュを付ける", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(feed({ EVIL: "x" })), { status: 200 })));
    const res = fakeRes();
    await handler({ method: "GET" } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect((res.body as any).rates.EVIL).toBeUndefined();
    expect(res.headers["Cache-Control"]).toContain("s-maxage");
  });
  it("上流が壊れていても内部情報を返さず 502", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops secret</html>", { status: 500 })));
    const res = fakeRes();
    await handler({ method: "GET" } as any, res as any);
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain("oops");
  });
  it("GET/HEAD 以外は 405", async () => {
    const res = fakeRes();
    await handler({ method: "POST" } as any, res as any);
    expect(res.statusCode).toBe(405);
  });
});
