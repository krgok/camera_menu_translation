import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  AppMode,
  ExplainBatchResponse,
  ExplainResponse,
  MenuItem,
} from "../lib/types";

export function useExplain() {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const explain = useCallback(
    async (
      item: MenuItem,
      appMode: AppMode,
      avoid?: string,
    ): Promise<ExplainResponse | null> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return null;

        const res = await fetch("/api/explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: item.name,
            original_text: item.original_text,
            appMode,
            avoid,
          }),
        });
        if (!res.ok) return null;

        const data: ExplainResponse = await res.json();
        return data;
      } catch {
        return null;
      }
    },
    [],
  );

  // Explains up to 15 items in one request. Returns results aligned with
  // `items` (null where it failed), or all-null on a request failure.
  const explainBatch = useCallback(
    async (
      items: MenuItem[],
      appMode: AppMode,
      avoid?: string,
    ): Promise<(ExplainResponse | null)[]> => {
      const empty = items.map(() => null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return empty;

        const res = await fetch("/api/explain-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: items.map((i) => ({
              name: i.name,
              original_text: i.original_text,
            })),
            appMode,
            avoid,
          }),
        });
        if (!res.ok) return empty;
        const data: ExplainBatchResponse = await res.json();
        return items.map((_, i) => data.results?.[i] ?? null);
      } catch {
        return empty;
      }
    },
    [],
  );

  return { explain, explainBatch, loadingIndex, setLoadingIndex };
}
