import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the Supabase access token sent by the client and returns the
 * authenticated user id. Requires login before any Vision/Gemini call is
 * made, to avoid unauthenticated users running up the Google Cloud bill.
 */
export async function requireUser(authHeader: string | undefined) {
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error("認証トークンがありません");
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
    throw new Error("認証に失敗しました");
  }
  return data.user;
}
