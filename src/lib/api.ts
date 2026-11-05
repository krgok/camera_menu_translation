import { supabase } from "./supabase";

/** An error whose message is meant to be shown to the user as-is. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface Options {
  /** Injectable for tests; defaults to the Supabase session token. */
  getToken?: () => Promise<string | null>;
  /** Above the server's maxDuration (60s) so the server's own error wins. */
  timeoutMs?: number;
}

async function defaultToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function messageForStatus(status: number, serverMessage?: string): string {
  switch (status) {
    case 401:
      return "ログインの有効期限が切れました。いったんログアウトして、もう一度ログインしてください";
    case 413:
      return serverMessage ?? "画像が大きすぎます。もう一度撮影してください";
    case 429:
      return serverMessage ?? "利用回数の上限に達しました。しばらくしてからお試しください";
    case 403:
    case 400:
    case 502:
    case 503:
      return serverMessage ?? `処理に失敗しました (${status})`;
    default:
      return serverMessage ?? `サーバーでエラーが発生しました (${status})。しばらくしてからお試しください`;
  }
}

/**
 * POSTs JSON to one of our /api routes with the user's token, a timeout, and
 * friendly Japanese errors (offline, timeout, expired login, quota, server).
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  { getToken = defaultToken, timeoutMs = 70_000 }: Options = {},
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("オフラインです。ネットワークに接続してからやり直してください", 0);
  }
  const token = await getToken();
  if (!token) throw new ApiError("先にGoogleでログインしてください", 401);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new ApiError("時間がかかりすぎたため中断しました。電波の良い場所でもう一度お試しください", 0);
      }
      throw new ApiError("通信に失敗しました。電波状況を確認して、もう一度お試しください", 0);
    }

    if (!res.ok) {
      let serverMessage: string | undefined;
      try {
        const data = await res.json();
        if (typeof data?.error === "string") serverMessage = data.error;
      } catch {
        // Non-JSON body (e.g. a platform error page): use the generic text.
      }
      throw new ApiError(messageForStatus(res.status, serverMessage), res.status);
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("サーバーの応答を読み取れませんでした", res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}
