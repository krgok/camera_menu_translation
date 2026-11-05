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
  // Migration 007; dropped silently if the column does not exist yet.
  romanization?: string | null;
}

export type SaveResult =
  | { ok: true; droppedTrip: boolean }
  | { ok: false; message: string };

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
 * hasn't been run, the column doesn't exist: retry without those optional
 * columns so saving keeps working, and report if the trip was not stored.
 */
export async function insertSavedItem(
  client: Pick<SupabaseClient, "from">,
  row: SaveRow,
): Promise<SaveResult> {
  const first = await client.from("saved_items").insert(row);
  if (!first.error) return { ok: true, droppedTrip: false };

  if ((row.trip || row.romanization) && isMissingColumn(first.error)) {
    const { trip: _trip, romanization: _romanization, ...legacy } = row;
    const retry = await client.from("saved_items").insert(legacy);
    if (!retry.error) return { ok: true, droppedTrip: !!row.trip };
    return { ok: false, message: retry.error.message };
  }
  return { ok: false, message: first.error.message };
}
