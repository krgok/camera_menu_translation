import { createClient } from "@supabase/supabase-js";
import type { Reference } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.warn(
    "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env",
  );
}

// Falls back to a placeholder so an unconfigured environment still renders
// the UI (login/save calls will simply fail) instead of crashing at import time.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
);

export interface SavedItem {
  id: string;
  user_id: string;
  dish_name: string;
  original_text: string | null;
  pronunciation: string | null;
  explanation: string;
  source_language: string | null;
  thumbnail_url: string | null;
  mode: string;
  reference_links: Reference[] | null;
  // Travel album fields (migration 006). Absent until that migration is run.
  trip?: string | null;
  rating?: number | null;
  note?: string | null;
  // Migration 007. Absent until that migration is run.
  romanization?: string | null;
  created_at: string;
}
