import type { SupabaseClient } from "@supabase/supabase-js";

export interface SaveRow {
  user_id: string;
  dish_name: string;
  original_text: string | null;
  pronunciation: string | null;
  explanation: string;
  source_language: string | null;
  thumbnail_url: string | null;
  mode: string;
  reference_links: unknown;
  // Album fields (migration 006).
  trip?: string | null;
  // Migration 007; omit the key when empty. Dropped on retry if the column does not exist yet.
  romanization?: string | null;
}

// Optional columns added by later migrations: trip (006), romanization (007).
export type OptionalColumn = "trip" | "romanization";
const OPTIONAL_COLUMNS: readonly OptionalColumn[] = ["trip", "romanization"];
const COLUMN_MIGRATION: Record<OptionalColumn, string> = { trip: "006", romanization: "007" };
const COLUMN_LABEL: Record<OptionalColumn, string> = { trip: "旅行名", romanization: "ローマ字" };

export type SaveResult =
  | { ok: true; dropped: OptionalColumn[] }
  | { ok: false; message: string };

/** Notice for a save that succeeded but lost some optional columns. */
export function droppedNotice(dropped: OptionalColumn[]): string {
  const parts = dropped.map((c) => `${COLUMN_LABEL[c]}(更新 ${COLUMN_MIGRATION[c]})`);
  return `保存しましたが、${parts.join("・")}は保存されませんでした(データベースの更新が未実行のため)`;
}

/** Column named by a PostgREST / Postgres "missing column" error, if it can be parsed. */
export function missingColumnName(error: { message?: string } | null): string | null {
  const m = error?.message ?? "";
  const hit =
    /Could not find the '([^']+)' column/i.exec(m) ?? /column "?([\w]+)"? of relation/i.exec(m);
  return hit ? hit[1] : null;
}

// PostgREST: PGRST204 = column not in the schema cache; Postgres 42703 = undefined column.
export function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "PGRST204" ||
      error.code === "42703" ||
      /column .* (does not exist|of relation|in the schema cache)/i.test(error.message ?? ""))
  );
}

/**
 * Inserts a saved item. If a newer migration (006 trip, 007 romanization)
 * hasn't been run, the column doesn't exist: retry without only the optional
 * columns that are actually missing (PostgREST reports one column per error,
 * so this may take a few attempts), and report which ones were not stored.
 * If the missing column's name can't be parsed, drop all optional columns.
 */
export async function insertSavedItem(
  client: Pick<SupabaseClient, "from">,
  row: SaveRow,
): Promise<SaveResult> {
  let payload: Record<string, unknown> = { ...row };
  const dropped: OptionalColumn[] = [];
  let lastMessage = "unknown error";
  // At most one attempt per optional column, plus the first.
  for (let attempt = 0; attempt <= OPTIONAL_COLUMNS.length; attempt++) {
    const { error } = await client.from("saved_items").insert(payload);
    if (!error) return { ok: true, dropped };
    lastMessage = error.message;
    if (!isMissingColumn(error)) return { ok: false, message: error.message };

    const name = missingColumnName(error);
    const present = OPTIONAL_COLUMNS.filter((c) => c in payload);
    const targets = name === null ? present : present.filter((c) => c === name);
    if (targets.length === 0) return { ok: false, message: error.message };
    for (const c of targets) {
      // Only report columns that actually carried a value.
      if (payload[c]) dropped.push(c);
      delete payload[c];
    }
    payload = { ...payload };
  }
  return { ok: false, message: lastMessage };
}
