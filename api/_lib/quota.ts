import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./errors.js";

export type QuotaKind = "analyze" | "explain" | "explain_batch";

/**
 * Default daily limits. Per-user limits stop one account from running up the
 * bill; global limits cap the TOTAL spend even if many accounts sign up (the
 * Google login is open to anyone). Override with env vars in Vercel.
 *
 * Worst-case cost at the defaults is estimated in docs/audit-2026-11.md.
 */
const DEFAULTS: Record<QuotaKind, { user: number; global: number; env: string }> = {
  analyze: { user: 40, global: 400, env: "ANALYZE" },
  explain: { user: 150, global: 1500, env: "EXPLAIN" },
  explain_batch: { user: 30, global: 200, env: "EXPLAIN_BATCH" },
};

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 1_000_000 ? n : fallback;
}

export function limitsFor(kind: QuotaKind) {
  const d = DEFAULTS[kind];
  return {
    user: envInt(`DAILY_LIMIT_${d.env}`, d.user),
    global: envInt(`GLOBAL_DAILY_LIMIT_${d.env}`, d.global),
  };
}

const USER_MESSAGE =
  "本日の利用回数の上限に達しました。日本時間の午前9時(UTC 0時)にリセットされます";
const GLOBAL_MESSAGE =
  "サービス全体の本日の利用上限に達しました。日本時間の午前9時以降にもう一度お試しください";

// --- Fallback used only while the DB quota is not set up (see below). -------
// Per serverless instance, so it is only a best-effort brake: instances don't
// share it and it resets on cold start. The Supabase counter is the real limit.
const memory = new Map<string, number>();
let warnedFallback = false;

function memoryConsume(userId: string, kind: QuotaKind, limit: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${userId}:${kind}`;
  if (memory.size > 5000) memory.clear();
  const used = memory.get(key) ?? 0;
  if (used >= limit) return false;
  memory.set(key, used + 1);
  return true;
}

export function resetMemoryQuotaForTests() {
  memory.clear();
  warnedFallback = false;
}

/**
 * Counts one paid call against the user's daily quota BEFORE the upstream API
 * is called. Throws HttpError(429) when the user or the whole service is over
 * its limit.
 *
 * Backing store:
 *  - QUOTA_SECRET set  -> Supabase RPC menu_camera_consume_quota (atomic,
 *    shared across all Vercel instances). Any DB/network failure other than
 *    "function not installed" FAILS CLOSED (503): no count, no paid call.
 *  - QUOTA_SECRET unset, or the migration (004) not applied yet -> per-instance
 *    in-memory counter, with a warning in the logs.
 */
export async function consumeQuota(
  userId: string,
  token: string,
  kind: QuotaKind,
): Promise<void> {
  const limits = limitsFor(kind);
  const secret = process.env.QUOTA_SECRET;
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (secret && url && anon) {
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("menu_camera_consume_quota", {
      p_kind: kind,
      p_user_limit: limits.user,
      p_global_limit: limits.global,
      p_secret: secret,
    });

    if (!error && data && typeof data === "object") {
      const result = data as { allowed?: boolean; scope?: string };
      if (result.allowed === true) return;
      throw new HttpError(
        result.scope === "global" ? GLOBAL_MESSAGE : USER_MESSAGE,
        429,
      );
    }

    // 42883 / PGRST202: the function does not exist yet (migration not run).
    const notInstalled = error?.code === "PGRST202" || error?.code === "42883";
    if (!notInstalled) {
      console.error("[quota] rpc failed:", error?.code, error?.message);
      throw new HttpError("利用制限の確認に失敗しました。しばらくしてからお試しください", 503);
    }
  }

  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      "[quota] DB quota not active (QUOTA_SECRET unset or migration 004 not applied); using per-instance in-memory limits",
    );
  }
  if (!memoryConsume(userId, kind, limits.user)) {
    throw new HttpError(USER_MESSAGE, 429);
  }
}
