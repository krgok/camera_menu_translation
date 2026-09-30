import { createClient } from "@supabase/supabase-js";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Maps a thrown error to an HTTP status for the API handlers. */
export function errorStatus(e: unknown): number {
  return e instanceof AuthError ? e.status : 500;
}

/**
 * Comma-separated emails allowed to use the paid APIs. Unset/empty means
 * "any logged-in user" (the original behavior). Set it in Vercel so a
 * leaked URL + any Google account can't run up the Vision/Gemini bill.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifies the Supabase access token sent by the client and returns the
 * authenticated user. Requires login before any Vision/Gemini call is
 * made, to avoid unauthenticated users running up the Google Cloud bill.
 */
export async function requireUser(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new AuthError("認証トークンがありません", 401);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY が未設定です");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError("認証に失敗しました", 401);
  }

  const allowed = allowedEmails();
  const email = data.user.email?.toLowerCase();
  if (allowed.length > 0 && (!email || !allowed.includes(email))) {
    throw new AuthError(
      "このアカウントには利用が許可されていません(管理者に許可リストへの追加を依頼してください)",
      403,
    );
  }

  return data.user;
}
