import type { VercelResponse } from "@vercel/node";

/**
 * An error whose message is safe to show to the client. Anything that is NOT
 * an HttpError is treated as internal: it is logged server-side and the client
 * only gets a generic message (upstream bodies / env-var names / stack traces
 * must never reach the browser).
 */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Failure of Vision / Gemini. `message` is client-safe; `detail` is log-only. */
export class UpstreamError extends HttpError {
  detail?: string;
  constructor(message: string, detail?: string, status = 502) {
    super(message, status);
    this.detail = detail;
  }
}

/** Client-safe message for any thrown value (used for per-task warnings). */
export function publicMessage(e: unknown, fallback: string): string {
  if (e instanceof HttpError) return e.message;
  console.error("[api] internal error:", e instanceof Error ? e.message : e);
  return fallback;
}

export function respondError(
  res: VercelResponse,
  e: unknown,
  fallback: string,
): void {
  if (e instanceof HttpError) {
    if (e instanceof UpstreamError && e.detail) {
      console.error(`[api] upstream error: ${e.message} :: ${e.detail}`);
    }
    if (e.status === 429) res.setHeader("Retry-After", "3600");
    res.status(e.status).json({ error: e.message });
    return;
  }
  console.error("[api] internal error:", e instanceof Error ? e.message : e);
  res.status(500).json({ error: fallback });
}
