import { createClient, type User } from "@supabase/supabase-js";
import { HttpError } from "./errors.js";

export class AuthError extends HttpError {}

/**
 * Comma-separated emails allowed to use the paid APIs. Unset/empty means
 * "any logged-in user" (the original behavior). Set it in Vercel so a
 * leaked URL + any Google account can't run up the Vision/Gemini bill.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Cheap local pre-check of the JWT envelope: shape, `exp` and `aud`. It is NOT
 * trusted for authentication (the signature is not checked here) — it only
 * lets us reject garbage / expired / wrong-audience tokens without a network
 * round-trip to Supabase. The real verification is `auth.getUser()` below,
 * which Supabase performs server-side (signature, expiry, session).
 */
export function precheckToken(token: string, nowSeconds = Date.now() / 1000): void {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 4096) {
    throw new AuthError("認証トークンが不正です", 401);
  }
  let claims: { exp?: unknown; aud?: unknown; role?: unknown };
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new AuthError("認証トークンが不正です", 401);
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    throw new AuthError("認証の有効期限が切れています。再ログインしてください", 401);
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes("authenticated")) {
    throw new AuthError("認証トークンが不正です", 401);
  }
}

/** Decides whether a verified Supabase user may use the paid APIs. */
export function assertUserAllowed(user: Pick<User, "email" | "email_confirmed_at" | "is_anonymous">): void {
  // Anonymous sign-ins (if ever enabled on the shared project) would let anyone
  // mint a valid token with no account at all.
  if (user.is_anonymous) {
    throw new AuthError("ログインが必要です", 401);
  }
  const allowed = allowedEmails();
  if (allowed.length === 0) return;
  const email = user.email?.toLowerCase();
  // Require a confirmed address so nobody can claim an allow-listed email by
  // signing up with it unverified.
  if (!email || !user.email_confirmed_at || !allowed.includes(email)) {
    throw new AuthError(
      "このアカウントには利用が許可されていません(管理者に許可リストへの追加を依頼してください)",
      403,
    );
  }
}

/**
 * Verifies the Supabase access token sent by the client and returns the
 * authenticated user. Requires login before any Vision/Gemini call is
 * made. Fails closed: missing server config => 500, never "allow".
 */
export async function requireUser(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new AuthError("認証トークンがありません", 401);
  }
  precheckToken(token);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY が未設定です");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError("認証に失敗しました", 401);
  }
  assertUserAllowed(data.user);

  return { user: data.user, token };
}
