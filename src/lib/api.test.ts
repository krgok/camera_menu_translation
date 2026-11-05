import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, postJson } from "./api";
import { cameraErrorMessage } from "./cameraError";

const ok = () => Promise.resolve("tok");
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => vi.unstubAllGlobals());

const fail = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as ApiError;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

describe("postJson", () => {
  it("トークンを付けて送り、JSONを返す", async () => {
    fetchMock.mockResolvedValue(json({ a: 1 }, 200));
    await expect(postJson("/api/x", { q: 1 }, { getToken: ok })).resolves.toEqual({ a: 1 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("未ログインなら通信せず 401", async () => {
    const e = await fail(postJson("/api/x", {}, { getToken: async () => null }));
    expect(e.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("オフラインなら通信せずに案内する", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const e = await fail(postJson("/api/x", {}, { getToken: ok }));
    expect(e.message).toContain("オフライン");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("サーバーのエラーメッセージを使う(429・413)", async () => {
    fetchMock.mockResolvedValue(json({ error: "本日の利用回数の上限に達しました" }, 429));
    expect((await fail(postJson("/api/x", {}, { getToken: ok }))).message).toContain("上限");
    fetchMock.mockResolvedValue(json({ error: "画像が大きすぎます" }, 413));
    expect((await fail(postJson("/api/x", {}, { getToken: ok }))).status).toBe(413);
  });
  it("401 は再ログイン案内、HTMLのエラーページは汎用文言", async () => {
    fetchMock.mockResolvedValue(json({ error: "x" }, 401));
    expect((await fail(postJson("/api/x", {}, { getToken: ok }))).message).toContain("有効期限");
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 504 }));
    const e = await fail(postJson("/api/x", {}, { getToken: ok }));
    expect(e.message).toContain("504");
    expect(e.message).not.toContain("html");
  });
  it("通信失敗・タイムアウトを区別して案内する", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await fail(postJson("/api/x", {}, { getToken: ok }))).message).toContain("通信に失敗");
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_r, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const e = await fail(postJson("/api/x", {}, { getToken: ok, timeoutMs: 10 }));
    expect(e.message).toContain("時間がかかりすぎ");
  });
});

describe("cameraErrorMessage", () => {
  it("権限拒否・カメラなし・使用中を案内し、写真選択を促す", () => {
    expect(cameraErrorMessage(new DOMException("x", "NotAllowedError"))).toContain("許可");
    expect(cameraErrorMessage(new DOMException("x", "NotFoundError"))).toContain("見つかりません");
    expect(cameraErrorMessage(new DOMException("x", "NotReadableError"))).toContain("他のアプリ");
    expect(cameraErrorMessage(new TypeError("weird"))).toContain("写真を選択");
  });
});
